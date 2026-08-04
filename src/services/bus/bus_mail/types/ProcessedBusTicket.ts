import { ParsedBusTicketDocument } from "../pdf/types/BusTicketTypes.js";

export interface ProcessedBusTicket {
    /**
     * Результат работы билетного парсера.
     */
    document: ParsedBusTicketDocument;

    /**
     * Отдельный PDF, содержащий только этот билет.
     */
    pdfContent: Uint8Array;
}