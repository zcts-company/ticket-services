import { ParsedBusTicketDocument } from "../../types/BusTicketTypes.js";
import { PdfAnalysisResult } from "../../types/PdfTypes.js";

export interface PdfParserDetection {
    supported: boolean;

    /**
     * Значение от 0 до 100.
     */
    confidence: number;

    matchedMarkers: string[];
}

export interface BusTicketPdfParser {
    readonly id: string;
    readonly version: string;

    detect(
        analysis: PdfAnalysisResult
    ): PdfParserDetection;

    parse(
        analysis: PdfAnalysisResult,
        detection: PdfParserDetection
    ): ParsedBusTicketDocument;
}