import {
    ParsedAirTicketDocument
} from "../types/AirTicketTypes.js";

import {
    ParsedAirMail
} from "../types/ParsedAirMail.js";
import { EkNdcAirMailParser } from "./parsers/EkNdcAirMailParser.js";
import { AirMailParserDetection, AirTicketMailParser } from "./parsers/interface/AirTicketMailParser.js";


interface DetectedMailParser {

    parser:    AirTicketMailParser;
    detection:    AirMailParserDetection;
}


export class AirTicketMailParserService {

    constructor(
        private readonly parsers:
            AirTicketMailParser[] = [
                new EkNdcAirMailParser()
            ]
    ) {

        if (
            parsers.length === 0
        ) {

            throw new Error(
                "AirTicketMailParserService requires " +
                "at least one mail parser"
            );
        }
    }


    /**
     * Важное отличие от PDF service:
     *
     * неподдерживаемое тело письма НЕ является ошибкой.
     *
     * Это может быть TK письмо, где билет лежит
     * только во вложенном PDF.
     */
    parse(
        mail: ParsedAirMail
    ): ParsedAirTicketDocument[] {

        const detected =
            this.parsers
                .map(
                    (parser): DetectedMailParser => ({
                        parser,
                        detection:
                            parser.detect(mail)
                    })
                )
                .sort(
                    (a, b) =>
                        b.detection.confidence -
                        a.detection.confidence
                );


        const supported =
            detected.filter(
                item =>
                    item.detection.supported
            );


        if (
            supported.length === 0
        ) {

            return [];
        }


        const errors:
            string[] = [];


        for (
            const {
                parser,
                detection
            }
            of supported
        ) {

            try {

                const documents =
                    parser.parse(
                        mail,
                        detection
                    );


                if (
                    !Array.isArray(documents) ||
                    documents.length === 0
                ) {

                    throw new Error(
                        `Parser "${parser.id}" ` +
                        `returned zero AIR tickets`
                    );
                }


                return documents;

            } catch (error: unknown) {

                errors.push(
                    `${parser.id} ` +
                    `(confidence: ${detection.confidence}): ` +
                    this.getErrorMessage(error)
                );
            }
        }


        /*
         * Здесь письмо было определено как EK,
         * но сам EK parser сломался.
         *
         * Это уже ошибка, письмо удалять нельзя.
         */
        throw new Error(
            `All detected AIR mail parsers failed. ` +
            errors.join(" | ")
        );
    }


    private getErrorMessage(
        error: unknown
    ): string {

        if (
            error instanceof Error
        ) {

            return (
                error.message ||
                error.name
            );
        }


        if (
            typeof error === "string"
        ) {

            return error;
        }


        try {

            return JSON.stringify(
                error
            );

        } catch {

            return "Unknown AIR mail parser error";
        }
    }
}