import { AirTicketSourceExtension, ParsedAirTicketDocument } from "./AirTicketTypes.js";

export interface ProcessedAirTicket {

    document: ParsedAirTicketDocument;
    sourceContent: Uint8Array;
    sourceExtension: AirTicketSourceExtension;
}