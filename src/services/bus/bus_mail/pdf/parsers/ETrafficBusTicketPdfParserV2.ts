import { BusTicketPaymentMethod, BusTicketPriceComponent, ParsedBusTicketDocument } from "../types/BusTicketTypes.js";
import { PdfAnalysisResult } from "../types/PdfTypes.js";
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

export class ETrafficBusTicketPdfParserV2 implements BusTicketPdfParser {

    readonly id = "e-traffic-russia-v2";
    readonly version = "1.0.0";

    detect(
        analysis: PdfAnalysisResult
    ): PdfParserDetection {
        const text = this.normalizeText(
            analysis.normalizedText
        );

        const matchedMarkers: string[] = [];
        let confidence = 0;

        const addMarker = (
            expression: RegExp,
            marker: string,
            score: number
        ): void => {
            expression.lastIndex = 0;

            if (!expression.test(text)) {
                return;
            }

            matchedMarkers.push(marker);
            confidence += score;
        };

        /*
         * Брендовые признаки.
         * Между частями названия могут находиться пробелы,
         * переносы строк и разные варианты дефиса.
         */
        addMarker(
            /(?:www\.)?e[\s-]*traffic(?:\s*\.\s*ru)?/iu,
            "E_TRAFFIC",
            30
        );

        addMarker(
            /ГК\s+Пять\s+Звезд/iu,
            "FIVE_STARS_AGENT",
            25
        );

        /*
         * Структурные признаки именно этого документа.
         */
        addMarker(
            /Идентификатор\s+квитанции/iu,
            "RECEIPT_IDENTIFIER",
            15
        );

        addMarker(
            /Информация\s+о\s+пассажире\s+и\s+тарифе/iu,
            "PASSENGER_SECTION",
            15
        );

        addMarker(
            /Информация\s+о\s+рейсе/iu,
            "TRIP_SECTION",
            10
        );

        addMarker(
            /Информация\s+о\s+платеже/iu,
            "PAYMENT_SECTION",
            10
        );

        addMarker(
            /Рейс\s+Номер\s+Платформа\s+Место\s+Перевозчик/iu,
            "ROUTE_TABLE",
            15
        );

        addMarker(
            /Итого\s+сумма\s+платежа/iu,
            "PAYMENT_TOTAL",
            10
        );

        addMarker(
            /Автобус\s+\d+\s+мест|Багажное\s+место/iu,
            "TICKET_LAYOUT",
            10
        );

        confidence = Math.min(
            confidence,
            100
        );

        const hasProviderMarker =
            matchedMarkers.includes("E_TRAFFIC") ||
            matchedMarkers.includes("FIVE_STARS_AGENT");

        const structuralMarkerCount = [
            "RECEIPT_IDENTIFIER",
            "PASSENGER_SECTION",
            "TRIP_SECTION",
            "PAYMENT_SECTION",
            "ROUTE_TABLE",
            "PAYMENT_TOTAL"
        ].filter(
            (marker) =>
                matchedMarkers.includes(marker)
        ).length;

        return {
            supported:
                hasProviderMarker &&
                structuralMarkerCount >= 3 &&
                confidence >= 60,

            confidence,
            matchedMarkers
        };
    }

    parse(analysis: PdfAnalysisResult, detection: PdfParserDetection): ParsedBusTicketDocument {
        const text = this.normalizeText(analysis.normalizedText);
        const lines = analysis.lines.map((line) => this.cleanText(line)).filter(Boolean);

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
                /Идентификатор квитанции\s+(\d{6,10})/i
            ) ??
            this.findNumericAfterMarker(
                lines,
                /^Идентификатор квитанции$/i,
                6,
                10,
                4
            ) ??
            this.findNumericBeforeMarker(
                lines,
                /^Идентификатор квитанции$/i,
                6,
                10,
                15
            );

        const ticketSeries =
            this.extractFirstGroup(
                text,
                /Серия билета\s+(\d{8,15})/i
            ) ??
            this.findNumericAfterMarker(
                lines,
                /^Серия билета$/i,
                8,
                15,
                60
            );

        const ticketNumber =
            this.extractFirstGroup(
                text,
                /Номер билета\s+(\d{3,8})/i
            ) ??
            this.findNumericAfterMarker(
                lines,
                /^Номер билета$/i,
                3,
                8,
                60
            );

        const agent =
            this.extractAgentFromLines(
                lines
            );

        const purchaseDateTime =
            this.extractDateTime(
                text,
                /Дата покупки\s+(\d{2}\.\d{2}\.\d{2,4})\s+(\d{2}:\d{2})/i
            ) ??
            this.findDateTimeBeforeMarker(
                lines,
                /^Дата покупки$/i,
                10
            ) ??
            this.findDateTimeAfterMarker(
                lines,
                /^Дата покупки$/i,
                10
            );

        const ticketType =
            this.extractFirstGroup(
                text,
                /Тип билета\s+(ПОЛНЫЙ|ДЕТСКИЙ|ЛЬГОТНЫЙ|БАГАЖНЫЙ)/i
            ) ??
            this.findLineAfterMarker(
                lines,
                /^Тип билета$/i,
                (line) =>
                    /^(?:ПОЛНЫЙ|ДЕТСКИЙ|ЛЬГОТНЫЙ|БАГАЖНЫЙ)$/i
                        .test(line),
                60
            );

        const vehicleType = this.extractVehicleType(text, lines);

        // const passengerName =
        //     this.extractRussianFullName(
        //         passengerSection
        //     ) ??
        //     this.extractPassengerNameWithInitials(
        //         text
        //     );

        const passengerName =
            this.extractPassengerNameWithInitials(
                passengerSection
            ) ??
            this.extractRussianFullName(
                passengerSection
            ) ??
            this.extractOcrPassengerName(
                text
            );

        const passengerDocument =
            this.extractPassengerDocument(
                passengerSection
            );

        const forwardTripPoints = this.extractTripPointsFromForwardLayout(text) ?? this.extractTripPointsFromOcrLayout(text);
        const route = this.extractRouteDataV2(text, forwardTripPoints);
        const routeParts = this.splitRoute(route.routeName);
        const tripPoints = forwardTripPoints ?? this.extractTripPointsFromText(text, routeParts.departureStation, routeParts.arrivalStation);

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
                        routeParts.departureStation ??
                        tripPoints.departureStation,

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
                        routeParts.arrivalStation ??
                        tripPoints.arrivalStation,

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

    private extractVehicleType(text: string, lines: string[]): string | undefined {
        /*
         * Возможные варианты:
         *
         * Автобус 43 места ( Баг: 86, Стоя: 0 )
         * Автобус 27 мест ( Баг: 54, Стоя: 0 )
         * Автобус 32 места
         */
        const structuredMatch = text.match(/\b(Автобус\s+\d+\s+мест(?:о|а)?(?:\s*\(\s*Баг:\s*\d+\s*,\s*Стоя:\s*\d+\s*\))?)/iu);

        if (structuredMatch?.[1]) {
            return this.cleanText(structuredMatch[1]);
        }

        const vehicleLine = lines.find(
            (line) =>
                /^Автобус\s+\d+\s+мест(?:о|а)?/iu.test(
                    line
                )
        );

        return vehicleLine
            ? this.cleanText(vehicleLine)
            : undefined;
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

    // private extractRussianFullName(
    //     value: string
    // ): string | undefined {
    //     const normalizedValue =
    //         this.cleanText(value);

    //     const match = normalizedValue.match(
    //         /(?:^|[^А-Яа-яЁё-])([А-ЯЁ][А-Яа-яЁё-]+(?:\s+[А-ЯЁ][А-Яа-яЁё-]+){2})(?=$|[^А-Яа-яЁё-])/u
    //     );

    //     return match?.[1];
    // }

    private extractRussianFullName(
        value: string
    ): string | undefined {
        const normalizedValue =
            this.cleanText(value);

        const match =
            normalizedValue.match(
                /(?:^|[^А-Яа-яЁё-])([А-ЯЁ][А-Яа-яЁё-]+(?:\s+[А-ЯЁ][А-Яа-яЁё-]+){2})(?=$|[^А-Яа-яЁё-])/u
            );

        const candidate =
            match?.[1]
                ? this.cleanText(
                    match[1]
                )
                : undefined;

        if (!candidate) {
            return undefined;
        }

        /*
         * OCR может принять заголовок таблицы за ФИО:
         *
         * Пассажир Паспорт Тариф
         */
        const forbiddenWords = [
            "пассажир",
            "паспорт",
            "тариф",
            "комиссия",
            "итого",
            "перевозчик",
            "платформа",
            "номер"
        ];

        const words =
            candidate
                .toLocaleLowerCase("ru")
                .split(/\s+/);

        if (
            words.some(
                (word) =>
                    forbiddenWords.includes(word)
            )
        ) {
            return undefined;
        }

        return candidate;
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
                /(?<!\d)(?:\d{1,3}(?:[ \u00A0]\d{3})+|\d{1,9})[.,]\d{2}(?!\d)/g
            ) ?? [];

        return matches
            .map((value) =>
                Number(
                    value
                        .replace(
                            /[ \u00A0]/g,
                            ""
                        )
                        .replace(",", ".")
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

    private validateCriticalFields(data: { receiptId?: string; ticketNumber?: string; routeName?: string; }): void {
        const missingFields: string[] = [];

        if (!data.receiptId && !data.ticketNumber) {
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
    private extractPassengerNameWithInitials(text: string): string | undefined {
        const match = text.match(/(?:^|\s)([А-ЯЁ][А-Яа-яЁё-]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.)(?=\s|\/|$)/u);
        return match?.[1]
            ? this.cleanText(match[1])
            : undefined;
    }

    private extractTripPointsFromText(
        text: string,
        expectedDepartureStation?: string,
        expectedArrivalStation?: string
    ): ETrafficTripPoints {
        /*
         * Фактический порядок текстового слоя:
         *
         * дата прибытия
         * время прибытия
         * пункт прибытия
         * дата отправления
         * время отправления
         * пункт отправления и адрес
         */
        const match = text.match(
            /Оплачено\s+(\d{2}\.\d{2}\.\d{2,4})\s+(\d{2}:\d{2})\s+(.+?)\s+(\d{2}\.\d{2}\.\d{2,4})\s+(\d{2}:\d{2})\s+(.+?)\s+Дата\s+прибытия\s+Пункт\s+прибытия\s+Дата\s+отправления\s+Пункт\s+отправления/iu
        );

        if (!match) {
            return {};
        }

        const arrivalDate =
            match[1];

        const arrivalTime =
            match[2];

        const arrivalLocationRaw =
            this.cleanText(
                match[3]
            );

        const departureDate =
            match[4];

        const departureTime =
            match[5];

        const departureLocationRaw =
            this.cleanText(
                match[6]
            );

        const departureLocation =
            this.splitStationAndAddressFlexible(
                departureLocationRaw,
                expectedDepartureStation
            );

        const arrivalLocation =
            this.splitStationAndAddressFlexible(
                arrivalLocationRaw,
                expectedArrivalStation
            );

        return {
            departureStation:
                departureLocation.station ??
                expectedDepartureStation,

            departureAddress:
                departureLocation.address,

            departureDate,
            departureTime,

            arrivalStation:
                arrivalLocation.station ??
                expectedArrivalStation,

            arrivalAddress:
                arrivalLocation.address,

            arrivalDate,
            arrivalTime
        };
    }

    private splitStationAndAddressFlexible(
        sourceValue: string,
        expectedStation?: string
    ): {
        station?: string;
        address?: string;
    } {
        const value =
            this.cleanText(
                sourceValue
            );

        if (!value) {
            return {};
        }

        if (expectedStation) {
            const stationPattern =
                this.createFlexibleStationPattern(
                    expectedStation
                );

            const match = value.match(
                new RegExp(
                    `^${stationPattern}\\s*,?\\s*(.*)$`,
                    "iu"
                )
            );

            if (match) {
                return {
                    station:
                        this.cleanText(
                            expectedStation
                        ),

                    address:
                        this.cleanText(
                            match[1]
                        ) || undefined
                };
            }
        }

        return {
            station: value
        };
    }

    private createFlexibleStationPattern(value: string): string {
        return this.cleanText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\s+/g, "\\s+")
            /*
             * Допускаем:
             *
             * ЖД(ТПУ)
             * ЖД (ТПУ)
             */
            .replace(
                /\\\(/g,
                "\\s*\\("
            );
    }

    private splitLocation(sourceValue: string | undefined): { station?: string; address?: string; } {
        if (!sourceValue) {
            return {};
        }

        const value = this.cleanText(sourceValue).replace(/^[,\s]+/, "").replace(/[,\s]+$/, "");

        const commaIndex = value.indexOf(",");

        if (commaIndex < 0) {
            return {
                station: value
            };
        }

        const station = this.cleanText(value.slice(0, commaIndex));
        const address = this.cleanText(value.slice(commaIndex + 1)).replace(/[,\s]+$/, "");

        return {
            station:
                station || undefined,

            address:
                address || undefined
        };
    }

    private findMarkerIndex(lines: string[], marker: RegExp): number {
        return lines.findIndex((line) => { marker.lastIndex = 0; return marker.test(line); });
    }

    private findLineAfterMarker(
        lines: string[],
        marker: RegExp,
        predicate: (
            line: string
        ) => boolean,
        maxDistance: number
    ): string | undefined {
        const markerIndex =
            this.findMarkerIndex(
                lines,
                marker
            );

        if (markerIndex < 0) {
            return undefined;
        }

        const end = Math.min(
            lines.length,
            markerIndex + maxDistance + 1
        );

        for (
            let index = markerIndex + 1;
            index < end;
            index++
        ) {
            if (predicate(lines[index])) {
                return lines[index];
            }
        }

        return undefined;
    }

    private findLineBeforeMarker(
        lines: string[],
        marker: RegExp,
        predicate: (
            line: string
        ) => boolean,
        maxDistance: number
    ): string | undefined {
        const markerIndex =
            this.findMarkerIndex(
                lines,
                marker
            );

        if (markerIndex < 0) {
            return undefined;
        }

        const start = Math.max(
            0,
            markerIndex - maxDistance
        );

        for (
            let index = markerIndex - 1;
            index >= start;
            index--
        ) {
            if (predicate(lines[index])) {
                return lines[index];
            }
        }

        return undefined;
    }

    private findNumericAfterMarker(
        lines: string[],
        marker: RegExp,
        minLength: number,
        maxLength: number,
        maxDistance: number
    ): string | undefined {
        const expression =
            new RegExp(
                `^\\d{${minLength},${maxLength}}$`
            );

        return this.findLineAfterMarker(
            lines,
            marker,
            (line) => expression.test(line),
            maxDistance
        );
    }

    private findNumericBeforeMarker(
        lines: string[],
        marker: RegExp,
        minLength: number,
        maxLength: number,
        maxDistance: number
    ): string | undefined {
        const expression =
            new RegExp(
                `^\\d{${minLength},${maxLength}}$`
            );

        return this.findLineBeforeMarker(
            lines,
            marker,
            (line) => expression.test(line),
            maxDistance
        );
    }

    private findDateTimeBeforeMarker(
        lines: string[],
        marker: RegExp,
        maxDistance: number
    ): {
        date: string;
        time: string;
    } | undefined {
        const value =
            this.findLineBeforeMarker(
                lines,
                marker,
                (line) =>
                    /\d{2}\.\d{2}\.(?:\d{2}|\d{4})\s+\d{2}:\d{2}/
                        .test(line),
                maxDistance
            );

        return value
            ? this.extractDateTime(
                value,
                /(\d{2}\.\d{2}\.(?:\d{2}|\d{4}))\s+(\d{2}:\d{2})/
            )
            : undefined;
    }

    private findDateTimeAfterMarker(
        lines: string[],
        marker: RegExp,
        maxDistance: number
    ): {
        date: string;
        time: string;
    } | undefined {
        const value =
            this.findLineAfterMarker(
                lines,
                marker,
                (line) =>
                    /\d{2}\.\d{2}\.(?:\d{2}|\d{4})\s+\d{2}:\d{2}/
                        .test(line),
                maxDistance
            );

        return value
            ? this.extractDateTime(
                value,
                /(\d{2}\.\d{2}\.(?:\d{2}|\d{4}))\s+(\d{2}:\d{2})/
            )
            : undefined;
    }

    private extractAgentFromLines(lines: string[]): string | undefined {
        const agentMarkerIndex = lines.findIndex((line) => /^Агент$/i.test(this.cleanText(line)));

        if (agentMarkerIndex < 0) {
            return undefined;
        }

        const ignoredLines = [
            /^Идентификатор квитанции$/i,
            /^Дата покупки$/i,
            /^Серия билета$/i,
            /^Номер билета$/i,
            /^Тип билета$/i,
            /^Вид транспортного средства$/i,
            /^Номер транспортного средства$/i
        ];

        const endIndex = Math.min(lines.length, agentMarkerIndex + 15);

        for (let index = agentMarkerIndex + 1; index < endIndex; index++) {
            const value = this.cleanText(lines[index]);

            if (!value) {
                continue;
            }

            if (ignoredLines.some((expression) => expression.test(value))) {
                continue;
            }

            /*
             * Пропускаем штрихкод и другие строки,
             * состоящие только из цифр и пробелов.
             *
             * Например:
             * 0 000159 707409
             */
            if (/^[\d\s-]+$/.test(value)) {
                continue;
            }

            /*
             * Агент должен содержать хотя бы одну букву.
             */
            if (!/[\p{L}]/u.test(value)) {
                continue;
            }

            return this.cleanAgent(value);
        }

        return undefined;
    }

    // private extractRouteDataV2(text: string): ETrafficRouteData {
    //     const rowMatch = text.match(
    //         /Дата\s+прибытия\s+Пункт\s+прибытия\s+Дата\s+отправления\s+Пункт\s+отправления\s+(.+?)\s+Перевозчик\s+Место\s+Платформа\s+Номер\s+Рейс/iu
    //     );

    //     if (!rowMatch) {
    //         return {};
    //     }

    //     const row =
    //         this.cleanText(rowMatch[1]);

    //     /*
    //      * Обычный билет:
    //      *
    //      * Вираж Место 29 Перрон 1 304а
    //      * Комсомольск-На-Амуре ЖД(ТПУ) - Хабаровск
    //      */
    //     const regularTicketMatch = row.match(
    //         /^(.+?)\s+Место\s+(\d+)\s+((?:Перрон|Платформа)\s+\d+)\s+(\d{1,6}\p{L}?)\s+(.+?)\s+-\s+(.+)$/iu
    //     );

    //     if (regularTicketMatch) {
    //         return {
    //             carrierName:
    //                 this.cleanText(
    //                     regularTicketMatch[1]
    //                 ),

    //             seat:
    //                 regularTicketMatch[2],

    //             platform:
    //                 this.cleanText(
    //                     regularTicketMatch[3]
    //                 ),

    //             tripNumber:
    //                 regularTicketMatch[4],

    //             routeName:
    //                 this.cleanRouteName(
    //                     `${regularTicketMatch[5]} - ` +
    //                     `${regularTicketMatch[6]}`
    //                 )
    //         };
    //     }

    //     /*
    //      * Фактический формат багажного билета:
    //      *
    //      * Вираж Багажное место Перрон 1 301в
    //      * Комсомольск-На-Амуре ЖД(ТПУ) - Хабаровск
    //      *
    //      * После "Багажное место":
    //      * 1. платформа;
    //      * 2. номер рейса.
    //      */
    //     const baggagePlatformFirstMatch = row.match(
    //         /^(.+?)\s+Багажное\s+место\s+((?:Перрон|Платформа)\s+\d+)\s+(\d{1,6}\p{L}?)\s+(.+?)\s+-\s+(.+)$/iu
    //     );

    //     if (baggagePlatformFirstMatch) {
    //         return {
    //             carrierName:
    //                 this.cleanText(
    //                     baggagePlatformFirstMatch[1]
    //                 ),

    //             seat:
    //                 "Багажное место",

    //             platform:
    //                 this.cleanText(
    //                     baggagePlatformFirstMatch[2]
    //                 ),

    //             tripNumber:
    //                 baggagePlatformFirstMatch[3],

    //             routeName:
    //                 this.cleanRouteName(
    //                     `${baggagePlatformFirstMatch[4]} - ` +
    //                     `${baggagePlatformFirstMatch[5]}`
    //                 )
    //         };
    //     }

    //     /*
    //      * Резервный формат:
    //      *
    //      * Вираж Багажное место 301в Перрон 1 Маршрут
    //      *
    //      * Оставляем на случай другого порядка элементов
    //      * в текстовом слое похожего PDF.
    //      */
    //     const baggageTripFirstMatch = row.match(
    //         /^(.+?)\s+Багажное\s+место\s+(\d{1,6}\p{L}?)\s+((?:Перрон|Платформа)\s+\d+)\s+(.+?)\s+-\s+(.+)$/iu
    //     );

    //     if (baggageTripFirstMatch) {
    //         return {
    //             carrierName:
    //                 this.cleanText(
    //                     baggageTripFirstMatch[1]
    //                 ),

    //             seat:
    //                 "Багажное место",

    //             tripNumber:
    //                 baggageTripFirstMatch[2],

    //             platform:
    //                 this.cleanText(
    //                     baggageTripFirstMatch[3]
    //                 ),

    //             routeName:
    //                 this.cleanRouteName(
    //                     `${baggageTripFirstMatch[4]} - ` +
    //                     `${baggageTripFirstMatch[5]}`
    //                 )
    //         };
    //     }

    //     console.log(
    //         "[E-TRAFFIC V2] Route row was found, " +
    //         "but its layout is unsupported",
    //         {
    //             pageNumber: undefined,
    //             row
    //         }
    //     );

    //     return {};
    // }

    private extractRouteDataV2(text: string, tripPoints?: ETrafficTripPoints): ETrafficRouteData {

        /*
         * Вариант №1.
         *
         * Нормальный порядок текстового слоя:
         *
         * Рейс Номер Платформа Место Перевозчик
         * Комсомольск-На-Амуре ЖД(ТПУ) -
         * Хабаровск 304а Перрон 1 Место 5 Вираж
         * Пункт отправления ...
         *
         * Именно такой порядок используется
         * в "Калимуллин.pdf".
         */
        const normalRowMatch = text.match(/Рейс\s+Номер\s+Платформа\s+Место\s+Перевозчик\s+(.+?)\s+Пункт\s+отправления\s+Дата\s+отправления\s+Пункт\s+прибытия\s+Дата\s+прибытия/iu);

        if (normalRowMatch) {
            const row = this.cleanText(normalRowMatch[1]);

            /*
            * Если прямой блок "Пункт отправления / Пункт прибытия"
            * удалось разобрать, он для OCR надёжнее порядка
            * колонок таблицы.
            */
            if (tripPoints) {
                const ocrRoute =
                    this.extractOcrRouteData(
                        row,
                        tripPoints
                    );

                if (ocrRoute) {
                    return ocrRoute;
                }
            }

            /*
             * Пассажирский билет:
             *
             * Комсомольск-На-Амуре ЖД(ТПУ) - Хабаровск
             * 304а Перрон 1 Место 5 Вираж
             */
            const regularTicketMatch = row.match(/^(.+?\s+-\s+.+?)\s+(\d{1,6}\p{L}?)\s+((?:Перрон|Платформа)\s+\d+)\s+Место\s+(\d+)\s+(.+)$/iu);

            if (regularTicketMatch) {
                return {
                    routeName: this.cleanRouteName(regularTicketMatch[1]),
                    tripNumber: regularTicketMatch[2],
                    platform: this.cleanText(regularTicketMatch[3]),
                    seat: regularTicketMatch[4],
                    carrierName: this.cleanText(regularTicketMatch[5])
                };
            }

            /*
             * Багажный билет:
             *
             * Комсомольск-На-Амуре ЖД(ТПУ) - Хабаровск
             * 304а Перрон 1 Багажное место Вираж
             */
            const baggageTicketMatch = row.match(/^(.+?\s+-\s+.+?)\s+(\d{1,6}\p{L}?)\s+((?:Перрон|Платформа)\s+\d+)\s+Багажное\s+место\s+(.+)$/iu);

            if (baggageTicketMatch) {
                return {
                    routeName: this.cleanRouteName(baggageTicketMatch[1]),
                    tripNumber: baggageTicketMatch[2],
                    platform: this.cleanText(baggageTicketMatch[3]),

                    /*
                     * Здесь это не номер пассажирского кресла.
                     * Если твоя модель допускает undefined,
                     * я бы не записывал "Багажное место" в seat.
                     */
                    seat: "Багажное место",
                    carrierName: this.cleanText(baggageTicketMatch[4])
                };
            }

            const ocrMatch =
                this.extractOcrRouteData(
                    row,
                    tripPoints
                );

            if (ocrMatch) {
                return ocrMatch;
            }

            console.log("[E-TRAFFIC V2] Route row in normal layout was found, " + "but its layout is unsupported", { row });
        }

        const ocrRoute = this.extractRouteDataFromOcrTable(text, tripPoints);
        if (ocrRoute) {
            return ocrRoute;
        }

        /*
         * Вариант №2.
         *
         * Старый формат текстового слоя.
         *
         * Его НЕ удаляем, чтобы не сломать PDF,
         * которые уже успешно разбирались V2.
         */
        const reversedRowMatch = text.match(/Дата\s+прибытия\s+Пункт\s+прибытия\s+Дата\s+отправления\s+Пункт\s+отправления\s+(.+?)\s+Перевозчик\s+Место\s+Платформа\s+Номер\s+Рейс/iu);

        if (!reversedRowMatch) {
            return {};
        }

        const row = this.cleanText(reversedRowMatch[1]);

        /*
         * Старый пассажирский формат:
         *
         * Вираж Место 29 Перрон 1 304а
         * Комсомольск-На-Амуре ЖД(ТПУ) - Хабаровск
         */
        const regularTicketMatch = row.match(/^(.+?)\s+Место\s+(\d+)\s+((?:Перрон|Платформа)\s+\d+)\s+(\d{1,6}\p{L}?)\s+(.+?)\s+-\s+(.+)$/iu);

        if (regularTicketMatch) {
            return {
                carrierName: this.cleanText(regularTicketMatch[1]),
                seat: regularTicketMatch[2],
                platform: this.cleanText(regularTicketMatch[3]),
                tripNumber: regularTicketMatch[4],
                routeName: this.cleanRouteName(`${regularTicketMatch[5]} - ` + `${regularTicketMatch[6]}`)
            };
        }

        /*
         * Старый багажный формат:
         *
         * Вираж Багажное место Перрон 1 301в
         * Комсомольск-На-Амуре ЖД(ТПУ) - Хабаровск
         */
        const baggagePlatformFirstMatch = row.match(/^(.+?)\s+Багажное\s+место\s+((?:Перрон|Платформа)\s+\d+)\s+(\d{1,6}\p{L}?)\s+(.+?)\s+-\s+(.+)$/iu);

        if (baggagePlatformFirstMatch) {
            return {
                carrierName: this.cleanText(baggagePlatformFirstMatch[1]),
                seat: "Багажное место",
                platform: this.cleanText(baggagePlatformFirstMatch[2]),
                tripNumber: baggagePlatformFirstMatch[3],
                routeName: this.cleanRouteName(`${baggagePlatformFirstMatch[4]} - ` + `${baggagePlatformFirstMatch[5]}`)
            };
        }

        /*
         * Резервный старый багажный формат:
         *
         * Вираж Багажное место 301в Перрон 1
         * Комсомольск... - Хабаровск
         */
        const baggageTripFirstMatch = row.match(/^(.+?)\s+Багажное\s+место\s+(\d{1,6}\p{L}?)\s+((?:Перрон|Платформа)\s+\d+)\s+(.+?)\s+-\s+(.+)$/iu);

        if (baggageTripFirstMatch) {
            return {
                carrierName: this.cleanText(baggageTripFirstMatch[1]),
                seat: "Багажное место",
                tripNumber: baggageTripFirstMatch[2],
                platform: this.cleanText(baggageTripFirstMatch[3]),
                routeName: this.cleanRouteName(`${baggageTripFirstMatch[4]} - ` + `${baggageTripFirstMatch[5]}`)
            };
        }

        console.log("[E-TRAFFIC V2] Route row was found, " + "but its layout is unsupported", { row });
        return {};
    }

    private extractTripPointsFromForwardLayout(text: string): ETrafficTripPoints | undefined {
        const blockMatch = text.match(/Пункт\s+отправления\s+Дата\s+отправления\s+Пункт\s+прибытия\s+Дата\s+прибытия\s+(.+?)\s+Информация\s+о\s+платеже/iu);

        if (!blockMatch) {
            return undefined;
        }

        const block = this.cleanText(blockMatch[1]);
        const dateTimes = [...block.matchAll(/(\d{2}\.\d{2}\.\d{2,4})\s+(\d{2}:\d{2})/gu)];
        if (dateTimes.length < 2) {
            return undefined;
        }
        const departure = dateTimes[0];
        const arrival = dateTimes[1];
        const departureStart = departure.index ?? 0;
        const arrivalStart = arrival.index ?? 0;

        /*
         * OCR в Бжиков.pdf даёт примерно:
         *
         * Комсомольск-На-Амуре Ж, уре ЖД
         * 03.09.2026 23:55
         * Хабаровск Аэропорт
         * 04.09.26 05:50
         * (ТПУ), Магистральное шоссе 2\2,
         *
         * Хвост после второй даты фактически относится
         * к пункту отправления из-за особенностей OCR таблицы,
         * поэтому к arrivalStation его не добавляем.
         */
        const departureLocationRaw = this.cleanText(block.slice(0, departureStart));
        const arrivalLocationRaw = this.cleanText(block.slice(departureStart + departure[0].length, arrivalStart));

        return {
            departureStation: departureLocationRaw || undefined,
            departureDate: departure[1],
            departureTime: departure[2],
            arrivalStation: arrivalLocationRaw || undefined,
            arrivalDate: arrival[1],
            arrivalTime: arrival[2]
        };
    }

    // private extractOcrRouteData(row: string, tripPoints?: ETrafficTripPoints): ETrafficRouteData | undefined {

    //     const normalized = this.cleanText(row);

    //     /*
    //      * PSM 3 обычно даёт:
    //      *
    //      * Passenger:
    //      *
    //      * Комсомольск-На-Амуре ЖД(ТПУ) -
    //      * 304а Перрон 1 Место 5 Вираж
    //      * Хабаровск
    //      *
    //      * После normalizeText:
    //      *
    //      * Комсомольск-На-Амуре ЖД(ТПУ) -
    //      * 304а Перрон 1 Место 5 Вираж Хабаровск
    //      *
    //      * Baggage:
    //      *
    //      * Комсомольск-На-Амуре ЖД(ТПУ) -
    //      * 304а Перрон 1 Багажное Вираж
    //      * Хабаровск место
    //      */

    //     const tripMatch = normalized.match(/(\d{1,6}\p{L}?)\s+((?:Перрон|Платформа)\s+\d+)/iu);
    //     if (!tripMatch || tripMatch.index === undefined) {
    //         return undefined;
    //     }

    //     /*
    //      * Всё перед номером рейса:
    //      *
    //      * Комсомольск-На-Амуре ЖД(ТПУ) -
    //      */
    //     const beforeTrip =
    //         this.cleanText(
    //             normalized.slice(
    //                 0,
    //                 tripMatch.index
    //             )
    //         );
    //     /*
    //      * Убираем разделитель маршрута в конце.
    //      */
    //     const departureMatch = beforeTrip.match(/^(.+?)\s+-\s+/u);
    //     const departureStation = this.cleanText(departureMatch?.[1] ?? beforeTrip.replace(/\s+-\s+Багажное.*$/iu, "").replace(/\s*-\s*$/, ""));

    //     if (!departureStation) {
    //         return undefined;
    //     }

    //     /*
    //      * Пункт прибытия берём из отдельной таблицы
    //      * Пункт отправления / Пункт прибытия.
    //      *
    //      * Она для OCR значительно надёжнее таблицы рейса.
    //      *
    //      * Например:
    //      *
    //      * Хабаровск Аэропорт
    //      */
    //     const arrivalCity = this.extractOcrCityName(tripPoints?.arrivalStation);
    //     if (!arrivalCity) {
    //         return undefined;
    //     }

    //     /*
    //      * Определяем место.
    //      */
    //     const seatMatch = normalized.match(/Место\s+(\d+)/iu);

    //     /*
    //      * В PSM3 багаж может выглядеть:
    //      *
    //      * Багажное Вираж Хабаровск место
    //      *
    //      * поэтому не требуем, чтобы слова
    //      * "Багажное место" находились рядом.
    //      */
    //     const isBaggage = /Багажное/iu.test(normalized);

    //     /*
    //      * Всё после:
    //      *
    //      * 304а Перрон 1
    //      */
    //     let carrierPart = this.cleanText(normalized.slice(tripMatch.index + tripMatch[0].length));
    //     if (isBaggage) {
    //         /*
    //          * Багажное Вираж Хабаровск место
    //          *
    //          * ->
    //          *
    //          * Вираж Хабаровск место
    //          */
    //         carrierPart = carrierPart.replace(/^Багажное(?:\s+место)?\s*/iu, "");
    //     } else {
    //         /*
    //          * Место 5 Вираж Хабаровск
    //          *
    //          * ->
    //          *
    //          * Вираж Хабаровск
    //          */
    //         carrierPart = carrierPart.replace(/^Место\s+\d+\s*/iu, "");
    //     }

    //     /*
    //      * В baggage OCR слово "место" может оказаться
    //      * после пункта прибытия:
    //      *
    //      * Вираж Хабаровск место
    //      */
    //     carrierPart = carrierPart.replace(/\s+место\s*$/iu, "");

    //     /*
    //      * Пункт прибытия OCR переносит после перевозчика:
    //      *
    //      * Вираж Хабаровск
    //      *
    //      * Убираем Хабаровск.
    //      */
    //     const arrivalIndex = carrierPart.toLocaleLowerCase("ru").lastIndexOf(arrivalCity.toLocaleLowerCase("ru"));

    //     if (arrivalIndex > 0) {
    //         carrierPart = carrierPart.slice(0, arrivalIndex).trim();
    //     }

    //     const carrierName = carrierPart || undefined;

    //     return {
    //         routeName: this.cleanRouteName(`${departureStation} - ${arrivalCity}`),
    //         tripNumber: tripMatch[1],
    //         platform: this.cleanText(tripMatch[2]),
    //         seat: isBaggage ? "Багажное место" : seatMatch?.[1],
    //         carrierName
    //     };
    // }

    private extractOcrRouteData(
        row: string,
        tripPoints?: ETrafficTripPoints
    ): ETrafficRouteData | undefined {

        const normalized =
            this.cleanText(row);

        /*
         * Passenger:
         *
         * Комсомольск-На-Амуре ЖД(ТПУ) -
         * 304а Перрон 1 Место 5 Вираж Хабаровск
         *
         * Baggage:
         *
         * Комсомольск-На-Амуре ЖД(ТПУ) -
         * 304a Перрон 1 Багажное Вираж Хабаровск место
         */

        const tripMatch =
            normalized.match(
                /(\d{1,6}\p{L}?)\s+((?:Перрон|Платформа)\s+\d+)/iu
            );

        if (
            !tripMatch ||
            tripMatch.index === undefined
        ) {
            return undefined;
        }

        /*
         * Всё до номера рейса:
         *
         * Комсомольск-На-Амуре ЖД(ТПУ) -
         */
        const beforeTrip =
            this.cleanText(
                normalized.slice(
                    0,
                    tripMatch.index
                )
            );

        /*
         * Станцию отправления берём только
         * до первого разделителя " - ".
         */
        const departureMatch =
            beforeTrip.match(
                /^(.+?)\s+-\s*/u
            );

        const departureStation =
            this.cleanText(
                departureMatch?.[1] ??
                beforeTrip.replace(
                    /\s*-\s*$/,
                    ""
                )
            );

        if (!departureStation) {
            return undefined;
        }

        /*
         * Прибытие берём не из строки рейса,
         * а из отдельной таблицы:
         *
         * Хабаровск Аэропорт
         *
         * extractOcrCityName() даст:
         *
         * Хабаровск
         */
        const arrivalCity =
            this.extractOcrCityName(
                tripPoints?.arrivalStation
            );

        if (!arrivalCity) {
            return undefined;
        }

        /*
         * Важно: никаких \b вокруг кириллицы.
         */
        const isBaggage =
            /Багажное/iu.test(
                normalized
            );

        const seatMatch =
            normalized.match(
                /Место\s+(\d+)/iu
            );

        /*
         * Всё после:
         *
         * 304a Перрон 1
         */
        let carrierPart =
            this.cleanText(
                normalized.slice(
                    tripMatch.index +
                    tripMatch[0].length
                )
            );

        if (isBaggage) {

            /*
             * Багажное Вираж Хабаровск место
             *
             * ->
             *
             * Вираж Хабаровск место
             */
            carrierPart =
                carrierPart.replace(
                    /^Багажное(?:\s+место)?\s*/iu,
                    ""
                );

            /*
             * PSM 3 переносит "место" в конец:
             *
             * Вираж Хабаровск место
             *
             * ->
             *
             * Вираж Хабаровск
             */
            carrierPart =
                carrierPart.replace(
                    /\s+место\s*$/iu,
                    ""
                );

        } else {

            /*
             * Место 5 Вираж Хабаровск
             *
             * ->
             *
             * Вираж Хабаровск
             */
            carrierPart =
                carrierPart.replace(
                    /^Место\s+\d+\s*/iu,
                    ""
                );
        }

        /*
         * OCR добавляет пункт прибытия после перевозчика:
         *
         * Вираж Хабаровск
         *
         * Нам нужен только:
         *
         * Вираж
         */
        const arrivalIndex =
            carrierPart
                .toLocaleLowerCase("ru")
                .lastIndexOf(
                    arrivalCity
                        .toLocaleLowerCase("ru")
                );

        if (arrivalIndex > 0) {
            carrierPart =
                carrierPart
                    .slice(
                        0,
                        arrivalIndex
                    )
                    .trim();
        }

        /*
         * Дополнительная страховка.
         */
        carrierPart =
            carrierPart
                .replace(
                    /^Багажное\s*/iu,
                    ""
                )
                .replace(
                    /\s+место$/iu,
                    ""
                )
                .trim();

        const carrierName =
            carrierPart ||
            undefined;

        return {
            routeName:
                this.cleanRouteName(
                    `${departureStation} - ${arrivalCity}`
                ),

            tripNumber:
                tripMatch[1],

            platform:
                this.cleanText(
                    tripMatch[2]
                ),

            seat:
                isBaggage
                    ? "Багажное место"
                    : seatMatch?.[1],

            carrierName
        };
    }

    private extractOcrCityName(station: string | undefined): string | undefined {
        if (!station) {
            return undefined;
        }
        const value = this.cleanText(station);

        /*
         * Хабаровск Аэропорт
         *          ^
         *
         * Комсомольск-На-Амуре ЖД(ТПУ)
         *                       ^
         *
         * Также учитываем OCR-вариант:
         *
         * Комсомольск-На-Амуре Ж, уре ЖД
         */
        const match = value.match(/^(.+?)(?=\s+(?:ЖД(?:\([^)]*\))?|Автовокзал|АВ|Аэропорт|Остановка)(?=\s|$|[,.;:]))/iu);
        return this.cleanText(match?.[1] ?? value) || undefined;
    }

    private extractTripPointsFromOcrLayout(text: string): ETrafficTripPoints | undefined {

        const sectionMatch = text.match(/(?:Информация\s+[оo]\s+рейсе|Рейс\s+Номер\s+Платформа\s+Место\s+Перевозчик)\s+(.+?)(?=Информация\s+[оo]\s+платеже|Оплачено)/iu);
        if (!sectionMatch) {
            return undefined;
        }

        const section = this.cleanText(sectionMatch[1]);
        const dateTimes = [...section.matchAll(/(\d{2}\.\d{2}\.\d{2,4})\s+(\d{2}:\d{2})/gu)];

        if (dateTimes.length < 2) {
            return undefined;
        }
        const departure = dateTimes[0];
        const arrival = dateTimes[1];
        const arrivalLocationRaw = this.cleanText(section.slice((departure.index ?? 0) + departure[0].length, arrival.index ?? 0));
        const arrivalStation = this.extractOcrArrivalStation(arrivalLocationRaw);

        return {
            departureDate: departure[1],
            departureTime: departure[2],
            arrivalStation,
            arrivalDate: arrival[1],
            arrivalTime: arrival[2]
        };
    }

    private extractOcrArrivalStation(value: string): string | undefined {
        const normalized = this.cleanText(value);
        if (!normalized) {
            return undefined;
        }
        const match = normalized.match(/([А-ЯЁ][А-Яа-яЁё-]+(?:\s+(?:Аэропорт|Автовокзал|АВ|ЖД(?:\([^)]*\))?))?)(?=\s*$|[,.;])/u);
        return this.cleanText(match?.[1] ?? normalized) || undefined;
    }

    private extractRouteDataFromOcrTable(
        text: string,
        tripPoints?: ETrafficTripPoints
    ): ETrafficRouteData | undefined {

        /*
         * Берём всю секцию рейса.
         *
         * Поддерживаем как кириллическую "о",
         * так и OCR-ошибку с латинской "o".
         */
        const sectionMatch =
            text.match(
                /Информация\s+[оo]\s+рейсе\s+(.+?)(?=Информация\s+[оo]\s+платеже|Оплачено)/iu
            );

        if (!sectionMatch) {
            return undefined;
        }

        const section =
            this.cleanText(
                sectionMatch[1]
            );

        /*
         * Если нормальный заголовок таблицы сохранился,
         * отрезаем его.
         */
        const headerMatch =
            section.match(
                /Рейс\s+Номер\s+Платформа\s+Место\s+Перевозчик/iu
            );

        let row =
            headerMatch &&
                headerMatch.index !== undefined
                ? section.slice(
                    headerMatch.index +
                    headerMatch[0].length
                )
                : section;

        /*
         * Всё после "Пункт отправления" уже относится
         * к следующей таблице.
         */
        const pointMarker =
            row.search(
                /Пункт\s+отправления/iu
            );

        if (pointMarker >= 0) {
            row =
                row.slice(
                    0,
                    pointMarker
                );
        }

        row = this.cleanText(row);
        if (!row) {
            return undefined;
        }

        return this.extractOcrRouteData(row, tripPoints);
    }

    private extractOcrPassengerName(text: string): string | undefined {
        const match = text.match(/OCR_PASSENGER_NAME:\s*([А-ЯЁ][А-Яа-яЁё-]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.)/u);
        return match?.[1] ? this.cleanText(match[1]) : undefined;
    }

}