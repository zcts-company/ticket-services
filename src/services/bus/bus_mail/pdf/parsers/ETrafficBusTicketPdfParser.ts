import {
    BusTicketPaymentMethod,
    BusTicketPriceComponent,
    ParsedBusTicketDocument
} from "../types/BusTicketTypes.js";

import { PdfAnalysisResult } from
    "../types/PdfTypes.js";
import { BusTicketPdfParser, PdfParserDetection } from "./interface/BusTicketPdfParser.js";


interface ETrafficRouteData {
    routeName?: string;
    tripNumber?: string;
    platform?: string;
    seat?: string;
    carrierName?: string;
    carrierId?: string;
}

interface ETrafficTripPoints {
    departureStation?: string;
    departureAddress?: string;
    departureDate?: string;
    departureTime?: string;

    arrivalStation?: string;
    arrivalAddress?: string;
    arrivalDate?: string;
    arrivalTime?: string;
}

interface ETrafficPricingData {
    baseFare?: number;
    commission?: number;
    total?: number;
    components: BusTicketPriceComponent[];
}

export class ETrafficBusTicketPdfParser
    implements BusTicketPdfParser {

    readonly id = "e-traffic-russia-v1";
    readonly version = "1.0.0";

    detect(
        analysis: PdfAnalysisResult
    ): PdfParserDetection {
        const text = this.normalizeText(
            analysis.normalizedText
        );

        const matchedMarkers: string[] = [];
        let confidence = 0;

        if (
            /Маршрутная квитанция электронного билета/i
                .test(text)
        ) {
            matchedMarkers.push(
                "ITINERARY_RECEIPT"
            );

            confidence += 20;
        }

        if (
            /Идентификатор квитанции/i
                .test(text)
        ) {
            matchedMarkers.push(
                "RECEIPT_IDENTIFIER"
            );

            confidence += 25;
        }

        if (
            /Серия билета\s+\d+/i.test(text)
        ) {
            matchedMarkers.push(
                "TICKET_SERIES"
            );

            confidence += 15;
        }

        if (
            /Номер билета\s+\d+/i.test(text)
        ) {
            matchedMarkers.push(
                "TICKET_NUMBER"
            );

            confidence += 15;
        }

        if (
            /e-traffic\.ru/i.test(text)
        ) {
            matchedMarkers.push(
                "E_TRAFFIC"
            );

            confidence += 35;
        }

        confidence = Math.min(
            confidence,
            100
        );

        return {
            supported: confidence >= 70,
            confidence,
            matchedMarkers
        };
    }

    parse(
        analysis: PdfAnalysisResult,
        detection: PdfParserDetection
    ): ParsedBusTicketDocument {
        const text = this.normalizeText(
            analysis.normalizedText
        );

        const passengerSection =
            this.extractSection(
                text,
                /Информация о пассажире и тарифе/i,
                /Информация о рейсе/i
            );

        const tripSection =
            this.extractSection(
                text,
                /Информация о рейсе/i,
                /Информация о платеже/i
            );

        const paymentSection =
            this.extractSection(
                text,
                /Информация о платеже/i,
                /Время отправления указано местное/i
            );

        const receiptId =
            this.extractFirstGroup(
                text,
                /Идентификатор квитанции\s+(\d+)/i
            );

        const ticketSeries =
            this.extractFirstGroup(
                text,
                /Серия билета\s+(\d+)/i
            );

        const ticketNumber =
            this.extractFirstGroup(
                text,
                /Номер билета\s+(\d+)/i
            );

        const agent =
            this.cleanAgent(
                this.extractFirstGroup(
                    text,
                    /Агент\s+(.+?)(?=\s+Идентификатор квитанции)/i
                )
            );

        const purchaseDateTime =
            this.extractDateTime(
                text,
                /Дата покупки\s+(\d{2}\.\d{2}\.\d{2,4})\s+(\d{2}:\d{2})/i
            );

        const ticketType =
            this.extractFirstGroup(
                text,
                /Тип билета\s+(.+?)(?=\s+Вид транспортного средства)/i
            );

        const vehicleType =
            this.extractFirstGroup(
                text,
                /Вид транспортного средства\s+(.+?)(?=\s+Информация о пассажире)/i
            );

        const passengerName =
            this.extractRussianFullName(
                passengerSection
            );

        const passengerDocument =
            this.extractPassengerDocument(
                passengerSection
            );

        const route =
            this.extractRouteData(
                tripSection
            );

        const routeParts =
            this.splitRoute(
                route.routeName
            );

        const tripPoints =
            this.extractTripPoints(
                tripSection,
                routeParts.departureStation
            );

        const paymentMethodRaw =
            this.extractFirstGroup(
                paymentSection,
                /Форма оплаты\s+(.+?)(?=\s+Итого сумма платежа|\s+Время отправления|$)/i
            );

        const paymentMethod =
            this.mapPaymentMethod(
                paymentMethodRaw
            );

        const pricing =
            this.extractPricing(text);

        const warnings =
            this.createWarnings({
                passengerName,
                routeName: route.routeName,
                departureDate:
                    tripPoints.departureDate,
                total: pricing.total
            });

        this.validateCriticalFields({
            receiptId,
            ticketNumber,
            routeName: route.routeName
        });

        return {
            schemaVersion: "1.0",
            documentType: "BUS_TICKET",

            parser: {
                id: this.id,
                version: this.version,
                confidence:
                    detection.confidence
            },

            source: {
                filename:
                    analysis.filename,

                checksum:
                    analysis.checksum,

                size:
                    analysis.size,

                pageCount:
                    analysis.pageCount,

                pageNumber:
                    analysis.pageNumber,

                metadata:
                    analysis.metadata
            },

            provider: {
                name: "E-TRAFFIC",
                agent,
                website:
                    /e-traffic\.ru/i.test(text)
                        ? "e-traffic.ru"
                        : undefined
            },

            identifiers: {
                receiptId,

                itinerarySeries:
                    ticketSeries,

                itineraryNumber:
                    ticketNumber
            },

            ticket: {
                type:
                    ticketType
                        ? this.cleanText(
                            ticketType
                        )
                        : undefined,

                vehicleType:
                    vehicleType
                        ? this.cleanText(
                            vehicleType
                        )
                        : undefined
            },

            passenger: {
                fullName:
                    passengerName,

                document:
                    passengerDocument
                        ? {
                            type: "PASSPORT",
                            number:
                                passengerDocument.number,
                            rawType:
                                passengerDocument.rawType
                        }
                        : undefined,

                gender: "UNKNOWN"
            },

            trip: {
                routeName:
                    route.routeName,

                tripNumber:
                    route.tripNumber,

                platform:
                    route.platform,

                seat:
                    route.seat,

                departure: {
                    city:
                        this.extractCityName(
                            routeParts.departureStation
                        ),

                    station:
                        tripPoints.departureStation ??
                        routeParts.departureStation,

                    address:
                        tripPoints.departureAddress,

                    date:
                        tripPoints.departureDate
                            ? this.toIsoDate(
                                tripPoints.departureDate
                            )
                            : undefined,

                    time:
                        tripPoints.departureTime
                },

                arrival: {
                    city:
                        this.extractCityName(
                            routeParts.arrivalStation
                        ),

                    station:
                        tripPoints.arrivalStation ??
                        routeParts.arrivalStation,

                    address:
                        tripPoints.arrivalAddress,

                    date:
                        tripPoints.arrivalDate
                            ? this.toIsoDate(
                                tripPoints.arrivalDate
                            )
                            : undefined,

                    time:
                        tripPoints.arrivalTime
                },

                carrier: {
                    id:
                        route.carrierId,

                    name:
                        route.carrierName
                }
            },

            purchase: {
                agentIssuedAt:
                    purchaseDateTime
                        ? {
                            date:
                                this.toIsoDate(
                                    purchaseDateTime.date
                                ),

                            time:
                                purchaseDateTime.time
                        }
                        : undefined,

                paymentMethod,

                paymentMethodRaw:
                    paymentMethodRaw
                        ? this.cleanText(
                            paymentMethodRaw
                        )
                        : undefined
            },

            pricing: {
                currency: "RUB",

                baseFare:
                    pricing.baseFare,

                total:
                    pricing.total,

                totalSource:
                    pricing.total !== undefined
                        ? "ITINERARY_RECEIPT"
                        : "UNKNOWN",

                itineraryReceiptTotal:
                    pricing.total,

                components:
                    pricing.components
            },

            warnings
        };
    }

    private extractRouteData(
        tripSection: string
    ): ETrafficRouteData {
        /*
         * Ожидаемый нормализованный блок:
         *
         * Рейс Номер Платформа Место Перевозчик
         * Комсомольск-На-Амуре ЖД(ТПУ) - Хабаровск
         * 304а Перрон 1 Место 9 ООО "Вираж" 2724081103
         */
        const match = tripSection.match(
            /Рейс\s+Номер\s+Платформа\s+Место\s+Перевозчик\s+(.+?)\s+(\d+[A-Za-zА-Яа-яЁё]?)\s+((?:Перрон|Платформа)\s+\d+|\d+)\s+Место\s+(\d+)\s+(.+?)\s+(\d{6,})(?=\s+Пункт отправления)/iu
        );

        if (!match) {
            return {};
        }

        return {
            routeName:
                this.cleanRouteName(
                    match[1]
                ),

            tripNumber:
                match[2],

            platform:
                this.cleanText(
                    match[3]
                ),

            seat:
                match[4],

            carrierName:
                this.cleanText(
                    match[5]
                ),

            carrierId:
                match[6]
        };
    }

    private extractTripPoints(
        tripSection: string,
        routeDepartureStation:
            string | undefined
    ): ETrafficTripPoints {
        /*
         * После нормализации:
         *
         * Пункт отправления Дата отправления
         * Пункт прибытия Дата прибытия
         * Комсомольск-На-Амуре ЖД(ТПУ)
         * Магистральное шоссе 2\2,
         * 03.08.26 22:30
         * Хабаровск Аэропорт
         * 04.08.26 04:25
         */
        const match = tripSection.match(
            /Пункт отправления\s+Дата отправления\s+Пункт прибытия\s+Дата прибытия\s+(.+?)\s+(\d{2}\.\d{2}\.\d{2,4})\s+(\d{2}:\d{2})\s+(.+?)\s+(\d{2}\.\d{2}\.\d{2,4})\s+(\d{2}:\d{2})/i
        );

        if (!match) {
            return {};
        }

        const departureLocation =
            this.splitStationAndAddress(
                match[1],
                routeDepartureStation
            );

        return {
            departureStation:
                departureLocation.station,

            departureAddress:
                departureLocation.address,

            departureDate:
                match[2],

            departureTime:
                match[3],

            arrivalStation:
                this.cleanText(
                    match[4]
                ),

            arrivalDate:
                match[5],

            arrivalTime:
                match[6]
        };
    }

    private splitStationAndAddress(
        sourceValue: string,
        expectedStation:
            string | undefined
    ): {
        station?: string;
        address?: string;
    } {
        const value =
            this.cleanText(sourceValue);

        if (!value) {
            return {};
        }

        if (expectedStation) {
            const normalizedStation =
                this.cleanText(
                    expectedStation
                );

            if (
                value.toLocaleLowerCase("ru")
                    .startsWith(
                        normalizedStation
                            .toLocaleLowerCase("ru")
                    )
            ) {
                const address = value
                    .slice(
                        normalizedStation.length
                    )
                    .replace(/^[,\s]+/, "")
                    .replace(/[,\s]+$/, "")
                    .trim();

                return {
                    station:
                        normalizedStation,

                    address:
                        address || undefined
                };
            }
        }

        /*
         * Резервный вариант для адресов,
         * когда наименование станции не совпало
         * с левой частью маршрута.
         */
        const addressMatch = value.match(
            /^(.+?)\s+((?:улица|ул\.?|проспект|пр-т|площадь|шоссе|переулок|пер\.?|набережная)\s+.+)$/iu
        );

        if (!addressMatch) {
            return {
                station: value
            };
        }

        return {
            station:
                this.cleanText(
                    addressMatch[1]
                ),

            address:
                this.cleanText(
                    addressMatch[2]
                )
        };
    }

    private extractPricing(
        text: string
    ): ETrafficPricingData {
        /*
         * В этом PDF значения 2544.00 после извлечения
         * текста могут оказаться в конце документа,
         * отдельно от подписей таблицы.
         *
         * Поэтому используем арифметическое определение:
         *
         * тариф + комиссия = итог.
         */
        const moneyValues =
            this.extractMoneyValues(text);

        if (moneyValues.length === 0) {
            return {
                components: []
            };
        }

        const uniqueValues = [
            ...new Set(moneyValues)
        ].sort(
            (first, second) =>
                first - second
        );

        const total =
            Math.max(...moneyValues);

        let baseFare: number | undefined;
        let commission:
            number | undefined;

        /*
         * Стандартный случай:
         *
         * 2544.00 + 0.00 = 2544.00
         */
        if (
            uniqueValues.some(
                (value) =>
                    this.areMoneyEqual(
                        value,
                        0
                    )
            )
        ) {
            commission = 0;
            baseFare = total;
        }

        /*
         * Случай с ненулевой комиссией:
         *
         * 2400.00 + 144.00 = 2544.00
         */
        if (
            baseFare === undefined ||
            commission === undefined
        ) {
            outer:
            for (
                const firstValue of uniqueValues
            ) {
                for (
                    const secondValue of uniqueValues
                ) {
                    if (
                        this.areMoneyEqual(
                            firstValue +
                            secondValue,
                            total
                        )
                    ) {
                        baseFare =
                            Math.max(
                                firstValue,
                                secondValue
                            );

                        commission =
                            Math.min(
                                firstValue,
                                secondValue
                            );

                        break outer;
                    }
                }
            }
        }

        if (baseFare === undefined) {
            baseFare = total;
        }

        const components:
            BusTicketPriceComponent[] = [
                {
                    code: "FARE",
                    amount: baseFare,
                    currency: "RUB"
                }
            ];

        if (commission !== undefined) {
            components.push({
                code: "COMMISSION",
                amount: commission,
                currency: "RUB"
            });
        }

        return {
            baseFare,
            commission,
            total,
            components
        };
    }

    private extractPassengerDocument(
        passengerSection: string
    ): {
        rawType: string;
        number: string;
    } | undefined {
        const match = passengerSection.match(
            /(Паспорт(?:\s+РФ)?)\s+(\d{4})\s*(\d{6})/iu
        );

        if (!match) {
            return undefined;
        }

        return {
            rawType:
                this.cleanText(
                    match[1]
                ),

            number:
                `${match[2]}${match[3]}`
        };
    }

    private extractRussianFullName(
        value: string
    ): string | undefined {
        const normalizedValue =
            this.cleanText(value);

        const match = normalizedValue.match(
            /(?:^|[^А-Яа-яЁё-])([А-ЯЁ][А-Яа-яЁё-]+(?:\s+[А-ЯЁ][А-Яа-яЁё-]+){2})(?=$|[^А-Яа-яЁё-])/u
        );

        return match?.[1];
    }

    private splitRoute(
        routeName: string | undefined
    ): {
        departureStation?: string;
        arrivalStation?: string;
    } {
        if (!routeName) {
            return {};
        }

        const parts = routeName.split(
            /\s+-\s+/
        );

        if (parts.length < 2) {
            return {
                departureStation:
                    routeName
            };
        }

        return {
            departureStation:
                this.cleanText(
                    parts[0]
                ),

            arrivalStation:
                this.cleanText(
                    parts
                        .slice(1)
                        .join(" - ")
                )
        };
    }

    private extractCityName(
        station:
            string | undefined
    ): string | undefined {
        if (!station) {
            return undefined;
        }

        return station
            .replace(
                /\s+(?:ЖД(?:\([^)]*\))?|Автовокзал|АВ|Аэропорт).*$/iu,
                ""
            )
            .trim() || undefined;
    }

    private mapPaymentMethod(
        value: string | undefined
    ): BusTicketPaymentMethod {
        if (!value) {
            return "UNKNOWN";
        }

        if (
            /Электронный билет/i.test(value)
        ) {
            return "ELECTRONIC_TICKET";
        }

        if (
            /Банковская карта|Карта|CARD/i
                .test(value)
        ) {
            return "CARD";
        }

        if (
            /Наличный/i.test(value)
        ) {
            return "CASH";
        }

        if (
            /Безналичный|Перевод/i.test(value)
        ) {
            return "BANK_TRANSFER";
        }

        return "UNKNOWN";
    }

    private extractDateTime(
        text: string,
        expression: RegExp
    ): {
        date: string;
        time: string;
    } | undefined {
        const match = text.match(
            expression
        );

        if (!match) {
            return undefined;
        }

        return {
            date: match[1],
            time: match[2]
        };
    }

    private extractSection(
        text: string,
        startMarker: RegExp,
        endMarker: RegExp
    ): string {
        const startMatch =
            startMarker.exec(text);

        if (!startMatch) {
            return "";
        }

        const sectionStart =
            startMatch.index +
            startMatch[0].length;

        const remainingText =
            text.slice(sectionStart);

        const endMatch =
            endMarker.exec(
                remainingText
            );

        if (!endMatch) {
            return remainingText;
        }

        return remainingText.slice(
            0,
            endMatch.index
        );
    }

    private extractMoneyValues(
        text: string
    ): number[] {
        /*
         * Сначала удаляем даты, чтобы 30.07.26
         * не превратилось в сумму 30.07.
         */
        const textWithoutDates = text
            .replace(
                /\b\d{2}\.\d{2}\.\d{2,4}\b/g,
                " "
            )
            .replace(
                /\b\d{2}:\d{2}\b/g,
                " "
            );

        const matches =
            textWithoutDates.match(
                /(?<!\d)\d{1,9}[.,]\d{2}(?!\d)/g
            ) ?? [];

        return matches
            .map(
                (value) =>
                    Number(
                        value.replace(",", ".")
                    )
            )
            .filter(Number.isFinite);
    }

    private extractFirstGroup(
        text: string,
        expression: RegExp
    ): string | undefined {
        const value =
            text.match(expression)?.[1];

        return value
            ? this.cleanText(value)
            : undefined;
    }

    private cleanAgent(
        value: string | undefined
    ): string | undefined {
        if (!value) {
            return undefined;
        }

        const normalized = value
            /*
             * В PDF присутствует артефакт:
             *
             * Хабаровский АВ [web1]()
             */
            .replace(
                /\s*\[web\d+\]\(\)\s*$/i,
                ""
            )
            .trim();

        return normalized || undefined;
    }

    private cleanRouteName(
        value: string
    ): string {
        return this.cleanText(value)
            .replace(
                /\s+-\s+/g,
                " - "
            );
    }

    private normalizeText(
        value: string
    ): string {
        return value
            /*
             * В примере встречается:
             *
             * Комсомольск-На￾Амуре
             */
            .replace(/\uFFFE/g, "-")
            .replace(/[\u00AD\uFFFF]/g, "")
            .replace(
                /[‐-‒–—−]/g,
                "-"
            )
            .replace(/\u00A0/g, " ")
            .replace(/\r\n?/g, "\n")
            .replace(/\s+/g, " ")
            .trim();
    }

    private cleanText(
        value: string
    ): string {
        return value
            .replace(/\uFFFE/g, "-")
            .replace(/[\u00AD\uFFFF]/g, "")
            .replace(
                /[‐-‒–—−]/g,
                "-"
            )
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    private toIsoDate(
        value: string
    ): string {
        const match = value.match(
            /^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/
        );

        if (!match) {
            throw new Error(
                `Unsupported date format: "${value}"`
            );
        }

        const day = match[1];
        const month = match[2];

        const year =
            match[3].length === 2
                ? `20${match[3]}`
                : match[3];

        return `${year}-${month}-${day}`;
    }

    private areMoneyEqual(
        first: number,
        second: number
    ): boolean {
        return Math.abs(
            first - second
        ) < 0.01;
    }

    private createWarnings(
        data: {
            passengerName?: string;
            routeName?: string;
            departureDate?: string;
            total?: number;
        }
    ): Array<{
        code: string;
        message: string;
    }> {
        const warnings: Array<{
            code: string;
            message: string;
        }> = [];

        if (!data.passengerName) {
            warnings.push({
                code:
                    "PASSENGER_NAME_NOT_FOUND",

                message:
                    "Не удалось извлечь ФИО пассажира"
            });
        }

        if (!data.departureDate) {
            warnings.push({
                code:
                    "DEPARTURE_DATE_NOT_FOUND",

                message:
                    "Не удалось извлечь дату отправления"
            });
        }

        if (data.total === undefined) {
            warnings.push({
                code:
                    "TOTAL_PRICE_NOT_FOUND",

                message:
                    "Не удалось определить итоговую стоимость"
            });
        }

        return warnings;
    }

    private validateCriticalFields(
        data: {
            receiptId?: string;
            ticketNumber?: string;
            routeName?: string;
        }
    ): void {
        const missingFields: string[] = [];

        if (
            !data.receiptId &&
            !data.ticketNumber
        ) {
            missingFields.push(
                "ticket identifier"
            );
        }

        if (!data.routeName) {
            missingFields.push(
                "route"
            );
        }

        if (missingFields.length > 0) {
            throw new Error(
                `E-traffic PDF was detected, but critical fields ` +
                `could not be extracted: ` +
                missingFields.join(", ")
            );
        }
    }
}