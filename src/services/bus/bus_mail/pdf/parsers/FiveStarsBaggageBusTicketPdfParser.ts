import {    ParsedBusTicketDocument} from "../types/BusTicketTypes.js";
import { PdfAnalysisResult } from    "../types/PdfTypes.js";
import {    BusTicketPdfParser,    PdfParserDetection} from "./interface/BusTicketPdfParser.js";
import {    BaseRegexBusTicketPdfParser,    ParsedRouteData,    ParsedTripPoints} from "./BaseRegexBusTicketPdfParser.js";

export class FiveStarsBaggageBusTicketPdfParser    extends BaseRegexBusTicketPdfParser    implements BusTicketPdfParser {

    readonly id = "five-stars-baggage-v1";
    readonly version = "1.0.0";

    detect(
        analysis: PdfAnalysisResult
    ): PdfParserDetection {
        const text = this.compact(
            analysis.normalizedText
        );

        const matchedMarkers: string[] = [];
        let confidence = 0;

        const add = (
            expression: RegExp,
            marker: string,
            score: number
        ): void => {
            expression.lastIndex = 0;

            if (expression.test(text)) {
                matchedMarkers.push(marker);
                confidence += score;
            }
        };

        add(
            /Маршрутная квитанция багажного электронного билета/i,
            "BAGGAGE_ITINERARY_RECEIPT",
            35
        );

        add(
            /БЕЗ ПАССАЖИРСКОГО БИЛЕТА НЕДЕЙСТВИТЕЛЬНА/i,
            "PASSENGER_TICKET_REQUIRED",
            20
        );

        add(
            /Серия\s*\/\s*Номер билета/i,
            "COMBINED_TICKET_NUMBER",
            15
        );

        add(
            /Агент\s+ООО\s+Пять\s+Звезд/i,
            "FIVE_STARS_AGENT",
            15
        );

        add(
            /БАГАЖНАЯ БИРКА\s+1\s+МЕСТО/i,
            "BAGGAGE_TAG",
            15
        );

        add(
            /Место\s+Маршрут\s+Номер\s+Платформа/i,
            "BAGGAGE_ROUTE_TABLE",
            10
        );

        confidence = Math.min(confidence, 100);

        return {
            supported:
                matchedMarkers.includes(
                    "BAGGAGE_ITINERARY_RECEIPT"
                ) &&
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

        const identifiersMatch = text.match(
            /Серия\s*\/\s*Номер билета\s+(\d{8,15})\s*\/\s*(\d{3,10})/i
        );

        const ticketSeries = identifiersMatch?.[1];
        const ticketNumber = identifiersMatch?.[2];

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
                /Агент\s+(.+?)(?=\s+Дата покупки)/i
            );

        const purchaseDateTime =
            this.extractDateTime(
                text,
                /Дата покупки\s+(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/i
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
            ) ??
            this.extractSplitPassengerName(
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

        const total = this.toMoney(
            this.extractFirstGroup(
                text,
                /Итого сумма платежа\s*\(руб\)\s+([\d\s]+[.,]\d{2})/i
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
            parserName: "Five Stars baggage",
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
                itinerarySeries: ticketSeries,
                itineraryNumber: ticketNumber
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
                    id: tripPoints.carrierId,
                    name: tripPoints.carrierName
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


    private extractSplitPassengerName(
        passengerSection: string
    ): string | undefined {
        /*
         * Некоторые PDF-движки извлекают строку таблицы так:
         *
         * Гильмутдинов Ульфат Паспорт РФ 285.00 ...
         * Биктимерович 8011/493191
         */
        const match = passengerSection.match(
            /([А-ЯЁ][А-Яа-яЁё-]+\s+[А-ЯЁ][А-Яа-яЁё-]+)\s+Паспорт\s+РФ[\s\d.,/]+?\s+([А-ЯЁ][А-Яа-яЁё-]+)\s+\d{4}[\s/]*\d{6}/u
        );

        if (!match) {
            return undefined;
        }

        return this.clean(
            `${match[1]} ${match[2]}`
        );
    }

    private extractRouteData(
        text: string
    ): ParsedRouteData {
        const match = text.match(
            /Место\s+Маршрут\s+Номер\s+Платформа\s+(Багажное)\s+(.+?)\s+(\d{1,6}[A-Za-zА-Яа-яЁё]?)\s+(\d+)\s+Отправление/iu
        );

        if (!match) {
            return {};
        }

        return {
            seat: match[1],
            routeName: this.cleanRouteName(
                match[2]
            ),
            tripNumber: match[3],
            platform: match[4]
        };
    }

    private extractTripPoints(
        text: string,
        routeDepartureStation:
            string | undefined
    ): ParsedTripPoints & {
        carrierName?: string;
        carrierId?: string;
    } {
        const blockMatch = text.match(
            /Отправление\s+Прибытие\s+Перевозчик\s+(.+?)\s+Информация о платеже/iu
        );

        if (!blockMatch) {
            return {};
        }

        const block = this.clean(
            blockMatch[1]
        );

        /*
         * Основной порядок pdf-parse:
         *
         * departure date time arrival date time carrier INN
         */
        const logicalMatch = block.match(
            /^(.+?)\s+(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\s+(.+?)\s+(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\s+(.+?),\s*ИНН\s+(\d{6,})$/iu
        );

        if (logicalMatch) {
            const departureLocation =
                this.splitStationAndAddress(
                    logicalMatch[1],
                    routeDepartureStation
                );

            return {
                departureStation:
                    departureLocation.station,
                departureAddress:
                    departureLocation.address,
                departureDate: logicalMatch[2],
                departureTime: logicalMatch[3],
                arrivalStation:
                    this.clean(logicalMatch[4]),
                arrivalDate: logicalMatch[5],
                arrivalTime: logicalMatch[6],
                carrierName:
                    this.clean(logicalMatch[7]),
                carrierId: logicalMatch[8]
            };
        }

        /*
         * Fallback для текстового слоя, где сначала идут
         * обе станции и перевозчик, а затем обе даты.
         */
        const carrierMatch = block.match(
            /((?:ООО|ИП|АО|ПАО)\s+["«][^"»]+["»]),\s*ИНН\s+(\d{6,})/iu
        );

        const dateTimes = [
            ...block.matchAll(
                /(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/g
            )
        ];

        if (
            !carrierMatch ||
            carrierMatch.index === undefined ||
            dateTimes.length < 2
        ) {
            return {};
        }

        const locations = this.clean(
            block.slice(0, carrierMatch.index)
        );

        let departureStation:
            string | undefined;
        let arrivalStation:
            string | undefined;

        if (
            routeDepartureStation &&
            locations
                .toLocaleLowerCase("ru")
                .startsWith(
                    routeDepartureStation
                        .toLocaleLowerCase("ru")
                )
        ) {
            departureStation =
                routeDepartureStation;

            arrivalStation = this.clean(
                locations.slice(
                    routeDepartureStation.length
                )
            ) || undefined;
        }

        return {
            departureStation,
            departureDate: dateTimes[0][1],
            departureTime: dateTimes[0][2],
            arrivalStation,
            arrivalDate: dateTimes[1][1],
            arrivalTime: dateTimes[1][2],
            carrierName: this.clean(
                carrierMatch[1]
            ),
            carrierId: carrierMatch[2]
        };
    }
}
