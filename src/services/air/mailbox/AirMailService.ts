import { ImapFlow } from "imapflow";
import { join } from "node:path";
import { AirPdfProcessingService } from "./pdf/AirPdfProcessingService.js";
import { ParsedAirTicketDocument } from "./types/AirTicketTypes.js";
import { ProcessedAirTicket } from "./types/ProcessedAirTicket.js";
import { AirTransportService } from "./transport/AirTransportService.js";
import { FileService } from "../../../common/file-service/FileService.js";
import { fileConverterXml, fileService } from "../../../instances/services.js";
import { logger } from "../../../common/logging/Logger.js";
import config from "../../../config/air/air_mailbox_conf.json"    with { type: "json" };
import { IncomingMail, MailAddress, MailboxRunResult, MailboxServiceOptions } from "../../bus/bus_mail/types/MailboxTypes.js";
import { AirService } from "../interfaces/AirService.js";
import { AirProcessingService } from "./body/AirProcessingService.js";


export class AirMailService implements AirService {

    /**
     * Не позволяет запускать новый IMAP polling,
     * пока предыдущий ещё работает.
     */
    private isRunning = false;
    private readonly fileService: FileService;
    private readonly currentDirectory: string;


    constructor(
        private readonly options: MailboxServiceOptions,
        private readonly airProcessingService: AirProcessingService = new AirProcessingService(),
        private readonly transportService: AirTransportService = new AirTransportService()
    ) {
        this.fileService = fileService;
        this.currentDirectory = config.fileOutput.mainPath;
    }


    getServiceName(): string {
        return this.options.serviceName;
    }


    /**
     * Один полный polling почтового ящика.
     */
    async run(): Promise<void> {

        if (this.isRunning) {
            logger.warn(`[${this.getServiceName()}] ` + `Previous mailbox processing is still running. ` + `Current run skipped`);
            return;
        }

        this.isRunning = true;

        const client = this.createClient();

        try {
            logger.trace(`[${this.getServiceName()}] ` + `Start mailbox processing`);
            logger.trace(`[${this.getServiceName()}] ` + `Connecting to IMAP server ` + `${this.options.host}:` + `${this.options.port}`);
            await client.connect();
            logger.trace(`[${this.getServiceName()}] ` + `Connected to IMAP server`);
            const result = await this.processMailbox(client);

            if (result.found > 0) {
                logger.info(
                    `[${this.getServiceName()}] ` +
                    `Mailbox processing completed. ` +
                    `Found: ${result.found}, ` +
                    `processed: ${result.processed}, ` +
                    `deleted: ${result.deleted}, ` +
                    `failed: ${result.failed}`
                );
            }

            logger.trace(
                `[${this.getServiceName()}] ` +
                `Mailbox processing completed. ` +
                `Found: ${result.found}, ` +
                `processed: ${result.processed}, ` +
                `deleted: ${result.deleted}, ` +
                `failed: ${result.failed}`
            );



        } catch (error: unknown) {
            logger.error(`[${this.getServiceName()}] ` + `Mailbox processing failed. ` + `Error: ${this.getErrorMessage(error)}`);
        } finally {
            await this.disconnect(client);
            this.isRunning = false;
        }
    }


    private createClient(): ImapFlow {

        const client = new ImapFlow({
            host: this.options.host,
            port: this.options.port,
            secure: this.options.secure,
            servername: this.options.servername,
            auth: {
                user: this.options.username,
                pass: this.options.password,
                loginMethod: "AUTH=PLAIN"
            },
            tls: {
                minVersion: "TLSv1"
            },
            connectionTimeout: this.options.connectionTimeout ?? 30_000,
            greetingTimeout: this.options.greetingTimeout ?? 30_000,
            socketTimeout: this.options.socketTimeout ?? 300_000,
            logger: false
        });


        client.on("error", (error: Error) => {
            logger.error(`[${this.getServiceName()}] ` + `IMAP client error: ` + `${error.message}`);
        }
        );

        return client;
    }


    private async processMailbox(client: ImapFlow): Promise<MailboxRunResult> {
        const result: MailboxRunResult = {
            found: 0,
            processed: 0,
            deleted: 0,
            failed: 0
        };


        /*
         * readOnly=false нужен для
         * последующего удаления писем.
         */
        const lock = await client.getMailboxLock(this.options.mailbox,
            {
                readOnly: false,
                description: `${this.getServiceName()}.run`
            }
        );


        try {
            logger.trace(`[${this.getServiceName()}] ` + `Mailbox "${this.options.mailbox}" opened`);
            const searchResult = await client.search(
                {
                    all: true
                },
                {
                    uid: true
                }
            );


            if (!Array.isArray(searchResult)) {
                throw new Error(`Unexpected IMAP search result ` + `for mailbox ` + `"${this.options.mailbox}"`);
            }


            /*
             * Старые письма обрабатываются первыми.
             */
            const messageUids = [...searchResult].sort((firstUid, secondUid) => firstUid - secondUid);
            result.found = messageUids.length;

            if (messageUids.length > 0) {
                logger.info(`[${this.getServiceName()}] ` + `Found ${messageUids.length} email(s)`);
            }
            logger.trace(`[${this.getServiceName()}] ` + `Found ${messageUids.length} email(s)`);


            for (const uid of messageUids) {
                await this.processMessageByUid(client, uid, result);
            }
            return result;

        } finally {
            lock.release();
            logger.trace(`[${this.getServiceName()}] ` + `Mailbox lock released`);
        }
    }


    private async processMessageByUid(client: ImapFlow, uid: number, result: MailboxRunResult): Promise<void> {
        try {
            const fetchedMessage = await client.fetchOne(
                uid,
                {
                    uid: true,
                    envelope: true,
                    internalDate: true,
                    source: true
                },
                {
                    uid: true
                }
            );


            if (!fetchedMessage) {
                throw new Error(`Email with UID ${uid} ` + `was not found`);
            }


            const source = fetchedMessage.source;

            if (!source) {

                throw new Error(
                    `Email with UID ${uid} ` +
                    `does not contain source`
                );
            }


            const mail: IncomingMail = {
                uid: fetchedMessage.uid,
                messageId: fetchedMessage.envelope?.messageId ?? undefined,
                subject: fetchedMessage.envelope?.subject ?? undefined,
                date: this.normalizeDate(fetchedMessage.envelope?.date ?? fetchedMessage.internalDate),
                from: this.mapAddresses(fetchedMessage.envelope?.from),
                to: this.mapAddresses(fetchedMessage.envelope?.to),
                cc: this.mapAddresses(fetchedMessage.envelope?.cc),
                source
            };


            logger.info(
                `[${this.getServiceName()}] ` +
                `Email received. ` +
                `UID: ${mail.uid}, ` +
                `Message-ID: ` +
                `${mail.messageId ?? "unknown"}, ` +
                `subject: "${mail.subject ?? ""}"`
            );

            await this.processMessage(mail);
            result.processed++;

            if (this.options.deleteProcessedMessages === true) {
                const deleted = await client.messageDelete(uid, { uid: true });

                if (!deleted) {
                    throw new Error(`IMAP server did not confirm ` + `deletion of email ` + `with UID ${uid}`);
                }

                result.deleted++;
                logger.info(`[${this.getServiceName()}] ` + `Email successfully processed ` + `and deleted. UID: ${uid}`);
                return;
            }


            logger.info(
                `[${this.getServiceName()}] ` +
                `Email successfully processed, ` +
                `but retained because ` +
                `deleteProcessedMessages=false. ` +
                `UID: ${uid}`
            );

        } catch (error: unknown) {
            result.failed++;
            logger.error(`[${this.getServiceName()}] ` + `Email processing failed. ` + `UID: ${uid}. ` + `Error: ${this.getErrorMessage(error)}`);
        }
    }


    private async processMessage(mail: IncomingMail): Promise<void> {
        logger.info(
            `[${this.getServiceName()}] ` +
            `Starting AIR PDF processing. ` +
            `UID: ${mail.uid}`
        );

        const processedTickets = await this.airProcessingService.processMail(mail);


        /*
         * Для AIR я специально делаю это ошибкой.
         *
         * Иначе письмо без PDF будет считаться
         * успешно обработанным и может удалиться.
         */
        if (processedTickets.length === 0) {
            throw new Error(
                `Email with UID ${mail.uid} ` +
                `does not contain parseable ` +
                `AIR ticket content`
            );
        }


        logger.info(
            `[${this.getServiceName()}] ` +
            `AIR content processed. ` +
            `UID: ${mail.uid}, ` +
            `documents: ${processedTickets.length}`
        );


        /*
         * Все ticket numbers данного NDC order.
         */
        const ticketNumbers =
            [
                ...new Set(processedTickets.map(({ document }) => document.identifiers.ticketNumber)
                    .filter((value): value is string => Boolean(value)))
            ];

        for (const processedTicket of processedTickets) {
            await this.processParsedDocument(mail, processedTicket, ticketNumbers);
        }
    }


    private async processParsedDocument(mail: IncomingMail, processedTicket: ProcessedAirTicket, ticketNumbers: string[]): Promise<void> {
        const { document, sourceContent, sourceExtension } = processedTicket;


        logger.info(
            `[${this.getServiceName()}] ` +
            `Parsed AIR ticket. ` +
            `UID: ${mail.uid}, ` +
            `filename: "${document.source.filename}", ` +
            `parser: ${document.parser.id}, ` +
            `confidence: ${document.parser.confidence}, ` +
            `provider: ${document.provider.code}, ` +
            `orderId: ` +
            `${document.identifiers.orderId ?? "unknown"}, ` +
            `ticketNumber: ` +
            `${document.identifiers.ticketNumber ?? "unknown"}, ` +
            `passenger: ` +
            `"${document.passenger.fullName ?? "unknown"}", ` +
            `segments: ${document.segments.length}, ` +
            `total: ` +
            `${document.pricing.total ?? "unknown"} ` +
            `${document.pricing.currency ?? ""}`
        );

        const outputName = this.createOutputName(mail, document);
        const xmlPath = join(this.currentDirectory, `${outputName}.xml`);
        const sourcePath = join(this.currentDirectory, `${outputName}.${sourceExtension}`);
        const subjectData = this.parseMailSubject(mail.subject);
        const sourceFileName = `${outputName}.${sourceExtension}`;
        const documentForXml: ParsedAirTicketDocument = {

            ...document,
            comment: subjectData.comment,
            employee: subjectData.employee,
            ticketNumbers: { ticketNumber: ticketNumbers },
            sourceFileName,
            pdfFileName: sourceExtension === "pdf" ? sourceFileName : undefined
        };


        const xmlContent = fileConverterXml.jsonToXml(documentForXml);
        await this.fileService.writeFile(xmlPath, xmlContent);
        await this.fileService.writeSourceFile(sourcePath, sourceContent);

        /*
         * Сначала отправляем XML,
         * затем PDF.
         *
         * Если любой sendFile падает,
         * processMessage падает,
         * письмо не удаляется.
         */
        await this.transportService.sendFile(xmlPath);
        await this.transportService.sendFile(sourcePath);


        logger.info(
            `[${this.getServiceName()}] ` +
            `AIR ticket files successfully sent. ` +
            `UID: ${mail.uid}, ` +
            `ticket: "${outputName}"`
        );
    }


    private createOutputName(mail: IncomingMail, document: ParsedAirTicketDocument): string {

        const identifier =
            document.identifiers.ticketNumber ??
            document.identifiers.orderId ?? (`mail_${mail.uid}`);

        return this.sanitizeFilename(identifier);
    }

    private sanitizeFilename(value: string): string {

        const sanitized = value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").replace(/[.\s]+$/g, "").trim();

        if (!sanitized) {
            throw new Error(`Could not create AIR output filename`);
        }

        return sanitized.slice(0, 150);
    }

    private parseMailSubject(subject: string | undefined): { comment: string; employee: string; } {

        if (!subject) {
            return {
                comment: "",
                employee: ""
            };
        }

        const separatorIndex = subject.indexOf("/");

        if (separatorIndex === -1) {

            return {
                comment: this.normalizeMailSubject(subject),
                employee: ""
            };
        }


        return {
            comment: this.normalizeMailSubject(subject.slice(0, separatorIndex)),
            employee: this.normalizeMailSubject(subject.slice(separatorIndex + 1))
        };
    }


    private normalizeMailSubject(subject: string | undefined): string {

        if (!subject) {
            return "";
        }
        return subject.replace(/\s+/g, " ").trim();
    }


    private mapAddresses(addresses: | Array<{ name?: string; address?: string; }> | undefined): MailAddress[] {

        if (!addresses) {
            return [];
        }

        return addresses.map(
            (address) => ({
                name: address.name,
                address: address.address
            })
        );
    }


    private normalizeDate(value: | Date | string | undefined): Date | undefined {

        if (!value) {
            return undefined;
        }

        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? undefined : value;
        }


        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }


    private async disconnect(client: ImapFlow): Promise<void> {
        try {
            if (client.usable) {
                await client.logout();
                logger.trace(`[${this.getServiceName()}] ` + `Disconnected from IMAP server`);
                return;
            }
            client.close();

        } catch (error: unknown) {
            logger.warn(
                `[${this.getServiceName()}] ` +
                `Could not gracefully close ` +
                `IMAP connection: ` +
                `${this.getErrorMessage(error)}`
            );
            client.close();
        }
    }


    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return (error.message || error.name);
        }


        if (typeof error === "string") {
            return error;
        }


        try {
            return JSON.stringify(error);
        } catch {
            return "Unknown AIR mailbox error";
        }
    }
}