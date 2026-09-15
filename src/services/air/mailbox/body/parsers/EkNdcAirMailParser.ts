import {
    CheerioAPI,
    load
} from "cheerio";

import {
    AirMailParserDetection,
    AirTicketMailParser
} from "./interface/AirTicketMailParser.js";
import { AirBaggageAllowance, AirJourney, AirPassenger, AirPassengerType, AirSegment, AirTicketPriceComponent, ParsedAirTicketDocument } from "../../types/AirTicketTypes.js";
import { ParsedAirMail } from "../../types/ParsedAirMail.js";


interface EkFlightHint {

    carrier?: string;

    flightNumber?: string;

    departureAirportCode?: string;

    departureDate?: string;

    departureTime?: string;

    arrivalAirportCode?: string;

    arrivalDate?: string;

    arrivalTime?: string;
}


interface EkInvoice {

    passenger: AirPassenger;

    ticketNumber: string;

    ticketDate?: string;

    paymentMethodRaw?: string;

    currency?: string;

    base?: number;

    taxes?: number;

    total?: number;

    components:
    AirTicketPriceComponent[];
}


interface EkBaggageRow {

    routeFrom?: string;

    routeTo?: string;

    passengerName?: string;

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
}


export class EkNdcAirMailParser
    implements AirTicketMailParser {

    readonly id =
        "ek-ndc-mail-v1";

    readonly version =
        "1.0.0";


    detect(
        mail: ParsedAirMail
    ): AirMailParserDetection {

        const text =
            this.getSearchText(
                mail
            );


        const matchedMarkers:
            string[] = [];


        let confidence =
            0;


        const add = (
            expression: RegExp,
            marker: string,
            score: number
        ): void => {

            expression.lastIndex =
                0;


            if (
                expression.test(text)
            ) {

                matchedMarkers.push(
                    marker
                );

                confidence +=
                    score;
            }
        };


        add(
            /Itinerary for Record Locator/i,
            "ITINERARY_RECORD_LOCATOR",
            15
        );


        add(
            /Emirates Record Locator/i,
            "EMIRATES_RECORD_LOCATOR",
            25
        );


        add(
            /\bEmirates\b/i,
            "EMIRATES",
            20
        );


        add(
            /Invoice Information/i,
            "INVOICE_INFORMATION",
            15
        );


        add(
            /Electronic Ticket/i,
            "ELECTRONIC_TICKET",
            15
        );


        add(
            /Baggage Information/i,
            "BAGGAGE_INFORMATION",
            10
        );


        confidence =
            Math.min(
                confidence,
                100
            );


        return {

            supported:
                matchedMarkers.includes(
                    "EMIRATES_RECORD_LOCATOR"
                ) &&
                confidence >= 70,

            confidence,

            matchedMarkers
        };
    }


    parse(mail: ParsedAirMail, detection: AirMailParserDetection): ParsedAirTicketDocument[] {

        const text =
            this.getSearchText(
                mail
            );


        const $ =
            load(
                mail.html ??
                "<html></html>"
            );


        const orderId =
            this.firstGroup(
                text,
                /Itinerary for Record Locator\s+([A-Z0-9]+)/i
            );


        const bookingReference =
            this.firstGroup(
                text,
                /Emirates Record Locator\s+([A-Z0-9]+)/i
            );


        const issuingOffice =
            this.extractIssuingOffice(
                text
            );


        const invoices =
            this.extractInvoices(
                $,
                text
            );


        if (
            invoices.length === 0
        ) {

            throw new Error(
                "EK NDC email was detected, " +
                "but invoice/ticket data could not be extracted"
            );
        }


        const firstTicketDate =
            invoices[0]
                .ticketDate;


        const segments = this.extractSegments($, text, firstTicketDate);


        if (
            segments.length === 0
        ) {

            throw new Error(
                "EK NDC email was detected, " +
                "but flight segments could not be extracted"
            );
        }


        const baggageRows =
            this.extractBaggage(
                $,
                text
            );


        const journeys =
            this.createJourneys(
                segments,
                baggageRows
            );


        const grandTotal =
            this.extractGrandTotal(
                text
            );


        return invoices.map(
            (
                invoice,
                invoiceIndex
            ): ParsedAirTicketDocument => {

                const passengerKey =
                    this.passengerKey(
                        invoice
                            .passenger
                            .fullName
                    );


                const passengerBaggage =
                    baggageRows
                        .filter(
                            row =>
                                this.passengerKey(
                                    row.passengerName
                                ) ===
                                passengerKey
                        )
                        .map(
                            (
                                row,
                                index
                            ): AirBaggageAllowance => ({

                                journeyType:
                                    index === 0
                                        ? "DEPARTURE"
                                        : index === 1
                                            ? "RETURN"
                                            : "UNKNOWN",

                                checked:
                                    row.checked,

                                cabin:
                                    row.cabin
                            })
                        );


                const warnings =
                    this.createWarnings({
                        orderId,
                        ticketNumber:
                            invoice.ticketNumber,
                        passenger:
                            invoice.passenger.fullName,
                        segmentCount:
                            segments.length,
                        total:
                            invoice.total
                    });


                return {

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

                    source: {

                        type:
                            "EMAIL_HTML",

                        filename:
                            `mail_${mail.uid}.eml`,

                        size:
                            0,

                        pageCount:
                            0,

                        metadata:
                            {},

                        messageId:
                            mail.messageId,

                        subject:
                            mail.subject
                    },

                    provider: {

                        code:
                            "EK_NDC",

                        name:
                            "Emirates",

                        airlineCode:
                            "EK",

                        issuingOffice
                    },

                    identifiers: {

                        /*
                         * В этом шаблоне Accelya называет
                         * его Record Locator.
                         *
                         * Для нашей модели используем его
                         * как основной order identifier.
                         */
                        orderId,

                        bookingReference,

                        ticketNumber:
                            invoice.ticketNumber
                    },

                    passenger:
                        invoice.passenger,

                    segments,

                    journeys,

                    baggage:
                        passengerBaggage,

                    purchase: {

                        ticketDate:
                            invoice.ticketDate,

                        paymentMethod:
                            this.mapPaymentMethod(
                                invoice.paymentMethodRaw
                            ),

                        paymentMethodRaw:
                            invoice.paymentMethodRaw
                    },

                    pricing: {

                        currency:
                            invoice.currency,

                        total:
                            invoice.total,

                        orderTotal:
                            grandTotal?.amount ??
                            invoice.total,

                        components:
                            invoice.components
                    },

                    warnings
                };
            }
        );
    }


    private extractSegments($: CheerioAPI, text: string, ticketDate?: string): AirSegment[] {
        const hints = this.extractFlightHints($, text);
        const htmlSegments = this.extractSegmentsFromHtml($, hints, ticketDate);

        if (htmlSegments.length > 0) {
            return htmlSegments;
        }


        /*
         * Gmail/Outlook при пересылке могут
         * изменить исходный DOM и удалить
         * id="FlightTable".
         *
         * При этом содержимое таблицы остаётся
         * в text/plain / текстовом представлении HTML.
         */
        const textSegments = this.extractSegmentsFromText(text, hints, ticketDate);
        return textSegments;
    }


    /**
     * Очень полезный источник данных EK.
     *
     * iflybags URL содержит полные даты:
     *
     * dd1=2027-07-01
     * ad1=2027-07-02
     * dc1=DME
     * ac1=DXB
     */
    private extractFlightHints($: CheerioAPI, text: string): EkFlightHint[] {

        let href = $('a[href*="iflybags.com/bagservice.aspx"]').first().attr("href");

        if (!href) {
            const textUrl = text.match(/https?:\/\/(?:www\.)?iflybags\.com\/bagservice\.aspx\?[^\s<>"']+/i);
            href = textUrl?.[0];
        }

        if (!href) {
            return [];
        }

        try {

            const url = new URL(href.replace(/&amp;/g, "&"), "https://www.iflybags.com");
            const result: EkFlightHint[] = [];
            for (let index = 1; index <= 20; index++) {
                const flightNumber = url.searchParams.get(`flt${index}`);
                if (!flightNumber) {
                    break;
                }
                result.push({

                    carrier:
                        url.searchParams.get(
                            `ar${index}`
                        ) ??
                        undefined,

                    flightNumber,

                    departureAirportCode:
                        url.searchParams.get(
                            `dc${index}`
                        ) ??
                        undefined,

                    departureDate:
                        url.searchParams.get(
                            `dd${index}`
                        ) ??
                        undefined,

                    departureTime:
                        url.searchParams.get(
                            `dt${index}`
                        ) ??
                        undefined,

                    arrivalAirportCode:
                        url.searchParams.get(
                            `ac${index}`
                        ) ??
                        undefined,

                    arrivalDate:
                        url.searchParams.get(
                            `ad${index}`
                        ) ??
                        undefined,

                    arrivalTime:
                        url.searchParams.get(
                            `at${index}`
                        ) ??
                        undefined
                });
            }


            return result;

        } catch {

            return [];
        }
    }


    private extractInvoices(
        $: CheerioAPI,
        fallbackText: string
    ): EkInvoice[] {

        const result:
            EkInvoice[] = [];


        $("table").each(
            (
                _,
                table
            ) => {

                const tableText =
                    this.clean(
                        $(table).text()
                    );


                if (
                    !/Document Number/i.test(
                        tableText
                    ) ||
                    !/Electronic Ticket/i.test(
                        tableText
                    )
                ) {

                    return;
                }


                const rows =
                    $(table)
                        .children("tbody")
                        .children("tr");


                const firstRow =
                    rows.first();


                const passengerLabel =
                    this.clean(
                        firstRow
                            .children("th")
                            .first()
                            .text()
                    );


                const passenger =
                    this.parsePassenger(
                        passengerLabel
                    );


                if (!passenger) {
                    return;
                }


                let ticketNumber:
                    string | undefined;


                let ticketDate:
                    string | undefined;


                let paymentMethodRaw:
                    string | undefined;


                let base:
                    number | undefined;


                let taxes:
                    number | undefined;


                let total:
                    number | undefined;


                let currency:
                    string | undefined;


                rows.each(
                    (
                        _,
                        row
                    ) => {

                        const cells =
                            $(row)
                                .children("td");


                        const values =
                            cells
                                .toArray()
                                .map(
                                    cell =>
                                        this.clean(
                                            $(cell).text()
                                        )
                                );


                        if (
                            values[0] ===
                            "Electronic Ticket"
                        ) {

                            ticketNumber =
                                values[1];

                            ticketDate =
                                this.parseEkFullDate(
                                    values[2]
                                );
                        }


                        if (
                            values[0] &&
                            /Form of Payment:/i
                                .test(
                                    values[0]
                                )
                        ) {

                            paymentMethodRaw =
                                values[0]
                                    .replace(
                                        /.*Form of Payment:\s*/i,
                                        ""
                                    )
                                    .trim();


                            const nonEmpty =
                                values
                                    .slice(1)
                                    .filter(Boolean);


                            if (
                                nonEmpty.length >= 4
                            ) {

                                base =
                                    this.toMoney(
                                        nonEmpty[
                                        nonEmpty.length - 4
                                        ]
                                    );

                                taxes =
                                    this.toMoney(
                                        nonEmpty[
                                        nonEmpty.length - 3
                                        ]
                                    );

                                total =
                                    this.toMoney(
                                        nonEmpty[
                                        nonEmpty.length - 2
                                        ]
                                    );

                                currency =
                                    nonEmpty[
                                    nonEmpty.length - 1
                                    ];
                            }
                        }
                    }
                );


                if (!ticketNumber) {
                    return;
                }


                const components:
                    AirTicketPriceComponent[] = [];


                if (
                    base !== undefined &&
                    currency
                ) {

                    components.push({
                        code:
                            "BASE",

                        amount:
                            base,

                        currency
                    });
                }


                const taxExpression =
                    /TAX:\s*([A-Z]{3})\s+([\d.,]+)\s+([A-Z0-9]{2,3})/gi;


                let taxMatch:
                    RegExpExecArray | null;


                while (
                    (
                        taxMatch =
                        taxExpression.exec(
                            tableText
                        )
                    ) !== null
                ) {

                    const amount =
                        this.toMoney(
                            taxMatch[2]
                        );


                    if (
                        amount === undefined
                    ) {
                        continue;
                    }


                    components.push({

                        code:
                            taxMatch[3],

                        amount,

                        currency:
                            taxMatch[1]
                    });
                }


                result.push({

                    passenger,

                    ticketNumber,

                    ticketDate,

                    paymentMethodRaw,

                    base,

                    taxes,

                    total,

                    currency,

                    components
                });
            }
        );


        /*
         * Если EK однажды немного изменит HTML,
         * оставляем fallback через text/plain.
         */
        if (
            result.length === 0
        ) {

            const ticket =
                fallbackText.match(
                    /Electronic Ticket\s+(\d{12,14})\s+(\d{2}[A-Z]{3}\d{2})/i
                );


            const passengerMatch =
                fallbackText.match(
                    /\b([A-Z][A-Z'-]{1,}(?:\s+[A-Z][A-Z'-]{1,}){1,5})\s+\((ADT|CHD|INF)\)\s+FF#/i
                );


            if (
                ticket &&
                passengerMatch
            ) {

                const passenger =
                    this.createPassenger(
                        passengerMatch[1],
                        passengerMatch[2]
                    );


                const payment =
                    fallbackText.match(
                        /Form of Payment:\s*([A-Z]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([A-Z]{3})/i
                    );


                result.push({

                    passenger,

                    ticketNumber:
                        ticket[1],

                    ticketDate:
                        this.parseEkFullDate(
                            ticket[2]
                        ),

                    paymentMethodRaw:
                        payment?.[1],

                    base:
                        this.toMoney(
                            payment?.[2]
                        ),

                    taxes:
                        this.toMoney(
                            payment?.[3]
                        ),

                    total:
                        this.toMoney(
                            payment?.[4]
                        ),

                    currency:
                        payment?.[5],

                    components:
                        []
                });
            }
        }


        return result;
    }


    private extractBaggage(
        $: CheerioAPI,
        text: string
    ): EkBaggageRow[] {

        const result:
            EkBaggageRow[] = [];


        $("table").each(
            (
                _,
                table
            ) => {

                const tableText =
                    this.clean(
                        $(table).text()
                    );


                if (
                    !/Airport Codes/i.test(
                        tableText
                    ) ||
                    !/Checked Allowance/i.test(
                        tableText
                    )
                ) {

                    return;
                }


                const rows =
                    $(table)
                        .children("tbody")
                        .children("tr");


                rows.each(
                    (
                        _,
                        row
                    ) => {

                        const cells =
                            $(row)
                                .children("td");


                        if (
                            cells.length < 7
                        ) {
                            return;
                        }


                        const values =
                            cells
                                .toArray()
                                .map(
                                    cell =>
                                        this.clean(
                                            $(cell).text()
                                        )
                                );


                        const route =
                            values[0]
                                ?.match(
                                    /^([A-Z]{3})-([A-Z]{3})$/
                                );


                        if (!route) {
                            return;
                        }


                        const checked =
                            this.parseAllowance(
                                values[4]
                            );


                        const cabin =
                            this.parseAllowance(
                                values[5]
                            );


                        /*
                         * В flight detail EK дополнительно
                         * сообщает:
                         *
                         * Hand luggage x 1 bag 7KG
                         */
                        const handLuggage =
                            text.match(
                                /Hand luggage\s+x\s+(\d+)\s+bag\s+([\d.,]+)KG/i
                            );


                        if (
                            cabin &&
                            handLuggage
                        ) {

                            cabin.pieces =
                                Number(
                                    handLuggage[1]
                                );

                            cabin.weight =
                                this.toMoney(
                                    handLuggage[2]
                                );

                            cabin.weightUnit =
                                "KG";
                        }


                        result.push({

                            routeFrom:
                                route[1],

                            routeTo:
                                route[2],

                            passengerName:
                                values[1]
                                    ?.replace(
                                        /\s+\((ADT|CHD|INF)\)$/i,
                                        ""
                                    ),

                            checked,

                            cabin
                        });
                    }
                );
            }
        );


        return result;
    }


    private createJourneys(
        segments: AirSegment[],
        baggage: EkBaggageRow[]
    ): AirJourney[] {

        if (
            baggage.length === 0
        ) {

            return [{
                type:
                    "DEPARTURE",

                departure: {
                    city:
                        segments[0]
                            ?.departure
                            .city,

                    airportCode:
                        segments[0]
                            ?.departure
                            .airportCode
                },

                arrival: {
                    city:
                        segments[
                            segments.length - 1
                        ]?.arrival.city,

                    airportCode:
                        segments[
                            segments.length - 1
                        ]?.arrival.airportCode
                },

                segmentSequences:
                    segments.map(
                        segment =>
                            segment.sequence
                    )
            }];
        }


        const result:
            AirJourney[] = [];


        let searchFrom =
            0;


        baggage.forEach(
            (
                route,
                routeIndex
            ) => {

                const sequences:
                    number[] = [];


                for (
                    let index = searchFrom;
                    index < segments.length;
                    index++
                ) {

                    const segment =
                        segments[index];


                    if (
                        sequences.length === 0 &&
                        segment.departure
                            .airportCode !==
                        route.routeFrom
                    ) {

                        continue;
                    }


                    sequences.push(
                        segment.sequence
                    );


                    if (
                        segment.arrival
                            .airportCode ===
                        route.routeTo
                    ) {

                        searchFrom =
                            index + 1;

                        break;
                    }
                }


                if (
                    sequences.length === 0
                ) {

                    return;
                }


                result.push({

                    type:
                        routeIndex === 0
                            ? "DEPARTURE"
                            : routeIndex === 1
                                ? "RETURN"
                                : "UNKNOWN",

                    departure: {
                        airportCode:
                            route.routeFrom
                    },

                    arrival: {
                        airportCode:
                            route.routeTo
                    },

                    segmentSequences:
                        sequences
                });
            }
        );


        return result;
    }


    private parsePassenger(
        value: string
    ): AirPassenger | undefined {

        const match =
            value.match(
                /^(.+?)\s+\((ADT|CHD|INF)\)$/i
            );


        if (!match) {
            return undefined;
        }


        return this.createPassenger(
            match[1],
            match[2]
        );
    }


    private createPassenger(
        fullName: string,
        type: string
    ): AirPassenger {

        const cleanName =
            this.clean(
                fullName
            );


        const parts =
            cleanName
                .split(/\s+/);


        return {

            fullName:
                cleanName,

            firstName:
                parts[0],

            lastName:
                parts.length > 1
                    ? parts
                        .slice(1)
                        .join(" ")
                    : undefined,

            type:
                this.mapPassengerType(
                    type
                )
        };
    }


    private mapPassengerType(
        value: string
    ): AirPassengerType {

        switch (
        value.toUpperCase()
        ) {

            case "ADT":
                return "ADULT";

            case "CHD":
                return "CHILD";

            case "INF":
                return "INFANT";

            default:
                return "UNKNOWN";
        }
    }


    private parseAllowance(
        value: string | undefined
    ):
        | {
            pieces?: number;
            weight?: number;
            weightUnit?: string;
            raw?: string;
        }
        | undefined {

        if (!value) {
            return undefined;
        }


        const normalized =
            this.clean(value);


        const weight =
            normalized.match(
                /^([\d.,]+)KG$/i
            );


        if (weight) {

            return {

                weight:
                    this.toMoney(
                        weight[1]
                    ),

                weightUnit:
                    "KG",

                raw:
                    normalized
            };
        }


        const pieces =
            normalized.match(
                /^(\d+)PC$/i
            );


        if (pieces) {

            return {

                pieces:
                    Number(
                        pieces[1]
                    ),

                raw:
                    normalized
            };
        }


        return {
            raw:
                normalized
        };
    }


    private extractGrandTotal(
        text: string
    ):
        | {
            amount: number;
            currency: string;
        }
        | undefined {

        const match =
            text.match(
                /Grand Total for all travelers\s+Amount\s+Currency\s+([\d.,]+)\s+([A-Z]{3})/i
            );


        if (!match) {
            return undefined;
        }


        const amount =
            this.toMoney(
                match[1]
            );


        if (
            amount === undefined
        ) {

            return undefined;
        }


        return {

            amount,

            currency:
                match[2]
        };
    }


    private extractIssuingOffice(
        text: string
    ): string | undefined {

        const match =
            text.match(
                /\bZCTS\s+IATA:\s*(\d+)/i
            );


        return match
            ? `ZCTS IATA: ${match[1]}`
            : undefined;
    }


    private resolveDisplayedDateTime(
        value: string,
        referenceDate?: string
    ):
        | {
            date?: string;
            time?: string;
        }
        | undefined {

        const match =
            this.clean(value)
                .match(
                    /(?:MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{2})([A-Z]{3})\s+(\d{2}:\d{2})/i
                );


        if (!match) {
            return undefined;
        }


        if (!referenceDate) {

            return {
                time:
                    match[3]
            };
        }


        const month =
            this.monthNumber(
                match[2]
            );


        if (!month) {

            return {
                time:
                    match[3]
            };
        }


        let year =
            Number(
                referenceDate.slice(
                    0,
                    4
                )
            );


        const candidate =
            `${year}-` +
            `${String(month).padStart(2, "0")}-` +
            `${match[1]}`;


        if (
            candidate <
            referenceDate
        ) {

            year++;
        }


        return {

            date:
                `${year}-` +
                `${String(month).padStart(2, "0")}-` +
                `${match[1]}`,

            time:
                match[3]
        };
    }


    private parseEkFullDate(
        value: string | undefined
    ): string | undefined {

        if (!value) {
            return undefined;
        }


        const match =
            this.clean(value)
                .match(
                    /^(\d{2})([A-Z]{3})(\d{2})$/i
                );


        if (!match) {
            return undefined;
        }


        const month =
            this.monthNumber(
                match[2]
            );


        if (!month) {
            return undefined;
        }


        const year =
            2000 +
            Number(match[3]);


        return (
            `${year}-` +
            `${String(month).padStart(2, "0")}-` +
            `${match[1]}`
        );
    }


    private monthNumber(
        value: string
    ): number | undefined {

        const months:
            Record<string, number> = {

            JAN: 1,
            FEB: 2,
            MAR: 3,
            APR: 4,
            MAY: 5,
            JUN: 6,
            JUL: 7,
            AUG: 8,
            SEP: 9,
            OCT: 10,
            NOV: 11,
            DEC: 12
        };


        return months[
            value.toUpperCase()
        ];
    }


    private mapPaymentMethod(
        value: string | undefined
    ):
        "CASH" |
        "CARD" |
        "BANK_TRANSFER" |
        "UNKNOWN" {

        if (!value) {
            return "UNKNOWN";
        }


        if (
            /CASH/i.test(value)
        ) {
            return "CASH";
        }


        if (
            /CARD|VISA|MASTER/i.test(value)
        ) {
            return "CARD";
        }


        if (
            /TRANSFER/i.test(value)
        ) {
            return "BANK_TRANSFER";
        }


        return "UNKNOWN";
    }


    private getSearchText(
        mail: ParsedAirMail
    ): string {

        if (
            mail.text
        ) {

            return this.clean(
                mail.text
            );
        }


        if (
            mail.html
        ) {

            const $ =
                load(
                    mail.html
                );


            $("br").replaceWith("\n");

            $("tr").each(
                (
                    _,
                    row
                ) => {

                    $(row).append(
                        "\n"
                    );
                }
            );


            return this.clean(
                $.text()
            );
        }


        return "";
    }


    private cleanAirportName(
        value: string
    ): string {

        return this.clean(
            value
        ).replace(
            /\s*Terminal:\s*\S+\s*$/i,
            ""
        );
    }


    private clean(
        value: string
    ): string {

        return value
            .replace(
                /\u00A0/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }


    private toMoney(
        value: string | undefined
    ): number | undefined {

        if (!value) {
            return undefined;
        }


        const result =
            Number(
                value
                    .replace(
                        /\s/g,
                        ""
                    )
                    .replace(
                        /,/g,
                        "."
                    )
            );


        return Number.isFinite(result)
            ? result
            : undefined;
    }


    private passengerKey(
        value: string | undefined
    ): string {

        return (
            value ??
            ""
        )
            .replace(
                /[^A-ZА-ЯЁ]/gi,
                ""
            )
            .toUpperCase();
    }


    private firstGroup(
        text: string,
        expression: RegExp
    ): string | undefined {

        return expression.exec(
            text
        )?.[1];
    }


    private createWarnings(
        data: {
            orderId?: string;
            ticketNumber?: string;
            passenger?: string;
            segmentCount: number;
            total?: number;
        }
    ): {
        code: string;
        message: string;
    }[] {

        const warnings:
            {
                code: string;
                message: string;
            }[] = [];


        if (!data.orderId) {

            warnings.push({
                code:
                    "ORDER_ID_NOT_FOUND",

                message:
                    "EK Record Locator not found"
            });
        }


        if (!data.passenger) {

            warnings.push({
                code:
                    "PASSENGER_NOT_FOUND",

                message:
                    "EK passenger not found"
            });
        }


        if (data.total === undefined) {

            warnings.push({
                code: "TOTAL_NOT_FOUND",
                message: "EK ticket total not found"
            });
        }


        return warnings;
    }

    private extractSegmentsFromHtml($: CheerioAPI, hints: EkFlightHint[], ticketDate?: string): AirSegment[] {

        const segments: AirSegment[] = [];
        const flightTable = $("#FlightTable").first();

        if (flightTable.length === 0) {

            return [];
        }

        const rows = flightTable.children("tbody").children("tr");
        rows.each((_, row) => {
            const cells = $(row).children("td");
            if (cells.length < 9) {

                return;
            }


            const airline = this.clean($(cells[0]).text());
            const rawFlightNumber = this.clean($(cells[1]).text());

            if (!/Emirates/i.test(airline) || !/^\d{1,4}$/.test(rawFlightNumber)) {
                return;
            }

            const sequence = segments.length + 1;
            const hint = hints[sequence - 1];
            const departureText = this.cleanAirportName($(cells[2]).text());
            const departureDateTime = this.clean($(cells[3]).text());
            const arrivalText = this.cleanAirportName($(cells[4]).text());
            const arrivalDateTime = this.clean($(cells[5]).text());
            const bookingClass = this.clean($(cells[6]).text());
            const cabin = this.clean($(cells[7]).text());
            const previousDate = segments.length > 0 ? segments[segments.length - 1].arrival.date : ticketDate;
            const departure = this.resolveDisplayedDateTime(departureDateTime, previousDate);
            const arrival = this.resolveDisplayedDateTime(arrivalDateTime, departure?.date ?? previousDate);
            segments.push({
                sequence,
                flightNumber: `EK${(hint?.flightNumber ?? rawFlightNumber).padStart(4, "0")}`,
                departure: {
                    city: departureText,
                    airportCode: hint?.departureAirportCode,
                    date: hint?.departureDate ?? departure?.date,
                    time: hint?.departureTime ?? departure?.time
                },

                arrival: {
                    city: arrivalText,
                    airportCode: hint?.arrivalAirportCode,
                    date: hint?.arrivalDate ?? arrival?.date,
                    time: hint?.arrivalTime ?? arrival?.time
                },
                marketingCarrier: {
                    code: "EK",
                    name: "Emirates"
                },
                bookingClass: bookingClass || undefined,
                cabin: cabin || undefined
            });
        }
        );

        return segments;
    }

    private extractSegmentsFromText(text: string, hints: EkFlightHint[], ticketDate?: string): AirSegment[] {
        const segments: AirSegment[] = [];
        /*
         * После getSearchText() whitespace уже
         * нормализован.
         *
         * Пример:
         *
         * Emirates 132 Moscow Domodedovo Apt, RU
         * THU 01JUL 23:10
         * Dubai International, AE Terminal:3
         * FRI 02JUL 05:30 K Y M
         */
        const expression = /Emirates\s+(\d{1,4})\s+(.+?),\s*([A-Z]{2})\s+(?:Terminal:\S+\s+)?((?:MON|TUE|WED|THU|FRI|SAT|SUN)\s+\d{2}[A-Z]{3}\s+\d{2}:\d{2})\s+(.+?),\s*([A-Z]{2})\s+(?:Terminal:\S+\s+)?((?:MON|TUE|WED|THU|FRI|SAT|SUN)\s+\d{2}[A-Z]{3}\s+\d{2}:\d{2})\s+([A-Z])\s+([A-Z])(?:\s+([A-Z]))?/gi;
        let match: RegExpExecArray | null;
        while ((match = expression.exec(text)) !== null) {

            const sequence = segments.length + 1;
            const hint = hints[sequence - 1];
            const rawFlightNumber = match[1];
            const departureCity = this.clean(match[2]);
            const departureDisplay = match[4];
            const arrivalCity = this.clean(match[5]);
            const arrivalDisplay = match[7];
            const bookingClass = match[8];
            const cabin = match[9];

            const previousDate = segments.length > 0 ? segments[segments.length - 1].arrival.date : ticketDate;

            const departure = this.resolveDisplayedDateTime(departureDisplay, previousDate);
            const arrival = this.resolveDisplayedDateTime(arrivalDisplay, departure?.date ?? previousDate);

            segments.push({
                sequence,
                flightNumber: `EK${(hint?.flightNumber ?? rawFlightNumber).padStart(4, "0")}`,
                departure: {
                    city: departureCity,
                    airportCode: hint?.departureAirportCode,
                    date: hint?.departureDate ?? departure?.date,
                    time: hint?.departureTime ?? departure?.time
                },

                arrival: {
                    city: arrivalCity, airportCode: hint?.arrivalAirportCode,
                    date: hint?.arrivalDate ?? arrival?.date,
                    time: hint?.arrivalTime ?? arrival?.time
                },

                marketingCarrier: {
                    code: "EK",
                    name: "Emirates"
                },

                bookingClass,
                cabin
            });
        }


        return segments;
    }
}