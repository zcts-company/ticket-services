import { ParsedBusTicketDocument } from "../types/BusTicketTypes.js";
import { PdfAnalysisResult } from "../types/PdfTypes.js";
import { BusTicketPdfParser, PdfParserDetection } from "./interface/BusTicketPdfParser.js";
import { BaseRegexBusTicketPdfParser, ParsedRouteData, ParsedTripPoints } from "./BaseRegexBusTicketPdfParser.js";

export class KhabarovskAvBaggageBusTicketPdfParser extends BaseRegexBusTicketPdfParser implements BusTicketPdfParser {

    readonly id = "e-traffic-khabarovsk-av-baggage-v1";
    readonly version = "1.0.0";

    detect(analysis: PdfAnalysisResult): PdfParserDetection {
        const text = this.compact(analysis.normalizedText);

        const matchedMarkers: string[] = [];
        let confidence = 0;

        const add = (expression: RegExp, marker: string, score: number): void => {
            expression.lastIndex = 0;

            if (expression.test(text)) {
                matchedMarkers.push(marker);
                confidence += score;
            }
        };

        add(/Маршрутная квитанция багажного электронного билета/i, "BAGGAGE_ITINERARY_RECEIPT", 25);
        add(/E-Ticket baggage receipt/i, "BAGGAGE_ETICKET_RECEIPT", 10);
        add(/Агент\s+Хабаровский\s+АВ/i, "KHABAROVSK_AV_AGENT", 25);
        add(/Идентификатор квитанции\s+\d+/i, "RECEIPT_IDENTIFIER", 15);
        add(/Тип билета\s+Багажный/i, "BAGGAGE_TICKET", 15);
        add(/Рейс\s+Номер\s+Платформа\s+Место\s+Перевозчик/i, "ETRAFFIC_ROUTE_TABLE", 5);
        add(/БАГАЖНАЯ БИРКА\s+1\s+МЕСТО/i, "BAGGAGE_TAG", 5);

        confidence = Math.min(confidence, 100);

        return {
            supported:
                matchedMarkers.includes("KHABAROVSK_AV_AGENT") &&
                matchedMarkers.includes("RECEIPT_IDENTIFIER") &&
                matchedMarkers.includes("BAGGAGE_TICKET") &&
                confidence >= 70,
            confidence,
            matchedMarkers
        };
    }

    parse(analysis: PdfAnalysisResult, detection: PdfParserDetection): ParsedBusTicketDocument {
        const text = this.compact(
            analysis.normalizedText
        );

        const receiptId =
            this.extractFirstGroup(
                text,
                /Идентификатор квитанции\s+(\d+)/i
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

        const agent = this.cleanAgent(
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

        /*
         * В багажной квитанции отсутствует секция
         * "Вид транспортного средства".
         *
         * Поэтому тип билета ограничиваем началом
         * следующей секции.
         */
        const ticketType =
            this.extractFirstGroup(
                text,
                /Тип билета\s+(.+?)(?=\s+Информация о пассажире)/i
            );

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

        const routeParts =
            this.splitRoute(
                route.routeName
            );

        const tripPoints =
            this.extractTripPoints(
                text,
                routeParts.departureStation
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

        const explicitTotal =
            this.toMoney(
                this.extractFirstGroup(
                    text,
                    /Итого сумма платежа\s*\(руб\)\s+([\d\s]+[.,]\d{2})/i
                )
            );

        const moneyValues =
            this.extractMoneyValues(text);

        const total =
            explicitTotal ??
            (
                moneyValues.length > 0
                    ? Math.max(...moneyValues)
                    : undefined
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
            parserName:
                "Khabarovsk AV E-traffic baggage",
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
                name: "E-TRAFFIC",
                agent,
                website: /e-traffic\.ru/i.test(text)
                    ? "e-traffic.ru"
                    : undefined
            },

            identifiers: {
                receiptId,
                itinerarySeries: ticketSeries,
                itineraryNumber: ticketNumber
            },

            ticket: {
                type: ticketType,

                /*
                 * В багажной квитанции типа
                 * транспортного средства нет.
                 */
                vehicleType: undefined
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

                /*
                 * У багажного билета вместо
                 * пассажирского "Место 9":
                 *
                 * "Багажное место"
                 *
                 * Это не номер кресла, поэтому seat
                 * оставляем undefined.
                 */
                seat: undefined,

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

                    time:
                        tripPoints.departureTime
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

                    time:
                        tripPoints.arrivalTime
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

                totalSource:
                    total !== undefined
                        ? "ITINERARY_RECEIPT"
                        : "UNKNOWN",

                itineraryReceiptTotal: total,
                components: pricing.components
            },

            warnings
        };
    }

    /**
     * Извлекает информацию из основной таблицы рейса.
     *
     * В отличие от пассажирского билета здесь нет:
     *
     *     Место 9
     *
     * вместо него:
     *
     *     Багажное место
     */
    private extractRouteData(text: string): ParsedRouteData {
        const tableMatch = text.match(
            /Рейс\s+Номер\s+Платформа\s+Место\s+Перевозчик\s+(.+?)\s+Пункт отправления/iu
        );

        if (!tableMatch) {
            return {};
        }

        const table = this.clean(
            tableMatch[1]
        );

        const tripMatch = table.match(
            /(\d{1,6}[A-Za-zА-Яа-яЁё]?)\s+((?:Перрон|Платформа)\s+\d+|\d+)\s+Багажное\s+место(?=\s|$)/iu
        );

        const carrierMatch = table.match(
            /((?:ООО|ИП|АО|ПАО)\s+["«][^"»]+["»])/iu
        );

        const carrierId = table.match(
            /\b(\d{8,15})\b/u
        )?.[1];

        if (!tripMatch) {
            return {};
        }

        let routeName = table;

        routeName = routeName.replace(
            tripMatch[0],
            " "
        );

        if (carrierMatch) {
            routeName = routeName.replace(
                carrierMatch[0],
                " "
            );
        }

        if (carrierId) {
            routeName = routeName.replace(
                carrierId,
                " "
            );
        }

        routeName = this.cleanRouteName(
            routeName
        );

        return {
            routeName: routeName || undefined,
            tripNumber: tripMatch[1],
            platform: this.clean(
                tripMatch[2]
            ),
            seat: undefined,
            carrierName: carrierMatch
                ? this.clean(
                    carrierMatch[1]
                )
                : undefined,
            carrierId
        };
    }

    private extractTripPoints(text: string, routeDepartureStation: string | undefined): ParsedTripPoints {
        const blockMatch = text.match(
            /Пункт отправления\s+Дата отправления\s+Пункт прибытия\s+Дата прибытия\s+(.+?)\s+Информация о платеже/iu
        );

        if (!blockMatch) {
            return {};
        }

        const block =
            this.clean(blockMatch[1]);

        const matches = [
            ...block.matchAll(
                /(\d{2}\.\d{2}\.\d{2,4})\s+(\d{2}:\d{2})/g
            )
        ];

        if (matches.length < 2) {
            return {};
        }

        const departure = matches[0];
        const arrival = matches[1];

        const departureIndex =
            departure.index ?? 0;

        const arrivalIndex =
            arrival.index ?? 0;

        const beforeDeparture =
            this.clean(
                block.slice(
                    0,
                    departureIndex
                )
            );

        const betweenDates =
            this.clean(
                block.slice(
                    departureIndex +
                    departure[0].length,
                    arrivalIndex
                )
            );

        const afterArrival =
            this.clean(
                block.slice(
                    arrivalIndex +
                    arrival[0].length
                )
            );

        let departureRaw =
            beforeDeparture;

        let arrivalRaw =
            this.clean(
                [
                    betweenDates,
                    afterArrival
                ]
                    .filter(Boolean)
                    .join(" ")
            );

        /*
         * Сохраняем ту же защиту, которая есть
         * в пассажирском хабаровском парсере:
         * pdf-parser иногда переставляет адрес
         * отправления после даты прибытия.
         */
        if (
            routeDepartureStation &&
            beforeDeparture &&
            routeDepartureStation
                .toLocaleLowerCase("ru")
                .startsWith(
                    beforeDeparture
                        .toLocaleLowerCase("ru")
                ) &&
            !beforeDeparture
                .toLocaleLowerCase("ru")
                .startsWith(
                    routeDepartureStation
                        .toLocaleLowerCase("ru")
                )
        ) {
            departureRaw =
                this.clean(
                    [
                        beforeDeparture,
                        afterArrival
                    ]
                        .filter(Boolean)
                        .join(" ")
                );

            arrivalRaw =
                betweenDates;
        }

        const departureLocation =
            this.splitStationAndAddress(
                departureRaw,
                routeDepartureStation
            );

        return {
            departureStation:
                departureLocation.station,

            departureAddress:
                departureLocation.address,

            departureDate:
                departure[1],

            departureTime:
                departure[2],

            arrivalStation:
                arrivalRaw || undefined,

            arrivalDate:
                arrival[1],

            arrivalTime:
                arrival[2]
        };
    }

    private cleanAgent(value: string | undefined): string | undefined {
        if (!value) {
            return undefined;
        }

        return value
            .replace(
                /\s*\[web\d+\]\(\)\s*$/i,
                ""
            )
            .trim() || undefined;
    }
}