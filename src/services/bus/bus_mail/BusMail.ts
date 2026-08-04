import { ImapFlow } from "imapflow";
import { BusPdfProcessingService } from "./pdf/BusPdfProcessingService.js";
import { IncomingMail, MailAddress, MailboxRunResult, MailboxServiceOptions } from "./types/MailboxTypes.js";
import { BusTicketService } from "../interfaces/BusTicketService.js";
import { logger } from "../../../common/logging/Logger.js";
import { ParsedBusTicketDocument } from "./pdf/types/BusTicketTypes.js";
import { FileService } from "../../../common/file-service/FileService.js";
import { fileConverterXml, fileService } from "../../../instances/services.js";
import config from "../../../config/bus/bus_config.json" with {type: 'json'}
import { ProcessedBusTicket } from "./types/ProcessedBusTicket.js";
import { join } from "node:path";
import { BusTransportService } from "./transport/BusTransportService.js";
export class BusMailService implements BusTicketService {

    /**
     * Защищает сервис от параллельного запуска.
     */
    private isRunning = false;

    private fileService: FileService;
    private archiveDirectory: string;
    private currentDirectory: string;
    private currentArchiveDirectory: string;
    private directory1C: string;

    constructor(
        private readonly options: MailboxServiceOptions,
        private readonly pdfProcessingService: BusPdfProcessingService = new BusPdfProcessingService(),
        private readonly transportService: BusTransportService = new BusTransportService()
    ) {
        this.fileService = fileService;
        this.currentDirectory = config.fileOutput.mainPath
        this.archiveDirectory = config.fileArhive.mainPath
        this.directory1C = config.directory1C.mainPath
        this.currentArchiveDirectory = `${config.fileArhive.mainPath}${new Date().toLocaleDateString().replace(new RegExp('[./]', 'g'), "-")}/`;
    }

    getServiceName(): string {
        return this.options.serviceName;
    }

    /**
     * Главный метод почтового сервиса.
     *
     * 1. Подключается к IMAP.
     * 2. Открывает почтовую папку.
     * 3. Получает UID всех писем.
     * 4. Последовательно обрабатывает каждое письмо.
     * 5. Удаляет письмо только после успешной обработки.
     * 6. Закрывает соединение.
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            logger.warn(`[${this.getServiceName()}] Previous mailbox processing is still running. ` + `Current run skipped`);
            return;
        }

        this.isRunning = true;
        const client = this.createClient();

        try {
            logger.trace(`[${this.getServiceName()}] Start mailbox processing`);
            logger.trace(`[${this.getServiceName()}] Connecting to IMAP server ` + `${this.options.host}:${this.options.port}`);
            await client.connect();
            logger.trace(`[${this.getServiceName()}] Connected to IMAP server`);
            const result = await this.processMailbox(client);
            logger.trace(`[${this.getServiceName()}] Mailbox processing completed. ` + `Found: ${result.found}, ` + `processed: ${result.processed}, ` + `deleted: ${result.deleted}, ` + `failed: ${result.failed}`);
        } catch (error: unknown) {
            logger.error(`[${this.getServiceName()}] Mailbox processing skipped. ` + `Error: ${this.getErrorMessage(error)}`)
        }
        finally {
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
                loginMethod: 'AUTH=PLAIN'
            },
            tls: {
                minVersion: 'TLSv1'
            },
            connectionTimeout:
                this.options.connectionTimeout ?? 30_000,
            greetingTimeout:
                this.options.greetingTimeout ?? 30_000,
            socketTimeout:
                this.options.socketTimeout ?? 300_000,
            logger: false
        });

        client.on("error", (error: Error) => {
            logger.error(`[${this.getServiceName()}] IMAP client error: ${error.message}`);
        });

        return client;
    }

    private async processMailbox(client: ImapFlow): Promise<MailboxRunResult> {
        const result: MailboxRunResult = {
            found: 0,
            processed: 0,
            deleted: 0,
            failed: 0
        };

        /**
         * readOnly должен быть false, иначе удалять письма нельзя.
         */
        const lock = await client.getMailboxLock(
            this.options.mailbox,
            {
                readOnly: false,
                description: `${this.getServiceName()}.run`
            }
        );

        try {
            logger.trace(`[${this.getServiceName()}] Mailbox ` + `"${this.options.mailbox}" opened`);
            const searchResult = await client.search({ all: true }, { uid: true });

            if (!Array.isArray(searchResult)) {
                throw new Error(`Unexpected IMAP search result for mailbox ` + `"${this.options.mailbox}"`);
            }

            /**
             * Сортируем UID по возрастанию:
             * сначала обрабатываются старые письма.
             */
            const messageUids = [...searchResult].sort((firstUid, secondUid) => firstUid - secondUid);
            result.found = messageUids.length;
            logger.trace(`[${this.getServiceName()}] Found ` + `${messageUids.length} email(s)`);

            for (const uid of messageUids) {
                await this.processMessageByUid(client, uid, result);
            }

            return result;
        } finally {
            lock.release();
            logger.trace(`[${this.getServiceName()}] Mailbox lock released`);
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
                throw new Error(`Email with UID ${uid} was not found`);
            }

            const source = fetchedMessage.source;

            if (!source) {
                throw new Error(`Email with UID ${uid} does not contain source`);
            }

            const mail: IncomingMail = {
                uid: fetchedMessage.uid,

                messageId:
                    fetchedMessage.envelope?.messageId ?? undefined,

                subject:
                    fetchedMessage.envelope?.subject ?? undefined,

                date: this.normalizeDate(
                    fetchedMessage.envelope?.date ??
                    fetchedMessage.internalDate
                ),

                from: this.mapAddresses(
                    fetchedMessage.envelope?.from
                ),

                to: this.mapAddresses(
                    fetchedMessage.envelope?.to
                ),

                cc: this.mapAddresses(
                    fetchedMessage.envelope?.cc
                ),

                source
            };

            logger.info(`[${this.getServiceName()}] Email received. ` + `UID: ${mail.uid}, ` + `Message-ID: ${mail.messageId ?? "unknown"}, ` + `subject: "${mail.subject ?? ""}"`);

            /**
             * анализ и бизнес-обработка.
             *
             * Если этот метод выбросит исключение,
             * письмо не будет удалено.
             */
            await this.processMessage(mail);
            result.processed++;

            /**
             * Удаление выполняется только после успешного
             * завершения processMessage().
             */

            if (this.options.deleteProcessedMessages === true) {
                const deleted = await client.messageDelete(uid, { uid: true });

                if (!deleted) {
                    throw new Error(`IMAP server did not confirm deletion ` + `of email with UID ${uid}`);
                }

                result.deleted++;
                logger.info(`[${this.getServiceName()}] Email successfully ` + `processed and deleted. UID: ${uid}`);
                return;
            }

            logger.info(`[${this.getServiceName()}] Email successfully processed, ` + `but retained in mailbox because ` + `deleteProcessedMessages=false. UID: ${uid}`);
        } catch (error: unknown) {
            result.failed++;
            logger.error(`[${this.getServiceName()}] Email processing failed. ` + `UID: ${uid}. Error: ${this.getErrorMessage(error)}`);

            /**
             * Ошибку дальше не пробрасываем.
             */
        }
    }

    /**
     * Временная заглушка анализа и обработки письма.
     *
     * Позже здесь можно:
     * - распарсить письмо;
     * - определить тип письма;
     * - извлечь вложения;
     * - сохранить данные;
     * - вызвать нужный сервис.
     */

    private async processMessage(mail: IncomingMail): Promise<void> {
        logger.info(`[${this.getServiceName()}] ` + `Starting PDF processing. ` + `UID: ${mail.uid}`);
        const processedTickets = await this.pdfProcessingService.processMail(mail);
        logger.info(`[${this.getServiceName()}] ` + `PDF attachments processed. ` + `UID: ${mail.uid}, ` + `documents: ${processedTickets.length}`
        );

        for (const processedTicket of processedTickets) {
            await this.processParsedDocument(mail, processedTicket);
        }
    }

    private mapAddresses(addresses: | Array<{ name?: string; address?: string; }> | undefined): MailAddress[] {
        if (!addresses) {
            return [];
        }

        return addresses.map((address) => ({
            name: address.name,
            address: address.address
        }));
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
            logger.warn(`[${this.getServiceName()}] Could not gracefully ` + `close IMAP connection: ${this.getErrorMessage(error)}`);
            client.close();
        }
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        if (typeof error === "string") {
            return error;
        }

        return "Unknown error";
    }

    private normalizeDate(value: Date | string | undefined): Date | undefined {
        if (!value) {
            return undefined;
        }

        if (value instanceof Date) {
            return Number.isNaN(value.getTime())
                ? undefined
                : value;
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? undefined
            : date;
    }

    private async processParsedDocument(mail: IncomingMail, processedTicket: ProcessedBusTicket): Promise<void> {
        const { document, pdfContent } = processedTicket;

        logger.info(
            `[${this.getServiceName()}] Parsed bus ticket. ` +
            `UID: ${mail.uid}, ` +
            `filename: "${document.source.filename}", ` +
            `page: ${document.source.pageNumber ?? 1}, ` +
            `parser: ${document.parser.id}, ` +
            `confidence: ${document.parser.confidence}, ` +
            `carrierTicketNumber: ` +
            `${document.identifiers.carrierTicketNumber ?? "unknown"}, ` +
            `itineraryNumber: ` +
            `${document.identifiers.itineraryNumber ?? "unknown"}, ` +
            `route: "${document.trip.routeName ?? "unknown"}", ` +
            `departureDate: ` +
            `${document.trip.departure.date ?? "unknown"}, ` +
            `total: ` +
            `${document.pricing.total ?? "unknown"} ` +
            `${document.pricing.currency ?? ""}`
        );

        const xmlContent = fileConverterXml.jsonToXml(document);
        const outputName = this.createOutputName(mail, document);
        const xmlPath = join(this.currentDirectory, `${outputName}.xml`);
        const pdfPath = join(this.currentDirectory, `${outputName}.pdf`);

        /*
         * Одинаковое базовое имя:
         *
         * 1597.xml
         * 1597.pdf
         */
        await this.fileService.writeFile(xmlPath, xmlContent);
        await this.fileService.writePdfFile(pdfPath, Buffer.from(pdfContent));

        await this.transportService.sendFile(xmlPath);
        await this.transportService.sendFile(pdfPath);

        logger.info(`[${this.getServiceName()}] Ticket files sent ` + `to Samba successfully. ` + `UID: ${mail.uid}, ` + `ticket: "${outputName}"`);
        logger.info(`[${this.getServiceName()}] Ticket files saved. ` + `UID: ${mail.uid}, ` + `XML: "${xmlPath}", ` + `PDF: "${pdfPath}"`);
    }

    private createOutputName(mail: IncomingMail, document: ParsedBusTicketDocument): string {
        const itineraryIdentifier = document.identifiers.itinerarySeries && document.identifiers.itineraryNumber
            ? (
                `${document.identifiers.itinerarySeries}_` +
                `${document.identifiers.itineraryNumber}`
            )
            : document.identifiers.itineraryNumber;

        const identifier = document.identifiers.carrierTicketNumber ??
            itineraryIdentifier ??
            document.identifiers.receiptId ??
            (
                `mail_${mail.uid}_` +
                `page_${document.source.pageNumber ?? 1}`
            );

        return this.sanitizeFilename(identifier);
    }

    private sanitizeFilename(value: string): string {
        const sanitized = value
            /*
             * Недопустимые символы Windows.
             */
            .replace(
                /[<>:"/\\|?*\u0000-\u001F]/g,
                "_"
            )
            .replace(
                /[.\s]+$/g,
                ""
            )
            .trim();

        if (!sanitized) {
            throw new Error(`Could not create output filename`);
        }

        return sanitized.slice(0, 150);
    }
}