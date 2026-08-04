import { PdfDocumentMetadata } from "./PdfTypes.js";

export type BusTicketGender =
    | "MALE"
    | "FEMALE"
    | "UNKNOWN";

export type PassengerDocumentType =
    | "PASSPORT"
    | "BIRTH_CERTIFICATE"
    | "OTHER";

export type BusTicketPaymentMethod =
    | "CASH"
    | "CARD"
    | "BANK_TRANSFER"
    | "ELECTRONIC_TICKET"
    | "UNKNOWN";

export interface LocalDateTimeParts {
    /**
     * YYYY-MM-DD.
     */
    date?: string;

    /**
     * HH:mm.
     */
    time?: string;

    /**
     * Часовой пояс обычно отсутствует в PDF.
     */
    timeZone?: string;
}

export interface BusTicketSource {
    filename: string;
    checksum?: string;
    size: number;
    pageCount: number;
    pageNumber?: number;
    metadata: PdfDocumentMetadata;
}

export interface BusTicketParserInfo {
    id: string;
    version: string;
    confidence: number;
}

export interface BusTicketProvider {
    name: string;
    agent?: string;
    website?: string;
}

export interface BusTicketIdentifiers {
    /**
     * Идентификатор квитанции системы продажи.
     */
    receiptId?: string;

    carrierTicketNumber?: string;
    itinerarySeries?: string;
    itineraryNumber?: string;
    controlNumber?: string;
}

export interface BusTicketPassengerDocument {
    type: PassengerDocumentType;
    number?: string;
    rawType?: string;
}

export interface BusTicketPassenger {
    fullName?: string;
    document?: BusTicketPassengerDocument;
    gender: BusTicketGender;
    birthDate?: string;
    nationality?: string;
}

export interface BusTicketLocation {
    city?: string;
    station?: string;
    address?: string;
    date?: string;
    time?: string;
}

export interface BusTicketCarrier {
    id?: string;
    name?: string;
}

export interface BusTicketTrip {
    routeName?: string;
    tripNumber?: string;
    seat?: string;
    platform?: string;

    departure: BusTicketLocation;
    arrival: BusTicketLocation;

    carrier: BusTicketCarrier;
}

export interface BusTicketPurchase {
    agentIssuedAt?: LocalDateTimeParts;
    carrierSaleAt?: LocalDateTimeParts;
    paymentMethod: BusTicketPaymentMethod;

    /**
     * Исходное значение из PDF.
     */
    paymentMethodRaw?: string;
}

export interface BusTicketPriceComponent {
    code: string;
    amount: number;
    currency: string;
}

export interface BusTicketPricing {
    currency?: string;

    baseFare?: number;

    /**
     * Основной итог, который используем дальше.
     */
    total?: number;

    totalSource?:
    | "ITINERARY_RECEIPT"
    | "CARRIER_TICKET"
    | "UNKNOWN";

    /**
     * Итог, указанный отдельно в маршрутной квитанции.
     */
    itineraryReceiptTotal?: number;

    components: BusTicketPriceComponent[];
}

export interface BusTicketParseWarning {
    code: string;
    message: string;
}

export interface ParsedBusTicketDocument {
    schemaVersion: "1.0";
    documentType: "BUS_TICKET";

    parser: BusTicketParserInfo;
    source: BusTicketSource;

    provider: BusTicketProvider;
    identifiers: BusTicketIdentifiers;

    ticket: {
        type?: string;
        vehicleType?: string;
    };

    passenger: BusTicketPassenger;
    trip: BusTicketTrip;
    purchase: BusTicketPurchase;
    pricing: BusTicketPricing;
    comment?: string;
    warnings: BusTicketParseWarning[];
}





