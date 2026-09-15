import { PdfAnalysisService } from "./PdfAnalysisService.js";
import { AirTicketPdfParserService } from "./AirTicketPdfParserService.js";
import { ProcessedAirTicket } from "../types/ProcessedAirTicket.js";
import { logger } from "../../../../common/logging/Logger.js";
import { MailPdfAttachmentService } from "../../../bus/bus_mail/pdf/MailPdfAttachmentService.js";
import { IncomingMail } from "../../../bus/bus_mail/types/MailboxTypes.js";


export class AirPdfProcessingService {

    constructor(
        private readonly attachmentService: MailPdfAttachmentService = new MailPdfAttachmentService(),
        private readonly pdfAnalysisService: PdfAnalysisService = new PdfAnalysisService(),
        private readonly ticketParserService: AirTicketPdfParserService = new AirTicketPdfParserService()) {
    }


    async processMail(mail: IncomingMail): Promise<ProcessedAirTicket[]> {
        const attachments = await this.attachmentService.extractPdfAttachments(mail.source);

        if (attachments.length === 0) {
            logger.info(`[AIR PDF] Email UID ${mail.uid} ` + `does not contain PDF attachments`);
            return [];
        }

        const result: ProcessedAirTicket[] = [];

        for (const attachment of attachments) {
            logger.info(`[AIR PDF] Starting PDF processing. ` + `UID: ${mail.uid}, ` + `filename: "${attachment.filename}"`);
            const analysis = await this.pdfAnalysisService.analyze(attachment);
            const parsedDocuments = this.ticketParserService.parse(analysis);

            for (const document of parsedDocuments) {
                result.push({
                    document,

                    /*
                     * Пока сохраняем весь исходный
                     * NDC PDF для каждого ticket number.
                     */
                    sourceContent: attachment.content,
                    sourceExtension: "pdf"
                });
            }
        }

        return result;
    }
}