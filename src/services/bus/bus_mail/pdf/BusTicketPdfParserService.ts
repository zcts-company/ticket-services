import { PdfAnalysisResult, PdfPageAnalysisResult } from "./types/PdfTypes.js";
import { ParsedBusTicketDocument } from "./types/BusTicketTypes.js";
import { BusforBusTicketPdfParser } from "./parsers/BusforBusTicketPdfParser.js";
import { UnsupportedPdfFormatError } from "./parsers/UnsupportedPdfFormatError.js";
import { BusTicketPdfParser, PdfParserDetection } from "./parsers/interface/BusTicketPdfParser.js";
import { ETrafficBusTicketPdfParser } from "./parsers/ETrafficBusTicketPdfParser.js";
import { ETrafficBusTicketPdfParserV2 } from "./parsers/ETrafficBusTicketPdfParserV2.js";
import { FiveStarsBaggageBusTicketPdfParser } from "./parsers/FiveStarsBaggageBusTicketPdfParser.js";
import { FiveStarsPassengerBusTicketPdfParser } from "./parsers/FiveStarsPassengerBusTicketPdfParser.js";
import { KhabarovskAvBusTicketPdfParser } from "./parsers/KhabarovskAvBusTicketPdfParser.js";

interface DetectedParser {
    parser: BusTicketPdfParser; detection: PdfParserDetection;
}

export class BusTicketPdfParserService {

    constructor(
        private readonly parsers:
            BusTicketPdfParser[] = [
                new FiveStarsBaggageBusTicketPdfParser(),
                new FiveStarsPassengerBusTicketPdfParser(),
                new KhabarovskAvBusTicketPdfParser(),
                new BusforBusTicketPdfParser(),
                new ETrafficBusTicketPdfParser(),
                new ETrafficBusTicketPdfParserV2()
            ]
    ) {
    }

    /**
     * Разбирает один билет.
     *
     * analysis.normalizedText должен содержать текст
     * только одного билета или одной страницы.
     */
    // parse(analysis: PdfAnalysisResult): ParsedBusTicketDocument {
    //     const detectedParsers: DetectedParser[] = this.parsers
    //         .map((parser) => ({ parser, detection: parser.detect(analysis) }))
    //         .sort((first, second) => second.detection.confidence - first.detection.confidence);

    //     const selectedParser = detectedParsers.find(
    //         ({ detection }) =>
    //             detection.supported
    //     );

    //     if (!selectedParser) {
    //         throw new UnsupportedPdfFormatError(
    //             analysis.filename,

    //             detectedParsers.map(
    //                 ({ parser, detection }) => ({
    //                     parserId:
    //                         parser.id,

    //                     confidence:
    //                         detection.confidence
    //                 })
    //             )
    //         );
    //     }

    //     return selectedParser.parser.parse(analysis, selectedParser.detection);
    // }

    parse(analysis: PdfAnalysisResult): ParsedBusTicketDocument {
        const detectedParsers: DetectedParser[] = this.parsers
            .map((parser) => ({
                parser,
                detection:
                    parser.detect(analysis)
            }))
            .sort(
                (first, second) =>
                    second.detection.confidence -
                    first.detection.confidence
            );

        const supportedParsers = detectedParsers.filter(
            ({ detection }) =>
                detection.supported
        );

        if (supportedParsers.length === 0) {
            const detectionDetails = detectedParsers
                .map(({ parser, detection }) => {
                    return (
                        `${parser.id}: ` +
                        `supported=${detection.supported}, ` +
                        `confidence=${detection.confidence}, ` +
                        `markers=[${detection.matchedMarkers.join(", ")}]`
                    );
                })
                .join(" | ");

            throw new Error(
                `Unsupported PDF ticket format: ` +
                `"${analysis.filename}", ` +
                `page ${analysis.pageNumber ?? 1}. ` +
                `Detection results: ${detectionDetails}`
            );
        }

        const parserErrors: string[] = [];

        for (
            const {
                parser,
                detection
            } of supportedParsers
        ) {
            try {
                return parser.parse(analysis, detection);
            } catch (error: unknown) {
                parserErrors.push(
                    `${parser.id} ` +
                    `(confidence: ${detection.confidence}): ` +
                    this.getErrorMessage(error)
                );
            }
        }

        throw new Error(
            `All detected PDF parsers failed for ` +
            `"${analysis.filename}", ` +
            `page ${analysis.pageNumber ?? 1}. ` +
            parserErrors.join(" | ")
        );
    }

    /**
     * Разбирает каждую страницу PDF как отдельный билет.
     *
     * Пустые страницы пропускаются.
     * Ошибка на непустой странице останавливает обработку
     * всего PDF, чтобы билет не был молча потерян.
     */
    parsePages(analysis: PdfAnalysisResult): ParsedBusTicketDocument[] {
        const pages = this.getPages(analysis);

        const result: ParsedBusTicketDocument[] = [];

        for (const page of pages) {
            if (!page.normalizedText.trim()) {
                continue;
            }

            const pageAnalysis = this.createPageAnalysis(analysis, page);

            try {
                const parsedDocument = this.parse(pageAnalysis);

                result.push(parsedDocument);
            } catch (error: unknown) {
                const errorMessage = this.getErrorMessage(error);
                throw new Error(`Could not parse page ` + `${page.pageNumber} of PDF ` + `"${analysis.filename}": ` + `${errorMessage}`);
            }
        }

        return result;
    }

    /**
     * Fallback позволяет временно поддерживать старые
     * PdfAnalysisResult без массива pages.
     */
    private getPages(analysis: PdfAnalysisResult): PdfPageAnalysisResult[] {
        if (
            Array.isArray(analysis.pages) && analysis.pages.length > 0) {
            return analysis.pages;
        }

        return [
            {
                pageNumber: 1,
                rawText:
                    analysis.rawText,
                normalizedText:
                    analysis.normalizedText,
                lines:
                    analysis.lines
            }
        ];
    }

    /**
     * Создаёт анализ одной страницы.
     *
     * Общие данные файла сохраняются, но текст заменяется
     * текстом конкретной страницы.
     */
    private createPageAnalysis(documentAnalysis: PdfAnalysisResult, page: PdfPageAnalysisResult): PdfAnalysisResult {
        return {
            filename:
                documentAnalysis.filename,
            contentType:
                documentAnalysis.contentType,
            checksum:
                documentAnalysis.checksum,
            size:
                documentAnalysis.size,
            /**
             * Общее количество страниц исходного PDF.
             */
            pageCount:
                documentAnalysis.pageCount,
            /**
             * Номер текущей страницы.
             */
            pageNumber:
                page.pageNumber,
            rawText:
                page.rawText,
            normalizedText:
                page.normalizedText,
            lines:
                page.lines,
            /**
             * Конкретный парсер видит только текущую страницу.
             */
            pages: [page],

            metadata:
                documentAnalysis.metadata
        };
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message || error.name;
        }

        if (typeof error === "string") {
            return error || "Empty string error";
        }

        try {
            return JSON.stringify(error);
        } catch {
            return "Unknown parser error";
        }
    }
}