import { ParsedAirTicketDocument } from "../types/AirTicketTypes.js";
import { AirTicketPdfParser, PdfParserDetection } from "./parsers/interface/AirTicketPdfParser.js";
import { PdfAnalysisResult } from "../../../bus/bus_mail/pdf/types/PdfTypes.js";
import { TkNdcAirTicketPdfParser } from "./parsers/TkNdcAirTicketPdfParser.js";


interface DetectedParser {
    parser: AirTicketPdfParser;
    detection: PdfParserDetection;
}

export class AirTicketPdfParserService {

    constructor(private readonly parsers: AirTicketPdfParser[] = [
        new TkNdcAirTicketPdfParser()

        /*
         * Добавим после получения
         * примера Emirates NDC.
         *
         * new EkNdcAirTicketPdfParser()
         */
    ]
    ) {
        if (parsers.length === 0) {
            throw new Error("AirTicketPdfParserService requires " + "at least one PDF parser");
        }
    }


    /**
     * Разбирает весь PDF.
     *
     * Алгоритм:
     *
     * 1. Каждый зарегистрированный парсер выполняет detect().
     * 2. Парсеры сортируются по confidence.
     * 3. unsupported исключаются.
     * 4. Пробуем supported-парсеры от наиболее уверенного.
     * 5. Первый успешно разобравший документ побеждает.
     *
     * Один PDF может вернуть несколько авиабилетов.
     */
    parse(analysis: PdfAnalysisResult): ParsedAirTicketDocument[] {
        const detectedParsers = this.detectParsers(analysis);
        const supportedParsers = detectedParsers.filter(({ detection }) => detection.supported);

        if (supportedParsers.length === 0) {
            const detectionDetails = detectedParsers.map(({ parser, detection }) => {

                return (
                    `${parser.id}: ` +
                    `supported=${detection.supported}, ` +
                    `confidence=${detection.confidence}, ` +
                    `markers=[` +
                    `${detection.matchedMarkers.join(", ")}` +
                    `]`
                );
            }
            )
                .join(" | ");

            throw new Error(
                `Unsupported AIR PDF ticket format: ` +
                `"${analysis.filename}". ` +
                `Detection results: ${detectionDetails}`
            );
        }

        const parserErrors: string[] = [];

        for (
            const { parser, detection } of supportedParsers) {
            try {
                const documents = parser.parse(analysis, detection);
                this.validateParserResult(parser, analysis, documents);

                return documents;

            } catch (error: unknown) {

                parserErrors.push(
                    `${parser.id} ` +
                    `(confidence: ${detection.confidence}): ` +
                    this.getErrorMessage(error)
                );
            }
        }

        throw new Error(
            `All detected AIR PDF parsers failed for ` +
            `"${analysis.filename}". ` +
            parserErrors.join(" | ")
        );
    }


    private detectParsers(analysis: PdfAnalysisResult): DetectedParser[] {

        return this.parsers
            .map((parser): DetectedParser => ({ parser, detection: parser.detect(analysis) }))
            .sort((first, second) => second.detection.confidence - first.detection.confidence);
    }


    /**
     * Парсер, который заявил supported=true,
     * не должен молча вернуть пустой результат.
     */
    private validateParserResult(parser: AirTicketPdfParser, analysis: PdfAnalysisResult, documents: ParsedAirTicketDocument[]): void {

        if (!Array.isArray(documents)) {
            throw new Error(
                `Parser "${parser.id}" returned ` +
                `an invalid result for ` +
                `"${analysis.filename}". ` +
                `Expected ParsedAirTicketDocument[]`
            );
        }

        if (documents.length === 0) {
            throw new Error(
                `Parser "${parser.id}" detected ` +
                `"${analysis.filename}", but returned ` +
                `zero air tickets`
            );
        }

        for (let index = 0; index < documents.length; index++) {

            const document = documents[index];

            if (!document) {
                throw new Error(
                    `Parser "${parser.id}" returned ` +
                    `an empty document at index ${index}`
                );
            }

            if (document.documentType !== "AIR_TICKET") {
                throw new Error(
                    `Parser "${parser.id}" returned ` +
                    `unexpected documentType ` +
                    `"${document.documentType}" ` +
                    `at index ${index}`
                );
            }
        }
    }


    private getErrorMessage(error: unknown): string {

        if (error instanceof Error) {
            return (error.message || error.name);
        }

        if (typeof error === "string") {
            return (error || "Empty string error");
        }

        try {
            return JSON.stringify(error);
        } catch {
            return "Unknown AIR parser error";
        }
    }
}