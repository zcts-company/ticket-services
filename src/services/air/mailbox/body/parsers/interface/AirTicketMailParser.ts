import { ParsedAirTicketDocument } from "../../../types/AirTicketTypes.js";
import { ParsedAirMail } from "../../../types/ParsedAirMail.js";

export interface AirMailParserDetection {

    supported: boolean;
    confidence: number;
    matchedMarkers: string[];
}


export interface AirTicketMailParser {

    readonly id: string;
    readonly version: string;

    detect(mail: ParsedAirMail): AirMailParserDetection;
    parse(mail: ParsedAirMail, detection: AirMailParserDetection): ParsedAirTicketDocument[];
}