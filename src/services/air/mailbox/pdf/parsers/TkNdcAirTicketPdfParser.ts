import {
    AirBaggageAllowance,
    AirJourney,
    AirJourneyType,
    AirPassenger,
    AirPassengerType,
    AirSegment,
    ParsedAirTicketDocument
} from "../../types/AirTicketTypes.js";

import {
    AirTicketPdfParser,
    PdfParserDetection
} from "./interface/AirTicketPdfParser.js";

import {
    BaseAirTicketPdfParser
} from "./BaseAirTicketPdfParser.js";
import { PdfAnalysisResult } from "../../../../bus/bus_mail/pdf/types/PdfTypes.js";


interface TkPassengerData {
    passenger: AirPassenger;

    ticketNumber: string;

    price?: number;

    currency?: string;
}


interface TkJourneyHeader {
    type: AirJourneyType;

    departureCity: string;
    departureAirportCode: string;

    arrivalCity: string;
    arrivalAirportCode: string;
}


interface ParsedTkFlights {
    segments: AirSegment[];
    journeys: AirJourney[];
}


export class TkNdcAirTicketPdfParser
    extends BaseAirTicketPdfParser
    implements AirTicketPdfParser {

    readonly id =
        "tk-ndc-v1";

    readonly version =
        "1.0.0";


    detect(
        analysis: PdfAnalysisResult
    ): PdfParserDetection {

        const text =
            analysis.normalizedText;

        const matchedMarkers:
            string[] = [];

        let confidence = 0;


        const add = (
            expression: RegExp,
            marker: string,
            score: number
        ): void => {

            expression.lastIndex = 0;

            if (
                expression.test(text)
            ) {

                matchedMarkers.push(
                    marker
                );

                confidence += score;
            }
        };


        add(
            /\bOrder ID\b/i,
            "ORDER_ID",
            10
        );

        add(
            /\bIssuing Office\b/i,
            "ISSUING_OFFICE",
            10
        );

        add(
            /\bFlight Details\b/i,
            "FLIGHT_DETAILS",
            15
        );

        add(
            /\bPassengers Details\b/i,
            "PASSENGERS_DETAILS",
            15
        );

        add(
            /\bBaggage\b/i,
            "BAGGAGE",
            10
        );

        add(
            /\bTurkish Airlines\b/i,
            "TURKISH_AIRLINES",
            30
        );

        add(
            /\bTK\d{3,4}\b/i,
            "TK_FLIGHT",
            15
        );


        confidence =
            Math.min(
                confidence,
                100
            );


        return {
            supported:
                confidence >= 70,

            confidence,

            matchedMarkers
        };
    }


    parse(
        analysis: PdfAnalysisResult,
        detection: PdfParserDetection
    ): ParsedAirTicketDocument[] {

        const lines =
            this.normalizeLines(
                analysis
            );


        const orderId =
            this.findValueAfterLabel(
                lines,
                /^Order ID$/i
            );


        const createDate =
            this.toIsoEnglishDate(
                this.findValueAfterLabel(
                    lines,
                    /^Create Date$/i
                )
            );


        const ticketDate =
            this.toIsoEnglishDate(
                this.findValueAfterLabel(
                    lines,
                    /^Ticket Date$/i
                )
            );


        const purgeDate =
            this.toIsoEnglishDate(
                this.findValueAfterLabel(
                    lines,
                    /^Purge Date$/i
                )
            );


        const issuingOffice =
            this.findValueAfterLabel(
                lines,
                /^Issuing Office$/i
            );


        const paymentMethodRaw =
            this.findValueAfterLabel(
                lines,
                /^Payment$/i
            );


        const orderTotal =
            this.extractOrderTotal(
                lines
            );


        const flights =
            this.extractFlights(
                lines,
                ticketDate
            );


        const passengers =
            this.extractPassengers(
                lines
            );


        if (
            passengers.length === 0
        ) {

            throw new Error(
                `TK NDC PDF was detected, but ` +
                `passengers could not be extracted`
            );
        }


        const result:
            ParsedAirTicketDocument[] = [];


        for (
            const passengerData
            of passengers
        ) {

            const baggage =
                this.extractBaggage(
                    lines,
                    passengerData
                        .passenger
                        .fullName
                );


            this.validateCriticalFields({
                parserName:
                    "TK NDC",

                orderId,

                ticketNumber:
                    passengerData
                        .ticketNumber,

                segmentCount:
                    flights
                        .segments
                        .length
            });


            const warnings =
                this.createWarnings({
                    orderId,

                    ticketNumber:
                        passengerData
                            .ticketNumber,

                    passengerName:
                        passengerData
                            .passenger
                            .fullName,

                    segmentCount:
                        flights
                            .segments
                            .length,

                    total:
                        passengerData
                            .price
                });


            result.push({
                schemaVersion:
                    "1.0",

                documentType:
                    "AIR_TICKET",

                parser: {
                    id:
                        this.id,

                    version:
                        this.version,

                    confidence:
                        detection.confidence
                },

                source:
                    this.source(
                        analysis
                    ),

                provider: {
                    code:
                        "TK_NDC",

                    name:
                        "Turkish Airlines",

                    airlineCode:
                        "TK",

                    issuingOffice
                },

                identifiers: {
                    orderId,

                    ticketNumber:
                        passengerData
                            .ticketNumber
                },

                passenger:
                    passengerData.passenger,

                segments:
                    flights.segments,

                journeys:
                    flights.journeys,

                baggage,

                purchase: {
                    createdDate:
                        createDate,

                    ticketDate,

                    purgeDate,

                    paymentMethod:
                        this.mapPaymentMethod(
                            paymentMethodRaw
                        ),

                    paymentMethodRaw
                },

                pricing: {
                    currency:
                        passengerData.currency ??
                        orderTotal?.currency,

                    total:
                        passengerData.price,

                    orderTotal:
                        orderTotal?.amount,

                    /*
                     * TK PDF показывает нам итоговую цену,
                     * но не дает надежного разбиения
                     * Fare/Tax.
                     *
                     * Поэтому ничего не придумываем.
                     */
                    components: []
                },

                warnings
            });
        }


        return result;
    }


    private extractOrderTotal(
        lines: string[]
    ): {
        currency: string;
        amount: number;
    } | undefined {

        const line =
            lines.find(
                (value) =>
                    /Total Fare:/i.test(value)
            );


        if (!line) {
            return undefined;
        }


        return this.extractCurrencyMoney(
            line
        );
    }


    private extractFlights(
        lines: string[],
        ticketDate: string | undefined
    ): ParsedTkFlights {

        if (!ticketDate) {

            throw new Error(
                `Could not parse TK flight dates because ` +
                `Ticket Date was not found`
            );
        }


        const segments:
            AirSegment[] = [];

        const journeys:
            AirJourney[] = [];


        let index = 0;


        while (
            index < lines.length
        ) {

            const journeyHeader =
                this.parseJourneyHeader(
                    lines[index]
                );


            if (!journeyHeader) {
                index++;
                continue;
            }


            const sectionStart =
                index + 1;


            let sectionEnd =
                lines.length;


            for (
                let searchIndex =
                    sectionStart;

                searchIndex <
                lines.length;

                searchIndex++
            ) {

                if (
                    this.parseJourneyHeader(
                        lines[searchIndex]
                    ) ||
                    /^Passengers Details$/i
                        .test(
                            lines[searchIndex]
                        )
                ) {

                    sectionEnd =
                        searchIndex;

                    break;
                }
            }


            const journeySegmentNumbers:
                number[] = [];


            let flightIndex =
                sectionStart;


            while (
                flightIndex <
                sectionEnd
            ) {

                if (
                    !this.isFlightNumber(
                        lines[flightIndex]
                    )
                ) {

                    flightIndex++;
                    continue;
                }


                let blockEnd =
                    sectionEnd;


                for (
                    let next =
                        flightIndex + 1;

                    next <
                    sectionEnd;

                    next++
                ) {

                    if (
                        this.isFlightNumber(
                            lines[next]
                        )
                    ) {

                        blockEnd =
                            next;

                        break;
                    }
                }


                const block =
                    lines.slice(
                        flightIndex,
                        blockEnd
                    );


                const sequence =
                    segments.length + 1;


                const previousDate =
                    segments.length > 0
                        ? segments[
                            segments.length - 1
                        ].arrival.date ??
                        ticketDate
                        : ticketDate;


                const segment =
                    this.parseFlightBlock(
                        block,
                        sequence,
                        previousDate
                    );


                if (segment) {

                    segments.push(
                        segment
                    );

                    journeySegmentNumbers.push(
                        sequence
                    );
                }


                flightIndex =
                    blockEnd;
            }


            journeys.push({
                type:
                    journeyHeader.type,

                departure: {
                    city:
                        journeyHeader
                            .departureCity,

                    airportCode:
                        journeyHeader
                            .departureAirportCode
                },

                arrival: {
                    city:
                        journeyHeader
                            .arrivalCity,

                    airportCode:
                        journeyHeader
                            .arrivalAirportCode
                },

                segmentSequences:
                    journeySegmentNumbers
            });


            index =
                sectionEnd;
        }


        return {
            segments,
            journeys
        };
    }


    private parseJourneyHeader(
        value: string
    ): TkJourneyHeader | undefined {

        /*
         * Departure Moscow (VKO) - Lyon (LYS)
         *
         * Return Lyon (LYS) - Moscow (VKO)
         */
        const match =
            value.match(
                /^(Departure|Return)\s+(.+?)\s+\(([A-Z]{3})\)\s+-\s+(.+?)\s+\(([A-Z]{3})\)$/i
            );


        if (!match) {
            return undefined;
        }


        return {
            type:
                /^Departure$/i.test(
                    match[1]
                )
                    ? "DEPARTURE"
                    : "RETURN",

            departureCity:
                match[2],

            departureAirportCode:
                match[3]
                    .toUpperCase(),

            arrivalCity:
                match[4],

            arrivalAirportCode:
                match[5]
                    .toUpperCase()
        };
    }


    private parseFlightBlock(
        block: string[],
        sequence: number,
        notBeforeDate: string
    ): AirSegment | undefined {

        const flightNumber =
            block[0];


        if (
            !this.isFlightNumber(
                flightNumber
            )
        ) {
            return undefined;
        }


        const pointIndexes:
            number[] = [];


        for (
            let index = 1;
            index < block.length;
            index++
        ) {

            if (
                this.parseAirportPoint(
                    block[index]
                )
            ) {
                pointIndexes.push(
                    index
                );
            }
        }


        if (
            pointIndexes.length < 2
        ) {
            return undefined;
        }


        const departurePoint =
            this.parseAirportPoint(
                block[
                pointIndexes[0]
                ]
            );


        const arrivalPoint =
            this.parseAirportPoint(
                block[
                pointIndexes[1]
                ]
            );


        if (
            !departurePoint ||
            !arrivalPoint
        ) {
            return undefined;
        }


        const departureDateLine =
            block[
            pointIndexes[0] + 1
            ];


        const arrivalDateLine =
            block[
            pointIndexes[1] + 1
            ];


        const departureDate =
            this.resolveTravelDate(
                departureDateLine,
                notBeforeDate
            );


        if (!departureDate) {
            return undefined;
        }


        const arrivalDate =
            this.resolveTravelDate(
                arrivalDateLine,
                departureDate
            );


        if (!arrivalDate) {
            return undefined;
        }


        const aircraft =
            this.extractAircraft(
                block,
                pointIndexes[0]
            );


        const carrierName =
            this.extractCarrierName(
                block,
                pointIndexes[1] + 2
            );


        const fareData =
            this.extractCabinData(
                block
            );


        return {
            sequence,

            flightNumber,

            aircraft,

            departure: {
                city:
                    departurePoint.city,

                airportCode:
                    departurePoint.airportCode,

                date:
                    departureDate,

                time:
                    departurePoint.time
            },

            arrival: {
                city:
                    arrivalPoint.city,

                airportCode:
                    arrivalPoint.airportCode,

                date:
                    arrivalDate,

                time:
                    arrivalPoint.time
            },

            marketingCarrier: {
                code:
                    flightNumber
                        .slice(0, 2)
                        .toUpperCase(),

                name:
                    carrierName
            },

            cabin:
                fareData?.cabin,

            bookingClass:
                fareData?.bookingClass
        };
    }


    private extractAircraft(
        block: string[],
        firstPointIndex: number
    ): string | undefined {

        if (
            firstPointIndex <= 1
        ) {
            return undefined;
        }


        const value =
            block[1];


        if (
            value === "-" ||
            this.parseAirportPoint(value)
        ) {
            return undefined;
        }


        return value;
    }


    private extractCarrierName(
        block: string[],
        startIndex: number
    ): string | undefined {

        for (
            let index = startIndex;
            index < block.length;
            index++
        ) {

            if (
                /Turkish Airlines/i
                    .test(
                        block[index]
                    )
            ) {

                return block[index];
            }
        }


        return undefined;
    }


    private extractCabinData(
        block: string[]
    ): {
        bookingClass?: string;
        cabin?: string;
    } | undefined {

        for (
            const line of block
        ) {

            /*
             * Q,Q | ECONOMY
             */
            const match =
                line.match(
                    /^([A-Z0-9]+)(?:,\s*[A-Z0-9]+)?\s*\|\s*(.+)$/i
                );


            if (!match) {
                continue;
            }


            return {
                bookingClass:
                    match[1]
                        .toUpperCase(),

                cabin:
                    match[2]
                        .trim()
                        .toUpperCase()
            };
        }


        return undefined;
    }


    private extractPassengers(
        lines: string[]
    ): TkPassengerData[] {

        const start =
            lines.findIndex(
                (line) =>
                    /^Passengers Details$/i
                        .test(line)
            );


        if (
            start === -1
        ) {
            return [];
        }


        let end =
            lines.findIndex(
                (line, index) =>
                    index > start &&
                    /^Baggage$/i.test(line)
            );


        if (
            end === -1
        ) {
            end =
                lines.length;
        }


        const section =
            lines.slice(
                start + 1,
                end
            );


        const passengers:
            TkPassengerData[] = [];


        for (
            let index = 0;
            index < section.length;
            index++
        ) {

            if (
                !/^(Mr|Mrs|Ms|Miss|Mstr|Dr)\.?\s+/i
                    .test(
                        section[index]
                    )
            ) {
                continue;
            }


            const block:
                string[] = [
                    section[index]
                ];


            let next =
                index + 1;


            while (
                next <
                section.length
            ) {

                if (
                    /^(Mr|Mrs|Ms|Miss|Mstr|Dr)\.?\s+/i
                        .test(
                            section[next]
                        )
                ) {
                    break;
                }


                block.push(
                    section[next]
                );


                if (
                    /\b\d{12,14}\b.*\b[A-Z]{3}\b/i
                        .test(
                            section[next]
                        )
                ) {
                    break;
                }


                next++;
            }


            const passenger =
                this.parsePassengerBlock(
                    block
                );


            if (passenger) {
                passengers.push(
                    passenger
                );
            }


            index =
                Math.max(
                    index,
                    next - 1
                );
        }


        return passengers;
    }


    private parsePassengerBlock(
        block: string[]
    ): TkPassengerData | undefined {

        const text =
            block.join(" ");


        /*
         * Mr. Oleg KIM Adult 11 Jul, 1990 ...
         */
        const passengerMatch =
            text.match(
                /^(Mr|Mrs|Ms|Miss|Mstr|Dr)\.?\s+(.+?)\s+(Adult|Child|Infant)\s+(\d{1,2}\s+[A-Za-z]{3},\s+\d{4})\b/i
            );


        if (!passengerMatch) {
            return undefined;
        }


        /*
         * 2352242811471 RUB 86,520.00
         */
        const ticketMatch =
            text.match(
                /\b(\d{12,14})\s+([A-Z]{3})\s+([\d,.]+)/i
            );


        if (!ticketMatch) {
            return undefined;
        }


        const title =
            `${passengerMatch[1]}.`;

        const name =
            passengerMatch[2];

        const nameParts =
            name
                .split(/\s+/)
                .filter(Boolean);


        const email =
            text.match(
                /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
            )?.[0];


        const phone =
            text.match(
                /\+\d{7,15}\b/
            )?.[0];


        return {
            passenger: {
                fullName:
                    `${title} ${name}`,

                title,

                firstName:
                    nameParts[0],

                lastName:
                    nameParts.length > 1
                        ? nameParts
                            .slice(1)
                            .join(" ")
                        : undefined,

                type:
                    this.mapPassengerType(
                        passengerMatch[3]
                    ),

                birthDate:
                    this.toIsoEnglishDate(
                        passengerMatch[4]
                    ),

                contact: {
                    phone,
                    email
                }
            },

            ticketNumber:
                ticketMatch[1],

            currency:
                ticketMatch[2]
                    .toUpperCase(),

            price:
                this.toMoney(
                    ticketMatch[3]
                )
        };
    }


    private mapPassengerType(
        value: string
    ): AirPassengerType {

        if (
            /^Adult$/i.test(value)
        ) {
            return "ADULT";
        }


        if (
            /^Child$/i.test(value)
        ) {
            return "CHILD";
        }


        if (
            /^Infant$/i.test(value)
        ) {
            return "INFANT";
        }


        return "UNKNOWN";
    }


    private extractBaggage(
        lines: string[],
        passengerName: string | undefined
    ): AirBaggageAllowance[] {

        if (!passengerName) {
            return [];
        }


        const start =
            lines.findIndex(
                (line) =>
                    /^Baggage$/i
                        .test(line)
            );


        if (
            start === -1
        ) {
            return [];
        }


        const targetPassenger =
            this.passengerNameKey(
                passengerName
            );


        const result:
            AirBaggageAllowance[] = [];


        let journeyType:
            AirJourneyType | undefined;


        for (
            let index = start + 1;
            index < lines.length;
            index++
        ) {

            const line =
                lines[index];


            if (
                /^Departure$/i.test(line)
            ) {

                journeyType =
                    "DEPARTURE";

                continue;
            }


            if (
                /^Return$/i.test(line)
            ) {

                journeyType =
                    "RETURN";

                continue;
            }


            if (
                !journeyType
            ) {
                continue;
            }


            const parsed =
                this.parseBaggageLine(
                    line
                );


            if (!parsed) {
                continue;
            }


            if (
                this.passengerNameKey(
                    parsed.passengerName
                ) !== targetPassenger
            ) {
                continue;
            }


            result.push({
                journeyType,

                checked:
                    parsed.checked,

                cabin:
                    parsed.cabin
            });
        }


        return result;
    }


    private parseBaggageLine(
        value: string
    ): {
        passengerName: string;

        checked?: {
            pieces?: number;
            weight?: number;
            weightUnit?: string;
            raw?: string;
        };

        cabin?: {
            pieces?: number;
            weight?: number;
            weightUnit?: string;
            raw?: string;
        };
    } | undefined {

        /*
         * Mr. Oleg Kim
         * 30 Kilograms
         * 1 Piece x 8 Kilograms
         *
         * После normalizeLines это может находиться
         * как в одной строке, так и в нескольких.
         *
         * Текущий TK PDF дает всю строку целиком
         * после extraction.
         */
        const match =
            value.match(
                /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(Kilograms?|KG|KGS?)\s+(\d+)\s+Pieces?\s+x\s+(\d+(?:[.,]\d+)?)\s+(Kilograms?|KG|KGS?)$/i
            );


        if (!match) {
            return undefined;
        }


        const checkedWeight =
            Number(
                match[2]
                    .replace(",", ".")
            );


        const cabinPieces =
            Number(
                match[4]
            );


        const cabinWeight =
            Number(
                match[5]
                    .replace(",", ".")
            );


        return {
            passengerName:
                match[1],

            checked: {
                weight:
                    checkedWeight,

                weightUnit:
                    "KG",

                raw:
                    `${match[2]} ${match[3]}`
            },

            cabin: {
                pieces:
                    cabinPieces,

                weight:
                    cabinWeight,

                weightUnit:
                    "KG",

                raw:
                    `${match[4]} Piece x ` +
                    `${match[5]} ${match[6]}`
            }
        };
    }


    private isFlightNumber(
        value: string
    ): boolean {

        return /^[A-Z]{2}\d{3,4}$/i
            .test(
                value.trim()
            );
    }
}