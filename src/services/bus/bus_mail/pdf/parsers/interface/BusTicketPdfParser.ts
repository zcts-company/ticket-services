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

    detect(analysis: PdfAnalysisResult): PdfParserDetection;
    parse(analysis: PdfAnalysisResult, detection: PdfParserDetection): ParsedBusTicketDocument;
    /**
     * Позволяет конкретному парсеру выбрать страницы,
     * которые должны рассматриваться как билеты.
     *
     * undefined — специального правила нет,
     * обрабатываем все страницы как раньше.
     */
    selectPageNumbers?(analysis: PdfAnalysisResult): number[] | undefined;
}