// import { IncomingMail } from "../types/MailboxTypes.js";
// import { MailPdfAttachmentService } from "./MailPdfAttachmentService.js";
// import { PdfAnalysisService } from "./PdfAnalysisService.js";
// import { BusTicketPdfParserService } from "./BusTicketPdfParserService.js";
// import { ParsedBusTicketDocument } from "./types/BusTicketTypes.js";
// export class BusPdfProcessingService {

//     constructor(
//         private readonly attachmentService: MailPdfAttachmentService = new MailPdfAttachmentService(),
//         private readonly pdfAnalysisService: PdfAnalysisService = new PdfAnalysisService(),
//         private readonly ticketParserService: BusTicketPdfParserService = new BusTicketPdfParserService()
//     ) {
//     }

//     async processMail(mail: IncomingMail): Promise<ParsedBusTicketDocument[]> {
//         const attachments = await this.attachmentService.extractPdfAttachments(mail.source);
//         if (attachments.length === 0) {
//             throw new Error(`Email with UID ${mail.uid} ` + `does not contain PDF attachments`);
//         }

//         const result: ParsedBusTicketDocument[] = [];

//         for (const attachment of attachments) {
//             const analysis = await this.pdfAnalysisService.analyze(attachment);
//             const parsedDocuments = this.ticketParserService.parsePages(analysis);
//             if (parsedDocuments.length === 0) {
//                 throw new Error(`PDF "${attachment.filename}" ` + `does not contain parseable ticket pages`);
//             }
//             result.push(...parsedDocuments);
//         }

//         return result;
//     }
// }

import {
    IncomingMail
} from "../types/MailboxTypes.js";

import {
    MailPdfAttachmentService
} from "./MailPdfAttachmentService.js";

import {
    PdfAnalysisService
} from "./PdfAnalysisService.js";

import {
    BusTicketPdfParserService
} from "./BusTicketPdfParserService.js";

import {
    PdfPageSplitService
} from "./PdfPageSplitService.js";
import { ProcessedBusTicket } from "../types/ProcessedBusTicket.js";


export class BusPdfProcessingService {

    constructor(
        private readonly attachmentService:
            MailPdfAttachmentService =
            new MailPdfAttachmentService(),

        private readonly pdfAnalysisService:
            PdfAnalysisService =
            new PdfAnalysisService(),

        private readonly ticketParserService:
            BusTicketPdfParserService =
            new BusTicketPdfParserService(),

        private readonly pageSplitService:
            PdfPageSplitService =
            new PdfPageSplitService()
    ) {
    }

    async processMail(
        mail: IncomingMail
    ): Promise<ProcessedBusTicket[]> {
        const attachments =
            await this.attachmentService
                .extractPdfAttachments(
                    mail.source
                );

        if (attachments.length === 0) {
            throw new Error(
                `Email with UID ${mail.uid} ` +
                `does not contain PDF attachments`
            );
        }

        const result:
            ProcessedBusTicket[] = [];

        for (const attachment of attachments) {
            const analysis =
                await this.pdfAnalysisService
                    .analyze(attachment);

            const parsedDocuments =
                this.ticketParserService
                    .parsePages(analysis);

            if (parsedDocuments.length === 0) {
                throw new Error(
                    `PDF "${attachment.filename}" ` +
                    `does not contain parseable ticket pages`
                );
            }

            /*
             * Получаем номера страниц, соответствующих
             * успешно разобранным билетам.
             */
            const pageNumbers =
                parsedDocuments.map(
                    (document) =>
                        this.getDocumentPageNumber(
                            document.source.pageNumber,
                            analysis.pageCount,
                            attachment.filename
                        )
                );

            /*
             * Загружаем исходный PDF один раз и создаём
             * отдельные одностраничные PDF.
             */
            const separatedPages =
                analysis.pageCount === 1
                    ? new Map<number, Uint8Array>([
                        [
                            1,
                            attachment.content
                        ]
                    ])
                    : await this.pageSplitService
                        .extractPages(
                            attachment.content,
                            pageNumbers
                        );

            for (
                let index = 0;
                index < parsedDocuments.length;
                index++
            ) {
                const document =
                    parsedDocuments[index];

                const pageNumber =
                    pageNumbers[index];

                const pdfContent =
                    separatedPages.get(
                        pageNumber
                    );

                if (!pdfContent) {
                    throw new Error(
                        `Separated PDF page ` +
                        `${pageNumber} was not created for ` +
                        `"${attachment.filename}"`
                    );
                }

                result.push({
                    document,
                    pdfContent
                });
            }
        }

        return result;
    }

    private getDocumentPageNumber(
        pageNumber: number | undefined,
        pageCount: number,
        filename: string
    ): number {
        if (pageNumber !== undefined) {
            return pageNumber;
        }

        /*
         * Для одностраничного документа допустим fallback.
         */
        if (pageCount === 1) {
            return 1;
        }

        throw new Error(
            `Parser did not provide pageNumber for ` +
            `multi-page PDF "${filename}"`
        );
    }
}