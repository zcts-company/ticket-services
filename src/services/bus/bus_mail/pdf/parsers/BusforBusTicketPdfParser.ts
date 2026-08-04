import { BusTicketPaymentMethod, BusTicketPriceComponent, BusTicketTrip, ParsedBusTicketDocument } from "../types/BusTicketTypes.js";
import { PdfAnalysisResult } from "../types/PdfTypes.js";
import { BusTicketPdfParser, PdfParserDetection } from "./interface/BusTicketPdfParser.js";

interface ExtractedDateTime {
    date: string;
    time: string;
}

interface RouteTableData {
    seat?: string;
    routeName?: string;
    tripNumber?: string;
    platform?: string;
}

export class BusforBusTicketPdfParser implements BusTicketPdfParser {

    readonly id = "busfor-russia-v1";
    readonly version = "1.0.0";

    detect(analysis: PdfAnalysisResult): PdfParserDetection {
        const text = analysis.normalizedText;
        const matchedMarkers: string[] = [];

        this.addMarker(
            matchedMarkers,
            text,
            /Маршрутная квитанция электронного билета/i,
            "BUSFOR_ITINERARY_RECEIPT"
        );

        this.addMarker(
            matchedMarkers,
            text,
            /E-Ticket itinerary receipt/i,
            "ETICKET_ITINERARY_RECEIPT"
        );

        this.addMarker(
            matchedMarkers,
            text,
            /\bBUSFOR(?:\.RU)?\b/i,
            "BUSFOR"
        );

        this.addMarker(
            matchedMarkers,
            text,
            /ООО\s+Басфор/i,
            "BUSFOR_AGENT"
        );

        this.addMarker(
            matchedMarkers,
            text,
            /ПРОЕЗДНОЙ ДОКУМЕНТ НА АВТОБУС\s*\/\s*BUS TICKET/i,
            "BUS_TICKET"
        );

        let confidence = 0;

        if (matchedMarkers.includes("BUSFOR_ITINERARY_RECEIPT")) {
            confidence += 35;
        }

        if (matchedMarkers.includes("ETICKET_ITINERARY_RECEIPT")) {
            confidence += 15;
        }

        if (matchedMarkers.includes("BUSFOR")) {
            confidence += 20;
        }

        if (matchedMarkers.includes("BUSFOR_AGENT")
        ) {
            confidence += 15;
        }

        if (matchedMarkers.includes("BUS_TICKET")) {
            confidence += 25;
        }

        confidence = Math.min(confidence, 100);

        return {
            supported: confidence >= 60,
            confidence,
            matchedMarkers
        };
    }

    parse(analysis: PdfAnalysisResult, detection: PdfParserDetection): ParsedBusTicketDocument {
        const lines = analysis.lines
            .map((line) => this.cleanText(line))
            .filter(Boolean);

        const compactText = this.compact(analysis.normalizedText);
        const itineraryNumbers = this.extractItineraryNumbers(compactText);
        const carrierTicketNumber = this.extractFirstGroup(compactText, /BUS TICKET\s*№\s*(\d+)/i);
        const controlNumber = this.extractControlNumber(compactText, itineraryNumbers);

        const passengerName = this.findFullNameAfterMarker(lines, /ФАМИЛИЯ ПАССАЖИРА|NAME OF PASSENGER/i) ??
            this.findFullNameAfterMarker(lines, /^Пассажир$/i);

        const passengerDocument = this.extractPassport(compactText);
        const personData = this.extractPersonData(compactText);
        const routeTable = this.extractRouteTable(lines, compactText);
        const routeName = routeTable.routeName ?? this.findBestRouteName(lines);
        const routeCities = this.splitRoute(routeName);
        const itineraryPurchaseDateTime = this.findDateTimeAfterMarker(lines, /Дата покупки/i, 12);
        const allDateTimes = this.extractDateTimes(compactText);
        const carrierSaleDateTime = this.findAlternativePurchaseDateTime(allDateTimes, itineraryPurchaseDateTime);

        const departureDateTime = this.findDateTimeAfterMarker(lines, /^Отправление$/i, 40) ??
            this.findDepartureDateTime(allDateTimes, itineraryPurchaseDateTime, carrierSaleDateTime);

        const arrivalDate = this.extractArrivalDate(lines, compactText, departureDateTime, itineraryPurchaseDateTime);
        const arrivalTime = this.extractArrivalTime(lines, compactText, departureDateTime, itineraryPurchaseDateTime, carrierSaleDateTime);
        const carrierName = this.findFullNameAfterMarker(lines, /ПЕРЕВОЗЧИК|CARRIER/i);
        const ticketType = this.findValueAfterMarker(lines, /^Тип билета$/i, (value) => /^(Полный|Детский|Льготный)$/i.test(value), 10);
        const vehicleType = this.findValueAfterMarker(lines, /^Вид транспортного средства$/i, (value) => /\bавтобус\b/i.test(value), 10);
        const itineraryTotal = this.findMoneyAfterMarker(lines, /Итого сумма платежа/i, 8);
        const fareComponents = this.extractFareComponents(compactText);
        const baseFare = fareComponents.find((component) => component.code === "ТАРИФ")?.amount ??
            this.findMoneyAfterMarker(lines, /^Тариф$/i, 12);

        const allMoneyValues = this.extractMoneyValues(compactText);
        const carrierTicketTotal = allMoneyValues.length > 0
            ? Math.max(...allMoneyValues)
            : undefined;

        const currency = /\bRUB\b/i.test(compactText)
            ? "RUB"
            : undefined;

        const paymentMethod = this.extractPaymentMethod(compactText);
        const warnings = this.createWarnings({ passengerName, itineraryTotal, carrierTicketTotal, itineraryPurchaseDateTime, carrierSaleDateTime });

        this.validateCriticalFields({
            carrierTicketNumber,
            itineraryNumber:
                itineraryNumbers?.itineraryNumber,
            // passengerName,
            routeName
        });

        const trip: BusTicketTrip = {
            routeName,
            tripNumber: routeTable.tripNumber,
            seat: routeTable.seat,
            platform: routeTable.platform,

            departure: {
                city: routeCities.departureCity,
                date: departureDateTime
                    ? this.toIsoDate(
                        departureDateTime.date
                    )
                    : undefined,
                time:
                    departureDateTime?.time
            },

            arrival: {
                city: routeCities.arrivalCity,
                date: arrivalDate
                    ? this.toIsoDate(arrivalDate)
                    : undefined,
                time: arrivalTime
            },

            carrier: {
                name: carrierName
            }
        };

        return {
            schemaVersion: "1.0",
            documentType: "BUS_TICKET",

            parser: {
                id: this.id,
                version: this.version,
                confidence: detection.confidence
            },

            source: {
                filename: analysis.filename,
                checksum: analysis.checksum,
                size: analysis.size,
                pageCount: analysis.pageCount,
                pageNumber: analysis.pageNumber,
                metadata: analysis.metadata
            },

            provider: {
                name: "BUSFOR",
                agent:
                    /ООО\s+Басфор/i.test(compactText)
                        ? "ООО Басфор"
                        : undefined,
                website:
                    /busfor\.ru/i.test(compactText)
                        ? "busfor.ru"
                        : undefined
            },

            identifiers: {
                carrierTicketNumber,

                itinerarySeries:
                    itineraryNumbers
                        ?.itinerarySeries,

                itineraryNumber:
                    itineraryNumbers
                        ?.itineraryNumber,

                controlNumber
            },

            ticket: {
                type: ticketType,
                vehicleType
            },

            passenger: {
                fullName: passengerName,

                document: passengerDocument
                    ? {
                        type: "PASSPORT",
                        number:
                            passengerDocument,
                        rawType: "Паспорт"
                    }
                    : undefined,

                gender: personData.gender,

                birthDate:
                    personData.birthDate
                        ? this.toIsoDate(
                            personData.birthDate
                        )
                        : undefined,

                nationality:
                    personData.nationality
            },

            trip,

            purchase: {
                agentIssuedAt:
                    itineraryPurchaseDateTime
                        ? {
                            date: this.toIsoDate(
                                itineraryPurchaseDateTime.date
                            ),
                            time:
                                itineraryPurchaseDateTime.time
                        }
                        : undefined,

                carrierSaleAt:
                    carrierSaleDateTime
                        ? {
                            date: this.toIsoDate(
                                carrierSaleDateTime.date
                            ),
                            time:
                                carrierSaleDateTime.time
                        }
                        : undefined,

                paymentMethod
            },

            pricing: {
                currency,
                baseFare,

                total:
                    carrierTicketTotal ??
                    itineraryTotal,

                totalSource:
                    carrierTicketTotal !== undefined &&
                        itineraryTotal !== undefined &&
                        carrierTicketTotal >
                        itineraryTotal
                        ? "CARRIER_TICKET"
                        : itineraryTotal !== undefined
                            ? "ITINERARY_RECEIPT"
                            : "UNKNOWN",

                itineraryReceiptTotal:
                    itineraryTotal,

                components:
                    fareComponents.map(
                        (component) => ({
                            ...component,
                            currency:
                                component.currency ||
                                currency ||
                                "RUB"
                        })
                    )
            },

            warnings
        };
    }

    private addMarker(
        result: string[],
        text: string,
        expression: RegExp,
        marker: string
    ): void {
        if (expression.test(text)) {
            result.push(marker);
        }
    }

    private extractItineraryNumbers(
        text: string
    ): {
        itinerarySeries: string;
        itineraryNumber: string;
    } | undefined {
        const match = text.match(
            /\b(\d{8,12})\s*\/\s*(\d{5,10})\b/
        );

        if (!match) {
            return undefined;
        }

        return {
            itinerarySeries: match[1],
            itineraryNumber: match[2]
        };
    }

    private extractControlNumber(
        text: string,
        itineraryNumbers:
            | {
                itinerarySeries: string;
                itineraryNumber: string;
            }
            | undefined
    ): string | undefined {
        const match = text.match(
            /КОНТРОЛЬНЫЙ НОМЕР\s*\/\s*CHECK NUMBER[\s\S]{0,150}?(\d{8,12})\s+(\d{5,10})/i
        );

        if (match) {
            return `${match[1]} ${match[2]}`;
        }

        if (!itineraryNumbers) {
            return undefined;
        }

        return (
            `${itineraryNumbers.itinerarySeries} ` +
            itineraryNumbers.itineraryNumber
        );
    }

    private extractPassport(
        text: string
    ): string | undefined {
        const match = text.match(
            /Паспорт\s+(\d{4})\s*(\d{6})/i
        );

        if (!match) {
            return undefined;
        }

        return `${match[1]}${match[2]}`;
    }

    private extractPersonData(
        text: string
    ): {
        gender:
        | "MALE"
        | "FEMALE"
        | "UNKNOWN";
        birthDate?: string;
        nationality?: string;
    } {
        const match = text.match(/(?:^|[^А-Яа-яЁё])(Мужской|Женский)\s+(\d{2}\.\d{2}\.\d{4})\s+([А-Яа-яЁё-]{2,40})(?=$|[^А-Яа-яЁё])/iu);

        if (!match) {
            return {
                gender: "UNKNOWN"
            };
        }

        return {
            gender:
                match[1].toLowerCase() ===
                    "мужской"
                    ? "MALE"
                    : "FEMALE",

            birthDate: match[2],
            nationality:
                this.normalizeNationality(
                    match[3]
                )
        };
    }

    private extractRouteTable(
        lines: string[],
        compactText: string
    ): RouteTableData {
        const rowMatch = compactText.match(
            /Место\s+Маршрут\s+Номер\s+Платформа\s+(\d+)\s+(.{3,150}?)\s+(\d{1,8})\s+(\d{1,4})\s+Отправление/i
        );

        if (rowMatch) {
            return {
                seat: rowMatch[1],
                routeName:
                    this.cleanRouteName(
                        rowMatch[2]
                    ),
                tripNumber: rowMatch[3],
                platform: rowMatch[4]
            };
        }

        const section = this.extractLinesSection(
            lines,
            /Информация о рейсе/i,
            /Информация о платеже/i
        );

        const seat =
            this.findIntegerAfterExactMarker(
                section,
                /^Место$/i,
                3
            );

        const numberIndex =
            section.findIndex(
                (line) => /^Номер$/i.test(line)
            );

        const platformIndex =
            section.findIndex(
                (line) =>
                    /^Платформа$/i.test(line)
            );

        let tripNumber: string | undefined;
        let platform: string | undefined;

        if (
            numberIndex >= 0 &&
            platformIndex >= 0
        ) {
            const values = section
                .slice(
                    Math.max(
                        numberIndex,
                        platformIndex
                    ) + 1
                )
                .filter(
                    (line) => /^\d+$/.test(line)
                );

            tripNumber = values[0];
            platform = values[1];
        }

        return {
            seat,
            tripNumber,
            platform
        };
    }

    private findBestRouteName(
        lines: string[]
    ): string | undefined {
        const candidates =
            new Map<string, number>();

        for (const sourceLine of lines) {
            const line = sourceLine
                .replace(/^\d+\s+/, "")
                .replace(
                    /\s+\d+\s+\d+$/,
                    ""
                )
                .trim();

            const match = line.match(
                /^([\p{L}][\p{L}\s.'-]{1,80})\s+-\s+([\p{L}][\p{L}\s.'-]{1,120})$/u
            );

            if (!match) {
                continue;
            }

            const candidate =
                this.cleanRouteName(
                    `${match[1]} - ${match[2]}`
                );

            if (
                /Автовокзал|улица|дом\s+\d+/i.test(
                    candidate
                )
            ) {
                continue;
            }

            candidates.set(
                candidate,
                (candidates.get(candidate) ?? 0) + 1
            );
        }

        return [...candidates.entries()]
            .sort(
                ([firstName, firstCount],
                    [secondName, secondCount]) =>
                    secondCount - firstCount ||
                    firstName.length -
                    secondName.length
            )[0]?.[0];
    }

    private splitRoute(
        routeName: string | undefined
    ): {
        departureCity?: string;
        arrivalCity?: string;
    } {
        if (!routeName) {
            return {};
        }

        const parts = routeName.split(
            /\s+-\s+/
        );

        if (parts.length < 2) {
            return {};
        }

        return {
            departureCity: parts[0].trim(),
            arrivalCity: parts
                .slice(1)
                .join(" - ")
                .trim()
        };
    }

    private findAlternativePurchaseDateTime(
        allDateTimes: ExtractedDateTime[],
        primary:
            | ExtractedDateTime
            | undefined
    ): ExtractedDateTime | undefined {
        if (!primary) {
            return undefined;
        }

        return allDateTimes.find(
            (value) =>
                value.date === primary.date &&
                value.time !== primary.time
        );
    }

    private findDepartureDateTime(
        allDateTimes: ExtractedDateTime[],
        purchase:
            | ExtractedDateTime
            | undefined,
        carrierSale:
            | ExtractedDateTime
            | undefined
    ): ExtractedDateTime | undefined {
        const excluded = new Set<string>();

        if (purchase) {
            excluded.add(
                `${purchase.date} ${purchase.time}`
            );
        }

        if (carrierSale) {
            excluded.add(
                `${carrierSale.date} ${carrierSale.time}`
            );
        }

        const candidates = allDateTimes
            .filter(
                (value) =>
                    !excluded.has(
                        `${value.date} ${value.time}`
                    )
            )
            .sort(
                (first, second) =>
                    this.dateTimeKey(first) -
                    this.dateTimeKey(second)
            );

        return candidates[0];
    }

    private extractArrivalDate(
        lines: string[],
        compactText: string,
        departure:
            | ExtractedDateTime
            | undefined,
        purchase:
            | ExtractedDateTime
            | undefined
    ): string | undefined {
        const markerDate =
            this.findDateAfterMarker(
                lines,
                /ПРИБЫТИЕ|ARRIVAL/i,
                25
            );

        if (
            markerDate &&
            markerDate !== departure?.date &&
            markerDate !== purchase?.date
        ) {
            return markerDate;
        }

        if (!departure) {
            return undefined;
        }

        return this.extractDates(compactText)
            .filter(
                (date) =>
                    this.dateKey(date) >
                    this.dateKey(
                        departure.date
                    )
            )
            .sort(
                (first, second) =>
                    this.dateKey(first) -
                    this.dateKey(second)
            )[0];
    }

    private extractArrivalTime(
        lines: string[],
        compactText: string,
        departure:
            | ExtractedDateTime
            | undefined,
        purchase:
            | ExtractedDateTime
            | undefined,
        carrierSale:
            | ExtractedDateTime
            | undefined
    ): string | undefined {
        const excludedTimes = new Set(
            [
                departure?.time,
                purchase?.time,
                carrierSale?.time
            ].filter(
                (value): value is string =>
                    Boolean(value)
            )
        );

        const markerTimes =
            this.findTimesNearMarker(
                lines,
                /ПРИБЫТИЕ|ARRIVAL/i,
                30
            );

        const markerCandidate =
            markerTimes.find(
                (time) =>
                    !excludedTimes.has(time)
            );

        if (markerCandidate) {
            return markerCandidate;
        }

        return this.extractTimes(compactText)
            .find(
                (time) =>
                    !excludedTimes.has(time)
            );
    }

    private extractFareComponents(compactText: string): BusTicketPriceComponent[] {
        const start = compactText.search(/РАСЧЕТ СТОИМОСТИ\s*\/\s*FARE CALCULATION/i);

        if (start < 0) {
            return [];
        }

        const endMarker = compactText.slice(start).search(/ПОЛ\s*\/\s*GENDER/i);

        const end = endMarker >= 0 ? start + endMarker : Math.min(compactText.length, start + 1200);

        const block = compactText.slice(start, end);

        const codes = ["ТАРИФ", "КСБ", "ИНФ"]
            .filter((code) => new RegExp(`(?:^|\\s)${code}(?=\\s|$)`, "i").test(block));

        const amounts = this.extractMoneyValues(block);

        const uniqueAmounts = amounts
            .filter((amount, index) => amounts.indexOf(amount) === index);

        return codes
            .map((code, index) => {
                const amount =
                    uniqueAmounts[index];

                if (amount === undefined) {
                    return undefined;
                }

                return {
                    code,
                    amount,
                    currency: "RUB"
                };
            })
            .filter(
                (
                    value
                ): value is BusTicketPriceComponent =>
                    value !== undefined
            );
    }

    private extractPaymentMethod(text: string): BusTicketPaymentMethod {
        if (/Наличный/i.test(text)) {
            return "CASH";
        }

        if (
            /Банковская карта|Карта|CARD/i.test(
                text
            )
        ) {
            return "CARD";
        }

        if (
            /Безналичный|BANK TRANSFER/i.test(
                text
            )
        ) {
            return "BANK_TRANSFER";
        }

        return "UNKNOWN";
    }

    private createWarnings(data: {
        passengerName?: string; itineraryTotal?: number; carrierTicketTotal?: number; itineraryPurchaseDateTime?: ExtractedDateTime; carrierSaleDateTime?: ExtractedDateTime;
    }): Array<{
        code: string;
        message: string;
    }> {
        const warnings: Array<{
            code: string;
            message: string;
        }> = [];

        if (!data.passengerName) {
            warnings.push({
                code: "PASSENGER_NAME_NOT_FOUND",
                message: "Не удалось извлечь ФИО пассажира"
            });
        }

        if (
            data.itineraryTotal !== undefined &&
            data.carrierTicketTotal !== undefined &&
            Math.abs(
                data.itineraryTotal -
                data.carrierTicketTotal
            ) > 0.01
        ) {
            warnings.push({
                code: "DECLARED_TOTALS_DIFFER",

                message:
                    `Маршрутная квитанция содержит сумму ` +
                    `${data.itineraryTotal.toFixed(2)}, ` +
                    `проездной документ — ` +
                    `${data.carrierTicketTotal.toFixed(2)}`
            });
        }

        if (
            data.itineraryPurchaseDateTime &&
            data.carrierSaleDateTime &&
            (
                data.itineraryPurchaseDateTime.date !==
                data.carrierSaleDateTime.date ||
                data.itineraryPurchaseDateTime.time !==
                data.carrierSaleDateTime.time
            )
        ) {
            warnings.push({
                code: "PURCHASE_TIMES_DIFFER",

                message:
                    `В документах указано время покупки ` +
                    `${data.itineraryPurchaseDateTime.time} ` +
                    `и время продажи ` +
                    `${data.carrierSaleDateTime.time}`
            });
        }

        return warnings;
    }

    private validateCriticalFields(data: {
        carrierTicketNumber?: string;
        itineraryNumber?: string;
        // passengerName?: string;
        routeName?: string;
    }): void {
        const missingFields: string[] = [];

        if (
            !data.carrierTicketNumber &&
            !data.itineraryNumber
        ) {
            missingFields.push("ticket number");
        }

        // if (!data.passengerName) {
        //     missingFields.push(
        //         "passenger name"
        //     );
        // }

        if (!data.routeName) {
            missingFields.push("route");
        }

        if (missingFields.length > 0) {
            throw new Error(
                `Busfor PDF was detected, but critical fields ` +
                `could not be extracted: ` +
                missingFields.join(", ")
            );
        }
    }

    private findFullNameAfterMarker(
        lines: string[],
        marker: RegExp,
        maxDistance = 20
    ): string | undefined {
        for (
            let markerIndex = 0;
            markerIndex < lines.length;
            markerIndex++
        ) {
            /*
             * Сбрасываем lastIndex на случай, если позднее
             * сюда будет передан RegExp с флагом g.
             */
            marker.lastIndex = 0;

            if (!marker.test(lines[markerIndex])) {
                continue;
            }

            /*
             * Иногда заголовок и значение находятся
             * в одной строке.
             */
            marker.lastIndex = 0;

            const lineWithoutMarker = lines[markerIndex]
                .replace(marker, " ")
                .trim();

            const inlineName =
                this.extractRussianFullName(
                    lineWithoutMarker
                );

            if (inlineName) {
                return inlineName;
            }

            const end = Math.min(
                lines.length,
                markerIndex + maxDistance + 1
            );

            /*
             * Начинаем со следующей строки, чтобы заголовок
             * "ФАМИЛИЯ ПАССАЖИРА" не был принят за имя.
             */
            for (
                let index = markerIndex + 1;
                index < end;
                index++
            ) {
                const passengerName =
                    this.extractRussianFullName(
                        lines[index]
                    );

                if (passengerName) {
                    return passengerName;
                }
            }
        }

        return undefined;
    }

    private extractRussianFullName(value: string): string | undefined {
        const normalizedValue = this.cleanText(value);

        /*
         * Поддерживает:
         *
         * Каршанинников Андрей Яковлевич
         * КАРШАНИННИКОВ АНДРЕЙ ЯКОВЛЕВИЧ
         *
         * Также извлечёт ФИО из строки:
         *
         * Каршанинников Андрей Яковлевич Паспорт
         */
        const match = normalizedValue.match(/(?:^|[^А-Яа-яЁё-])([А-ЯЁ][А-Яа-яЁё-]+(?:\s+[А-ЯЁ][А-Яа-яЁё-]+){2})(?=$|[^А-Яа-яЁё-])/u);
        return match?.[1];
    }

    private findValueAfterMarker(lines: string[], marker: RegExp, predicate: (value: string) => boolean, maxDistance: number): string | undefined {
        for (let markerIndex = 0; markerIndex < lines.length; markerIndex++) {
            if (!marker.test(lines[markerIndex])) {
                continue;
            }

            const end = Math.min(lines.length, markerIndex + maxDistance + 1);

            for (let index = markerIndex; index < end; index++) {
                if (predicate(lines[index])) {
                    return lines[index];
                }
            }
        }

        return undefined;
    }

    private findDateTimeAfterMarker(lines: string[], marker: RegExp, maxDistance: number): ExtractedDateTime | undefined {
        for (let markerIndex = 0; markerIndex < lines.length; markerIndex++) {
            if (!marker.test(lines[markerIndex])) {
                continue;
            }

            const end = Math.min(lines.length, markerIndex + maxDistance + 1);

            for (let index = markerIndex; index < end; index++) {
                const match = lines[index].match(/(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/);

                if (match) {
                    return { date: match[1], time: match[2] };
                }
            }
        }

        return undefined;
    }

    private findDateAfterMarker(lines: string[], marker: RegExp, maxDistance: number): string | undefined {
        for (let markerIndex = 0; markerIndex < lines.length; markerIndex++) {
            if (!marker.test(lines[markerIndex])) {
                continue;
            }

            const end = Math.min(lines.length, markerIndex + maxDistance + 1);

            for (let index = markerIndex; index < end; index++) {
                const match = lines[index].match(/\b\d{2}\.\d{2}\.\d{4}\b/);

                if (match) {
                    return match[0];
                }
            }
        }

        return undefined;
    }

    private findTimesNearMarker(
        lines: string[],
        marker: RegExp,
        maxDistance: number
    ): string[] {
        const result: string[] = [];

        for (let markerIndex = 0; markerIndex < lines.length; markerIndex++) {
            if (!marker.test(lines[markerIndex])) {
                continue;
            }

            const start = Math.max(0, markerIndex - 5);

            const end = Math.min(lines.length, markerIndex + maxDistance + 1);

            for (let index = start; index < end; index++) {
                const matches = lines[index].match(/\b\d{2}:\d{2}\b/g) ?? [];

                result.push(...matches);
            }
        }

        return [...new Set(result)];
    }

    private findMoneyAfterMarker(lines: string[], marker: RegExp, maxDistance: number): number | undefined {
        for (let markerIndex = 0; markerIndex < lines.length; markerIndex++) {
            if (!marker.test(lines[markerIndex])) {
                continue;
            }

            const end = Math.min(lines.length, markerIndex + maxDistance + 1);
            for (let index = markerIndex; index < end; index++) {
                const value =
                    this.extractMoneyValues(
                        lines[index]
                    )[0];

                if (value !== undefined) {
                    return value;
                }
            }
        }

        return undefined;
    }

    private findIntegerAfterExactMarker(lines: string[], marker: RegExp, maxDistance: number): string | undefined {
        const markerIndex = lines.findIndex((line) => marker.test(line));

        if (markerIndex < 0) {
            return undefined;
        }

        const end = Math.min(lines.length, markerIndex + maxDistance + 1);
        for (let index = markerIndex + 1; index < end; index++) {
            if (/^\d+$/.test(lines[index])) {
                return lines[index];
            }
        }

        return undefined;
    }

    private extractLinesSection(lines: string[], startMarker: RegExp, endMarker: RegExp): string[] {
        const startIndex = lines.findIndex((line) => startMarker.test(line));

        if (startIndex < 0) {
            return [];
        }

        const relativeEndIndex = lines.slice(startIndex + 1).findIndex((line) => endMarker.test(line));
        const endIndex = relativeEndIndex < 0 ? lines.length : startIndex + relativeEndIndex + 1;

        return lines.slice(
            startIndex,
            endIndex
        );
    }

    private extractDateTimes(text: string): ExtractedDateTime[] {
        const result: ExtractedDateTime[] = [];

        const expression = /(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/g;

        for (const match of text.matchAll(expression)) {
            const value = { date: match[1], time: match[2] };

            if (!result.some((existing) => existing.date === value.date && existing.time === value.time)) {
                result.push(value);
            }
        }

        return result;
    }

    private extractDates(text: string): string[] {
        return [...new Set(text.match(/\b\d{2}\.\d{2}\.\d{4}\b/g) ?? [])];
    }

    private extractTimes(text: string): string[] {
        return [...new Set(text.match(/\b\d{2}:\d{2}\b/g) ?? [])];
    }

    private extractMoneyValues(text: string): number[] {
        const textWithoutDates = text.replace(/\b\d{2}\.\d{2}\.\d{4}\b/g, " ").replace(/\b\d{2}:\d{2}\b/g, " ");
        const matches = textWithoutDates.match(/(?<!\d)\d{1,7}[.,]\d{2}(?!\d)/g) ?? [];
        return matches.map((value) => Number(value.replace(",", ".")))
            .filter(Number.isFinite);
    }

    private extractFirstGroup(text: string, expression: RegExp): string | undefined {
        return text.match(expression)?.[1];
    }

    private normalizeNationality(value: string): string {
        const normalized = value.trim().toLowerCase();

        return (
            normalized.charAt(0).toUpperCase() +
            normalized.slice(1)
        );
    }

    private cleanRouteName(value: string): string {
        return value
            .replace(/\s+/g, " ")
            .trim();
    }

    private cleanText(value: string): string {
        return value
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    private compact(
        value: string
    ): string {
        return this.cleanText(value);
    }

    private toIsoDate(value: string): string {
        const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

        if (!match) {
            throw new Error(`Unsupported date format: "${value}"`);
        }

        return `${match[3]}-${match[2]}-${match[1]}`;
    }

    private dateKey(value: string): number {
        const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (!match) {
            return Number.MAX_SAFE_INTEGER;
        }

        return (Number(match[3]) * 10_000 + Number(match[2]) * 100 + Number(match[1]));
    }

    private dateTimeKey(value: ExtractedDateTime): number {
        const timeMatch = value.time.match(/^(\d{2}):(\d{2})$/);
        const minutes = timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : 0;
        return (this.dateKey(value.date) * 24 * 60 + minutes);
    }
}