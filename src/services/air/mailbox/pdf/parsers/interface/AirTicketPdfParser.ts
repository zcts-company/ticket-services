import { PdfAnalysisResult } from "../../../../../bus/bus_mail/pdf/types/PdfTypes.js";
import { ParsedAirTicketDocument } from "../../../types/AirTicketTypes.js";

export interface PdfParserDetection {
    /**
     * Парсер считает документ своим форматом.
     */
    supported: boolean;

    /**
     * Уверенность определения формата от 0 до 100.
     */
    confidence: number;

    /**
     * Маркеры, по которым был определён формат.
     *
     * Используются в первую очередь для диагностики.
     */
    matchedMarkers: string[];
}

export interface AirTicketPdfParser {

    /**
     * Уникальный идентификатор конкретной версии парсера.
     *
     * Например:
     *
     * tk-ndc-v1
     * ek-ndc-v1
     */
    readonly id: string;

    /**
     * Версия реализации парсера.
     */
    readonly version: string;

    /**
     * Определяет, способен ли этот парсер
     * обработать переданный PDF.
     */
    detect(analysis: PdfAnalysisResult): PdfParserDetection;

    /**
     * Разбирает весь PDF.
     *
     * В отличие от автобусных билетов:
     *
     * один PDF != одна страница != один билет.
     *
     * Один NDC PDF может содержать несколько пассажиров
     * и соответственно несколько ticket numbers.
     *
     * Поэтому один PDF возвращает массив документов.
     */
    parse(analysis: PdfAnalysisResult, detection: PdfParserDetection): ParsedAirTicketDocument[];
}