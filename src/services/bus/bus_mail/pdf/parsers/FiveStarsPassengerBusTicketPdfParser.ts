import { ParsedBusTicketDocument } from "../types/BusTicketTypes.js";
import { PdfAnalysisResult } from "../types/PdfTypes.js";
import { BusTicketPdfParser, PdfParserDetection } from "./interface/BusTicketPdfParser.js";
import { BaseRegexBusTicketPdfParser, ParsedRouteData, ParsedTripPoints } from "./BaseRegexBusTicketPdfParser.js";

export class FiveStarsPassengerBusTicketPdfParser extends BaseRegexBusTicketPdfParser implements BusTicketPdfParser {

    readonly id = "five-stars-passenger-v1";
    readonly version = "1.0.0";

    detect(analysis: PdfAnalysisResult): PdfParserDetection {
        const text = this.compact(
            analysis.normalizedText
        );

        const matchedMarkers: string[] = [];
        let confidence = 0;

        const add = (expression: RegExp, marker: string, score: number): void => {
            expression.lastIndex = 0;

            if (expression.test(text)) {
                matchedMarkers.push(marker);
                confidence += score;
            }
        };

        add(
            /Маршрутная квитанция электронного билета/i,
            "ITINERARY_RECEIPT",
            20
        );

        add(
            /E-Ticket itinerary receipt/i,
            "ETICKET_RECEIPT",
            10
        );

        add(
            /Агент\s+ООО\s+Пять\s+Звезд/i,
            "FIVE_STARS_AGENT",
            25
        );

        add(
            /Идентификатор заказа\s*\/\s*квитанции/i,
            "ORDER_RECEIPT_IDENTIFIER",
            25
        );

        add(
            /Маршрут\s+Номер\s+Платформа\s+Место\s+Перевозчик/i,
            "PASSENGER_ROUTE_TABLE",
            15
        );

        add(
            /Пассажир\s+Удостоверение личности\s+Тариф/i,
            "PASSENGER_FARE_TABLE",
            10
        );

        confidence = Math.min(confidence, 100);

        return {
            supported:
                matchedMarkers.includes("FIVE_STARS_AGENT") &&
                matchedMarkers.includes("ORDER_RECEIPT_IDENTIFIER") &&
                confidence >= 70,
            confidence,
            matchedMarkers
        };
    }

    parse(
        analysis: PdfAnalysisResult,
        detection: PdfParserDetection
    ): ParsedBusTicketDocument {
        const text = this.compact(
            analysis.normalizedText
        );

        const purchaseDateTime =
            this.extractDateTime(
                text,
                /Дата покупки\s+(\d{2}\.\d{2}\.(?:\d{2}|\d{4}))\s*(?:в\s*)?(\d{2}:\d{2})/iu
            );

        const ticketSeries =
            this.extractFirstGroup(
                text,
                /Серия билета\s+(\d{8,15})/i
            );

        const ticketNumber =
            this.extractFirstGroup(
                text,
                /Номер билета\s+(\d{3,10})/i
            );

        const ticketType =
            this.extractFirstGroup(
                text,
                /Тип билета\s+(.+?)(?=\s+Вид транспортного средства)/i
            );

        const vehicleType =
            this.extractFirstGroup(
                text,
                /Вид транспортного средства\s+(.+?)(?=\s+Агент)/i
            );

        const agent =
            this.extractFirstGroup(
                text,
                /Агент\s+(.+?)(?=\s+Идентификатор заказа)/i
            );

        const identifiersMatch = text.match(
            /Идентификатор заказа\s*\/\s*квитанции\s+(\d+)\s*\/\s*(\d+)/i
        );

        const orderId = identifiersMatch?.[1];
        const receiptId = identifiersMatch?.[2];

        const passengerSection =
            this.extractSection(
                text,
                /Информация о пассажире и тарифе/i,
                /Информация о рейсе/i
            );

        const passengerName =
            this.extractPassengerName(
                passengerSection
            );

        const passengerDocument =
            this.extractPassportNumber(
                passengerSection
            );

        const route =
            this.extractRouteData(text);

        const tripPoints =
            this.extractTripPoints(text);

        const routeParts =
            this.splitRoute(
                route.routeName
            );

        const paymentMethodRaw =
            this.extractFirstGroup(
                text,
                /Форма оплаты\s+(.+?)(?=\s+Итого сумма платежа)/i
            );

        const paymentMethod =
            this.mapPaymentMethod(
                paymentMethodRaw
            );

        const total = this.toMoney(
            this.extractFirstGroup(
                text,
                /Итого сумма платежа(?:\s*\(руб\))?\s+([\d\s]+[.,]\d{2})/i
            )
        );

        const pricing =
            this.buildPricing(total, 0);

        const warnings =
            this.createWarnings({
                passengerName,
                routeName: route.routeName,
                departureDate:
                    tripPoints.departureDate,
                total
            });

        this.validateCriticalFields({
            parserName: "Five Stars passenger",
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
                confidence: detection.confidence
            },

            source: this.source(analysis),

            provider: {
                name: "ПЯТЬ ЗВЕЗД",
                agent
            },

            identifiers: {
                receiptId,
                itinerarySeries: ticketSeries,
                itineraryNumber: ticketNumber,
                controlNumber: orderId
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
                        number: passengerDocument,
                        rawType: "Паспорт РФ"
                    }
                    : undefined,
                gender: "UNKNOWN"
            },

            trip: {
                routeName: route.routeName,
                tripNumber: route.tripNumber,
                platform: route.platform,
                seat: route.seat,

                departure: {
                    city: this.extractCityName(
                        routeParts.departureStation
                    ),
                    station:
                        tripPoints.departureStation ??
                        routeParts.departureStation,
                    address:
                        tripPoints.departureAddress,
                    date: tripPoints.departureDate
                        ? this.toIsoDate(
                            tripPoints.departureDate
                        )
                        : undefined,
                    time: tripPoints.departureTime
                },

                arrival: {
                    city: this.extractCityName(
                        routeParts.arrivalStation
                    ),
                    station:
                        tripPoints.arrivalStation ??
                        routeParts.arrivalStation,
                    address:
                        tripPoints.arrivalAddress,
                    date: tripPoints.arrivalDate
                        ? this.toIsoDate(
                            tripPoints.arrivalDate
                        )
                        : undefined,
                    time: tripPoints.arrivalTime
                },

                carrier: {
                    id: route.carrierId,
                    name: route.carrierName
                }
            },

            purchase: {
                agentIssuedAt: purchaseDateTime
                    ? {
                        date: this.toIsoDate(
                            purchaseDateTime.date
                        ),
                        time: purchaseDateTime.time
                    }
                    : undefined,
                paymentMethod,
                paymentMethodRaw
            },

            pricing: {
                currency: "RUB",
                baseFare: pricing.baseFare,
                total: pricing.total,
                totalSource: total !== undefined
                    ? "ITINERARY_RECEIPT"
                    : "UNKNOWN",
                itineraryReceiptTotal: total,
                components: pricing.components
            },

            warnings
        };
    }

    private extractRouteData(
        text: string
    ): ParsedRouteData {
        const tableMatch = text.match(
            /Маршрут\s+Номер\s+Платформа\s+Место\s+Перевозчик\s+(.+?)\s+Пункт отправления/iu
        );

        if (!tableMatch) {
            return {};
        }

        const table = this.clean(
            tableMatch[1]
        );

        const valuesMatch = table.match(
            /(\d{1,6}[A-Za-zА-Яа-яЁё]?)\s+(\d+)\s+(\d+)\s+(.+?),\s*ИНН\s+(\d{6,})/iu
        );

        if (!valuesMatch || valuesMatch.index === undefined) {
            return {};
        }

        const routeBefore = table
            .slice(0, valuesMatch.index)
            .trim();

        const routeAfter = table
            .slice(
                valuesMatch.index +
                valuesMatch[0].length
            )
            .trim();

        const routeName = this.cleanRouteName(
            [routeBefore, routeAfter]
                .filter(Boolean)
                .join(" ")
        );

        return {
            routeName: routeName || undefined,
            tripNumber: valuesMatch[1],
            platform: valuesMatch[2],
            seat: valuesMatch[3],
            carrierName: this.clean(
                valuesMatch[4]
            ),
            carrierId: valuesMatch[5]
        };
    }

    // private extractTripPoints(
    //     text: string
    // ): ParsedTripPoints {
    //     const blockMatch = text.match(
    //         /Пункт отправления\s+Дата отправления\s+Пункт прибытия\s+Дата прибытия\s+(.+?)\s+Информация о платеже/iu
    //     );

    //     if (!blockMatch) {
    //         return {};
    //     }

    //     const block = this.clean(
    //         blockMatch[1]
    //     );

    //     const dateTimeExpression =
    //         /(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/g;

    //     const matches = [
    //         ...block.matchAll(
    //             dateTimeExpression
    //         )
    //     ];

    //     if (matches.length < 2) {
    //         return {};
    //     }

    //     const departure = matches[0];
    //     const arrival = matches[1];

    //     const departureStart =
    //         departure.index ?? 0;

    //     const arrivalStart =
    //         arrival.index ?? 0;

    //     const departureStation = this.clean(
    //         block.slice(0, departureStart)
    //     );

    //     const between = this.clean(
    //         block.slice(
    //             departureStart + departure[0].length,
    //             arrivalStart
    //         )
    //     );

    //     const afterArrival = this.clean(
    //         block.slice(
    //             arrivalStart + arrival[0].length
    //         )
    //     );

    //     const arrivalStation = this.clean(
    //         [between, afterArrival]
    //             .filter(Boolean)
    //             .join(" ")
    //     );

    //     return {
    //         departureStation:
    //             departureStation || undefined,
    //         departureDate: departure[1],
    //         departureTime: departure[2],
    //         arrivalStation:
    //             arrivalStation || undefined,
    //         arrivalDate: arrival[1],
    //         arrivalTime: arrival[2]
    //     };
    // }

    private extractTripPoints(
        text: string
    ): ParsedTripPoints {
        const blockMatch = text.match(
            /Пункт отправления\s+Дата отправления\s+Пункт прибытия\s+Дата прибытия\s+(.+?)\s+Информация о платеже/iu
        );

        if (!blockMatch) {
            return {};
        }

        const block = this.clean(
            blockMatch[1]
        );

        const dateTimeExpression =
            /(\d{2}\.\d{2}\.(?:\d{2}|\d{4}))\s*(?:в\s*)?(\d{2}:\d{2})/giu;

        const matches = [
            ...block.matchAll(
                dateTimeExpression
            )
        ];

        if (matches.length < 2) {
            return {};
        }

        const departure = matches[0];
        const arrival = matches[1];

        const departureStart =
            departure.index ?? 0;

        const arrivalStart =
            arrival.index ?? 0;

        const departureStation = this.clean(
            block.slice(
                0,
                departureStart
            )
        );

        const between = this.clean(
            block.slice(
                departureStart + departure[0].length,
                arrivalStart
            )
        );

        const afterArrival = this.clean(
            block.slice(
                arrivalStart + arrival[0].length
            )
        );

        const arrivalStation = this.clean(
            [between, afterArrival]
                .filter(Boolean)
                .join(" ")
        );

        return {
            departureStation:
                departureStation || undefined,

            departureDate:
                departure[1],

            departureTime:
                departure[2],

            arrivalStation:
                arrivalStation || undefined,

            arrivalDate:
                arrival[1],

            arrivalTime:
                arrival[2]
        };
    }
}
