import { IncomingMail } from "../../../bus/bus_mail/types/MailboxTypes.js";
import { AirPdfProcessingService } from "../pdf/AirPdfProcessingService.js";
import { ProcessedAirTicket } from "../types/ProcessedAirTicket.js";
import { AirMailBodyProcessingService } from "./AirMailBodyProcessingService.js";

export class AirProcessingService {

    constructor(
        private readonly bodyProcessingService: AirMailBodyProcessingService = new AirMailBodyProcessingService(),
        private readonly pdfProcessingService: AirPdfProcessingService = new AirPdfProcessingService()
    ) {
    }


    async processMail(mail: IncomingMail): Promise<ProcessedAirTicket[]> {

        const bodyTickets = await this.bodyProcessingService.processMail(mail);
        const pdfTickets = await this.pdfProcessingService.processMail(mail);
        return this.removeDuplicates([...bodyTickets, ...pdfTickets]);
    }


    private removeDuplicates(tickets: ProcessedAirTicket[]): ProcessedAirTicket[] {
        const result: ProcessedAirTicket[] = [];
        const keys = new Set<string>();
        for (const ticket of tickets) {
            const document = ticket.document;
            const key = [
                document.provider.code,
                document.identifiers.ticketNumber ??
                document.identifiers.orderId ?? "",
                document.passenger.fullName ?? ""
            ].join("|");

            if (keys.has(key)) {

                continue;
            }

            keys.add(key);
            result.push(ticket);
        }

        return result;
    }
}