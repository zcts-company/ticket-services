import { simpleParser } from "mailparser";
import { IncomingMail } from "../../../bus/bus_mail/types/MailboxTypes.js";
import { ProcessedAirTicket } from "../types/ProcessedAirTicket.js";
import { AirTicketMailParserService } from "./AirTicketMailParserService.js";
import { ParsedAirMail } from "../types/ParsedAirMail.js";
import { logger } from "../../../../common/logging/Logger.js";


export class AirMailBodyProcessingService {

    constructor(
        private readonly parserService:
            AirTicketMailParserService =
            new AirTicketMailParserService()
    ) {
    }


    async processMail(
        mail: IncomingMail
    ): Promise<ProcessedAirTicket[]> {

        const parsed =
            await simpleParser(
                mail.source
            );


        const text =
            parsed.text?.trim() ||
            undefined;


        const html =
            typeof parsed.html === "string"
                ? parsed.html
                : undefined;


        if (
            !text &&
            !html
        ) {

            return [];
        }


        const parsedMail:
            ParsedAirMail = {

            uid:
                mail.uid,

            messageId:
                mail.messageId,

            subject:
                mail.subject,

            date:
                mail.date,

            from:
                mail.from,

            to:
                mail.to,

            cc:
                mail.cc,

            text,

            html
        };


        const documents =
            this.parserService.parse(
                parsedMail
            );


        if (
            documents.length === 0
        ) {

            return [];
        }


        logger.info(
            `[AIR MAIL BODY] ` +
            `UID ${mail.uid}: parsed ` +
            `${documents.length} AIR ticket(s)`
        );


        return documents.map(
            document => ({

                document,

                /*
                 * Сохраняем исходное RFC822 письмо.
                 */
                sourceContent:
                    mail.source,

                sourceExtension:
                    "eml"
            })
        );
    }
}