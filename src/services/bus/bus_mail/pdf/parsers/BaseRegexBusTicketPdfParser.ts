import { BusTicketPaymentMethod, BusTicketPriceComponent } from "../types/BusTicketTypes.js";
import { PdfAnalysisResult } from "../types/PdfTypes.js";

export interface ParsedDateTime {
    date: string;
    time: string;
}

export interface ParsedRouteData {
    routeName?: string;
    tripNumber?: string;
    platform?: string;
    seat?: string;
    carrierName?: string;
    carrierId?: string;
}

export interface ParsedTripPoints {
    departureStation?: string;
    departureAddress?: string;
    departureDate?: string;
    departureTime?: string;

    arrivalStation?: string;
    arrivalAddress?: string;
    arrivalDate?: string;
    arrivalTime?: string;
}

export abstract class BaseRegexBusTicketPdfParser {

    protected compact(value: string): string {
        return value
            .replace(/\uFFFE/g, "-")
            .replace(/[\u00AD\uFFFF]/g, "")
            .replace(/[‐-‒–—−]/g, "-")
            .replace(/\u00A0/g, " ")
            .replace(/\r\n?/g, "\n")
            /*
             * Исправляет перенос слова вида:
             *
             * Комсомольск- На-Амуре
             *
             * но не изменяет разделитель маршрута:
             *
             * Хабаровск - Комсомольск
             */
            .replace(/([А-Яа-яЁё])-\s+([А-Яа-яЁё])/gu, "$1-$2")
            .replace(/\s+/g, " ")
            .trim();
    }

    protected clean(value: string): string {
        return this.compact(value);
    }

    protected extractFirstGroup(text: string, expression: RegExp, groupIndex = 1): string | undefined {
        expression.lastIndex = 0;
        const value = text.match(expression)?.[groupIndex];
        return value ? this.clean(value) : undefined;
    }

    protected extractDateTime(text: string, expression: RegExp): ParsedDateTime | undefined {
        expression.lastIndex = 0;
        const match = text.match(expression);

        if (!match) {
            return undefined;
        }

        return {
            date: match[1],
            time: match[2]
        };
    }

    protected toIsoDate(value: string): string {
        const match = value.match(/^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/);

        if (!match) {
            throw new Error(`Unsupported date format: "${value}"`);
        }

        const year = match[3].length === 2 ? `20${match[3]}` : match[3];
        return `${year}-${match[2]}-${match[1]}`;
    }

    protected toMoney(value: string | undefined): number | undefined {
        if (!value) {
            return undefined;
        }

        const result = Number(value.replace(/[\s\u00A0]/g, "").replace(",", "."));

        return Number.isFinite(result) ? result : undefined;
    }

    protected extractMoneyValues(text: string): number[] {
        const textWithoutDates = text
            .replace(/\b\d{2}\.\d{2}\.\d{2,4}\b/g, " ")
            .replace(/\b\d{2}:\d{2}\b/g, " ");

        const matches = textWithoutDates.match(/(?<!\d)(?:\d{1,3}(?:[ \u00A0]\d{3})+|\d{1,9})[.,]\d{2}(?!\d)/g) ?? [];

        return matches
            .map((value) => this.toMoney(value))
            .filter(
                (value): value is number =>
                    value !== undefined
            );
    }

    protected mapPaymentMethod(value: string | undefined): BusTicketPaymentMethod {
        if (!value) {
            return "UNKNOWN";
        }

        if (/Электронный билет/i.test(value)) {
            return "ELECTRONIC_TICKET";
        }

        if (/Банковская карта|Карта|CARD/i.test(value)) {
            return "CARD";
        }

        if (/Безналичн|Перевод|BANK TRANSFER/i.test(value)) {
            return "BANK_TRANSFER";
        }

        if (/Наличн/i.test(value)) {
            return "CASH";
        }

        return "UNKNOWN";
    }

    protected splitRoute(routeName: string | undefined): { departureStation?: string; arrivalStation?: string; } {
        if (!routeName) {
            return {};
        }

        const parts = routeName.split(/\s+-\s+/);

        if (parts.length < 2) {
            return {
                departureStation: this.clean(routeName)
            };
        }

        return {
            departureStation: this.clean(parts[0]),
            arrivalStation: this.clean(parts.slice(1).join(" - "))
        };
    }

    protected cleanRouteName(value: string): string {
        return this.clean(value).replace(/\s+-\s+/g, " - ");
    }

    protected extractCityName(station: string | undefined): string | undefined {
        if (!station) {
            return undefined;
        }

        return station.replace(/\s+(?:ЖД(?:\s*\([^)]*\))?|Автовокзал|АВ|Аэропорт).*$/iu, "").trim() || undefined;
    }

    protected splitStationAndAddress(value: string | undefined, expectedStation: string | undefined): { station?: string; address?: string; } {
        if (!value) {
            return {};
        }

        const normalizedValue = this.clean(value);
        const normalizedStation = expectedStation ? this.clean(expectedStation) : undefined;

        if (normalizedStation && normalizedValue.toLocaleLowerCase("ru").startsWith(normalizedStation.toLocaleLowerCase("ru"))) {
            const address = normalizedValue
                .slice(normalizedStation.length)
                .replace(/^[,\s]+/, "")
                .replace(/[,\s]+$/, "")
                .trim();

            return {
                station: normalizedStation,
                address: address || undefined
            };
        }

        const commaIndex = normalizedValue.indexOf(",");

        if (commaIndex > 0) {
            return {
                station: this.clean(normalizedValue.slice(0, commaIndex)),
                address: this.clean(normalizedValue.slice(commaIndex + 1)) || undefined
            };
        }

        return {
            station: normalizedValue
        };
    }

    protected extractPassengerName(passengerSection: string): string | undefined {
        const match = passengerSection.match(/(?:^|\s)([А-ЯЁ][А-Яа-яЁё-]+(?:\s+[А-ЯЁ][А-Яа-яЁё-]+){2})(?=\s+Паспорт\s+РФ)/u);
        return match?.[1] ? this.clean(match[1]) : undefined;
    }

    protected extractPassportNumber(passengerSection: string): string | undefined {
        const match = passengerSection.match(/\b(\d{4})[\s/]*(\d{6})\b/u);
        return match ? `${match[1]}${match[2]}` : undefined;
    }

    protected buildPricing(total: number | undefined, commission = 0): { baseFare?: number; total?: number; components: BusTicketPriceComponent[]; } {
        if (total === undefined) {
            return {
                components: []
            };
        }

        const baseFare = Math.max(0, total - commission);

        const components: BusTicketPriceComponent[] = [
            {
                code: "FARE",
                amount: baseFare,
                currency: "RUB"
            }
        ];

        components.push({
            code: "COMMISSION",
            amount: commission,
            currency: "RUB"
        });

        return {
            baseFare,
            total,
            components
        };
    }

    protected createWarnings(data: { passengerName?: string; routeName?: string; departureDate?: string; total?: number; }): Array<{ code: string; message: string; }> {
        const warnings: Array<{ code: string; message: string; }> = [];

        if (!data.passengerName) {
            warnings.push({
                code: "PASSENGER_NAME_NOT_FOUND",
                message: "Не удалось извлечь ФИО пассажира"
            });
        }

        if (!data.routeName) {
            warnings.push({
                code: "ROUTE_NOT_FOUND",
                message: "Не удалось извлечь маршрут"
            });
        }

        if (!data.departureDate) {
            warnings.push({
                code: "DEPARTURE_DATE_NOT_FOUND",
                message: "Не удалось извлечь дату отправления"
            });
        }

        if (data.total === undefined) {
            warnings.push({
                code: "TOTAL_PRICE_NOT_FOUND",
                message: "Не удалось определить итоговую стоимость"
            });
        }

        return warnings;
    }

    protected validateCriticalFields(data: { parserName: string; receiptId?: string; ticketNumber?: string; routeName?: string; }): void {
        const missingFields: string[] = [];

        if (!data.receiptId && !data.ticketNumber) {
            missingFields.push("ticket identifier");
        }

        if (!data.routeName) {
            missingFields.push("route");
        }

        if (missingFields.length > 0) {
            throw new Error(`${data.parserName} PDF was detected, but critical fields ` + `could not be extracted: ${missingFields.join(", ")}`);
        }
    }

    protected source(analysis: PdfAnalysisResult) {
        return {
            filename: analysis.filename,
            checksum: analysis.checksum,
            size: analysis.size,
            pageCount: analysis.pageCount,
            pageNumber: analysis.pageNumber,
            metadata: analysis.metadata
        };
    }

    protected extractSection(text: string, startExpression: RegExp, endExpression: RegExp): string {
        startExpression.lastIndex = 0;
        endExpression.lastIndex = 0;

        const startMatch = startExpression.exec(text);

        if (!startMatch) {
            return "";
        }

        const rest = text.slice(startMatch.index + startMatch[0].length);
        const endMatch = endExpression.exec(rest);

        return endMatch ? rest.slice(0, endMatch.index) : rest;
    }
}
