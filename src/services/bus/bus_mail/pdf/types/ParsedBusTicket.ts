export interface ParsedBusTicket {
    ticketNumber?: string;
    passengerName?: string;
    departureCity?: string;
    arrivalCity?: string;
    departureDate?: Date;
    departureTime?: string;
    carrier?: string;
    price?: number;
    currency?: string;
}