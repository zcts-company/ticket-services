import { PdfAnalysisResult } from "../../../../bus/bus_mail/pdf/types/PdfTypes.js";
import {
    AirPaymentMethod,
    AirTicketParseWarning,
    AirTicketSource
} from "../../types/AirTicketTypes.js";


export interface ParsedAirportPoint {
    city: string;
    airportCode: string;
    time: string;
}


export interface ParsedCurrencyMoney {
    currency: string;
    amount: number;
}


export abstract class BaseAirTicketPdfParser {

    private readonly monthNumbers:
        Record<string, number> = {

            jan: 1,
            feb: 2,
            mar: 3,
            apr: 4,
            may: 5,
            jun: 6,
            jul: 7,
            aug: 8,
            sep: 9,
            oct: 10,
            nov: 11,
            dec: 12
        };


    protected clean(
        value: string
    ): string {

        return value
            .replace(
                /\u00A0/g,
                " "
            )
            .replace(
                /[‐-‒–—−]/g,
                "-"
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }


    protected normalizeLines(
        analysis: PdfAnalysisResult
    ): string[] {

        return analysis.lines
            .map(
                (line) =>
                    this.clean(line)
            )
            .filter(Boolean);
    }


    protected findValueAfterLabel(
        lines: string[],
        labelExpression: RegExp
    ): string | undefined {

        for (
            let index = 0;
            index < lines.length;
            index++
        ) {

            labelExpression.lastIndex = 0;

            if (
                !labelExpression.test(
                    lines[index]
                )
            ) {
                continue;
            }


            const nextLine =
                lines[index + 1];


            return nextLine
                ? this.clean(nextLine)
                : undefined;
        }


        return undefined;
    }


    /**
     * 14 Aug, 2026
     *
     * ->
     *
     * 2026-08-14
     */
    protected toIsoEnglishDate(
        value: string | undefined
    ): string | undefined {

        if (!value) {
            return undefined;
        }


        const match =
            this.clean(value).match(
                /^(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})$/i
            );


        if (!match) {
            return undefined;
        }


        const day =
            Number(match[1]);

        const month =
            this.monthNumbers[
            match[2]
                .toLowerCase()
            ];

        const year =
            Number(match[3]);


        if (
            !month ||
            !Number.isInteger(day) ||
            day < 1 ||
            day > 31
        ) {
            return undefined;
        }


        return (
            `${year}-` +
            `${String(month).padStart(2, "0")}-` +
            `${String(day).padStart(2, "0")}`
        );
    }


    /**
     * В TK flight date выглядит:
     *
     * 30 Sep, Wed
     *
     * года в строке нет.
     *
     * Восстанавливаем его относительно
     * Ticket Date либо предыдущего сегмента.
     */
    protected resolveTravelDate(
        value: string,
        notBeforeIsoDate: string
    ): string | undefined {

        const match =
            this.clean(value).match(
                /^(\d{1,2})\s+([A-Za-z]{3})(?:,\s*[A-Za-z]{3})?$/i
            );


        if (!match) {
            return undefined;
        }


        const day =
            Number(match[1]);

        const month =
            this.monthNumbers[
            match[2]
                .toLowerCase()
            ];


        if (!month) {
            return undefined;
        }


        const reference =
            this.parseIsoDate(
                notBeforeIsoDate
            );


        if (!reference) {
            return undefined;
        }


        let year =
            reference.getUTCFullYear();


        let candidate =
            new Date(
                Date.UTC(
                    year,
                    month - 1,
                    day
                )
            );


        /*
         * Например:
         *
         * ticket date: Dec 2026
         * flight date: 05 Jan
         *
         * значит flight date -> Jan 2027.
         */
        if (
            candidate.getTime() <
            reference.getTime()
        ) {

            year++;

            candidate =
                new Date(
                    Date.UTC(
                        year,
                        month - 1,
                        day
                    )
                );
        }


        return (
            `${candidate.getUTCFullYear()}-` +
            `${String(
                candidate.getUTCMonth() + 1
            ).padStart(2, "0")}-` +
            `${String(
                candidate.getUTCDate()
            ).padStart(2, "0")}`
        );
    }


    protected parseAirportPoint(
        value: string
    ): ParsedAirportPoint | undefined {

        /*
         * Moscow (VKO) • 00:30
         */
        const match =
            this.clean(value).match(
                /^(.+?)\s+\(([A-Z]{3})\)\s*[•·]\s*(\d{2}:\d{2})$/i
            );


        if (!match) {
            return undefined;
        }


        return {
            city:
                this.clean(
                    match[1]
                ),

            airportCode:
                match[2]
                    .toUpperCase(),

            time:
                match[3]
        };
    }


    protected extractCurrencyMoney(
        value: string | undefined
    ): ParsedCurrencyMoney | undefined {

        if (!value) {
            return undefined;
        }


        const normalized =
            this.clean(value);


        const match =
            normalized.match(
                /\b([A-Z]{3})\s+([\d\s,.]+)/i
            );


        if (!match) {
            return undefined;
        }


        const amount =
            this.toMoney(
                match[2]
            );


        if (
            amount === undefined
        ) {
            return undefined;
        }


        return {
            currency:
                match[1]
                    .toUpperCase(),

            amount
        };
    }


    protected toMoney(
        value: string | undefined
    ): number | undefined {

        if (!value) {
            return undefined;
        }


        let normalized =
            value
                .replace(
                    /[\s\u00A0]/g,
                    ""
                );


        /*
         * TK:
         *
         * 86,520.00
         *
         * ->
         *
         * 86520.00
         */
        if (
            normalized.includes(".") &&
            normalized.includes(",")
        ) {

            normalized =
                normalized.replace(
                    /,/g,
                    ""
                );

        } else if (
            normalized.includes(",")
        ) {

            normalized =
                normalized.replace(
                    ",",
                    "."
                );
        }


        const amount =
            Number(normalized);


        return Number.isFinite(amount)
            ? amount
            : undefined;
    }


    protected mapPaymentMethod(
        value: string | undefined
    ): AirPaymentMethod {

        if (!value) {
            return "UNKNOWN";
        }


        if (
            /cash/i.test(value)
        ) {
            return "CASH";
        }


        if (
            /card|credit|visa|mastercard/i
                .test(value)
        ) {
            return "CARD";
        }


        if (
            /bank\s*transfer|wire/i
                .test(value)
        ) {
            return "BANK_TRANSFER";
        }


        return "UNKNOWN";
    }


    protected normalizePassengerName(
        value: string
    ): string {

        return this.clean(value);
    }


    protected passengerNameKey(
        value: string
    ): string {

        return this.clean(value)
            .replace(
                /^(mr|mrs|ms|miss|mstr|dr)\.?\s+/i,
                ""
            )
            .replace(
                /[^a-zа-яё]/gi,
                ""
            )
            .toLowerCase();
    }


    protected source(
        analysis: PdfAnalysisResult
    ): AirTicketSource {

        return {
            type: "PDF",
            filename: analysis.filename,
            checksum: analysis.checksum,
            size: analysis.size,
            pageCount: analysis.pageCount,
            pageNumbers: analysis.pages.map((page) => page.pageNumber),
            metadata: analysis.metadata
        };
    }


    protected createWarnings(
        data: {
            orderId?: string;
            ticketNumber?: string;
            passengerName?: string;
            segmentCount: number;
            total?: number;
        }
    ): AirTicketParseWarning[] {

        const warnings:
            AirTicketParseWarning[] = [];


        if (!data.orderId) {
            warnings.push({
                code:
                    "ORDER_ID_NOT_FOUND",

                message:
                    "Не удалось извлечь Order ID"
            });
        }


        if (!data.ticketNumber) {
            warnings.push({
                code:
                    "TICKET_NUMBER_NOT_FOUND",

                message:
                    "Не удалось извлечь номер авиабилета"
            });
        }


        if (!data.passengerName) {
            warnings.push({
                code:
                    "PASSENGER_NAME_NOT_FOUND",

                message:
                    "Не удалось извлечь имя пассажира"
            });
        }


        if (
            data.segmentCount === 0
        ) {
            warnings.push({
                code:
                    "FLIGHT_SEGMENTS_NOT_FOUND",

                message:
                    "Не удалось извлечь сегменты перелета"
            });
        }


        if (
            data.total === undefined
        ) {
            warnings.push({
                code:
                    "TOTAL_PRICE_NOT_FOUND",

                message:
                    "Не удалось определить стоимость авиабилета"
            });
        }


        return warnings;
    }


    protected validateCriticalFields(
        data: {
            parserName: string;
            orderId?: string;
            ticketNumber?: string;
            segmentCount: number;
        }
    ): void {

        const missingFields:
            string[] = [];


        if (!data.orderId) {
            missingFields.push(
                "orderId"
            );
        }


        if (!data.ticketNumber) {
            missingFields.push(
                "ticketNumber"
            );
        }


        if (
            data.segmentCount === 0
        ) {
            missingFields.push(
                "flight segments"
            );
        }


        if (
            missingFields.length > 0
        ) {

            throw new Error(
                `${data.parserName} PDF was detected, ` +
                `but critical fields could not be extracted: ` +
                `${missingFields.join(", ")}`
            );
        }
    }


    private parseIsoDate(
        value: string
    ): Date | undefined {

        const match =
            value.match(
                /^(\d{4})-(\d{2})-(\d{2})$/
            );


        if (!match) {
            return undefined;
        }


        const result =
            new Date(
                Date.UTC(
                    Number(match[1]),
                    Number(match[2]) - 1,
                    Number(match[3])
                )
            );


        return Number.isNaN(
            result.getTime()
        )
            ? undefined
            : result;
    }
}