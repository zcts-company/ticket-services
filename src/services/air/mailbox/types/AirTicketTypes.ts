import { PdfDocumentMetadata } from "../../../bus/bus_mail/pdf/types/PdfTypes.js";

export type AirPassengerType =
    | "ADULT"
    | "CHILD"
    | "INFANT"
    | "UNKNOWN";

export type AirTicketSourceType =
    | "PDF"
    | "EMAIL_HTML";

export type AirTicketSourceExtension =
    | "pdf"
    | "eml";

export type AirPaymentMethod =
    | "CASH"
    | "CARD"
    | "BANK_TRANSFER"
    | "UNKNOWN";

export type AirJourneyType =
    | "DEPARTURE"
    | "RETURN"
    | "UNKNOWN";

export interface AirTicketParserInfo {
    id: string;
    version: string;
    confidence: number;
}

export interface AirTicketSource {

    type: AirTicketSourceType;

    filename: string;

    checksum?: string;

    size: number;

    pageCount: number;

    /**
     * В отличие от BUS билет может занимать
     * несколько страниц.
     */
    pageNumbers?: number[];

    metadata: PdfDocumentMetadata;

    messageId?: string;

    subject?: string;
}

export interface AirTicketProvider {
    /**
     * Например:
     *
     * TK_NDC
     * EK_NDC
     */
    code: string;

    name: string;

    /**
     * IATA airline code.
     *
     * TK
     * EK
     */
    airlineCode?: string;

    issuingOffice?: string;
}

export interface AirTicketIdentifiers {

    /**
     * NDC Order ID.
     *
     * Например:
     *
     * VH8RS5
     */
    orderId?: string;

    /**
     * Номер авиабилета.
     *
     * Например:
     *
     * 2352242811471
     */
    ticketNumber?: string;

    /**
     * PNR / booking reference,
     * если присутствует отдельно от Order ID.
     */
    bookingReference?: string;
}

export interface AirPassengerContact {
    phone?: string;
    email?: string;
}

export interface AirPassenger {

    /**
     * Полное имя как оно было указано
     * поставщиком.
     */
    fullName?: string;

    title?: string;

    firstName?: string;

    lastName?: string;

    type: AirPassengerType;

    /**
     * YYYY-MM-DD
     */
    birthDate?: string;

    contact?: AirPassengerContact;
}

export interface AirAirportPoint {
    city?: string;

    /**
     * IATA airport code.
     *
     * VKO
     * IST
     * LYS
     */
    airportCode?: string;

    /**
     * YYYY-MM-DD
     */
    date?: string;

    /**
     * HH:mm
     */
    time?: string;
}

export interface AirCarrier {
    code?: string;
    name?: string;
}

export interface AirSegment {

    /**
     * Номер сегмента внутри билета.
     */
    sequence: number;

    /**
     * Например:
     *
     * TK0412
     */
    flightNumber?: string;

    aircraft?: string;

    departure: AirAirportPoint;

    arrival: AirAirportPoint;

    marketingCarrier?: AirCarrier;

    operatingCarrier?: AirCarrier;

    /**
     * Например ECONOMY.
     */
    cabin?: string;

    /**
     * Booking class:
     *
     * Q
     * Y
     * J
     */
    bookingClass?: string;

    /**
     * Исходный статус из PDF.
     */
    status?: string;
}

export interface AirJourney {

    type: AirJourneyType;

    departure?: {
        city?: string;
        airportCode?: string;
    };

    arrival?: {
        city?: string;
        airportCode?: string;
    };

    /**
     * sequence сегментов, входящих
     * в данный маршрут.
     */
    segmentSequences: number[];
}

export interface AirBaggageAllowance {
    journeyType?: AirJourneyType;

    segmentSequence?: number;

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

export interface AirTicketPriceComponent {
    code: string;
    amount: number;
    currency: string;
}

export interface AirTicketPricing {

    currency?: string;

    /**
     * Цена конкретного авиабилета пассажира.
     */
    total?: number;

    /**
     * Общий Total Fare заказа.
     *
     * Может отличаться от total, если
     * в заказе несколько пассажиров.
     */
    orderTotal?: number;

    components: AirTicketPriceComponent[];
}

export interface AirTicketPurchase {

    /**
     * YYYY-MM-DD
     */
    createdDate?: string;

    /**
     * YYYY-MM-DD
     */
    ticketDate?: string;

    /**
     * YYYY-MM-DD
     */
    purgeDate?: string;

    paymentMethod: AirPaymentMethod;

    paymentMethodRaw?: string;
}

export interface AirTicketParseWarning {
    code: string;
    message: string;
}

export interface ParsedAirTicketDocument {

    schemaVersion: "1.0";

    documentType: "AIR_TICKET";

    parser: AirTicketParserInfo;

    source: AirTicketSource;

    provider: AirTicketProvider;

    identifiers: AirTicketIdentifiers;

    passenger: AirPassenger;

    segments: AirSegment[];

    journeys: AirJourney[];

    baggage: AirBaggageAllowance[];

    purchase: AirTicketPurchase;

    pricing: AirTicketPricing;

    comment?: string;

    employee?: string;

    ticketNumbers?: {
        ticketNumber: string[];
    };

    pdfFileName?: string;

    sourceFileName?: string;

    warnings: AirTicketParseWarning[];
}