export interface MailboxServiceOptions {
    serviceName: string;

    host: string;
    servername:string;
    port: number;
    secure: boolean;

    username: string;
    password: string;

    /**
     * Папка, которую необходимо проверять.
     * Обычно используется INBOX.
     */
    mailbox: string;

    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
    deleteProcessedMessages?: boolean;
}

export interface MailAddress {
    name?: string;
    address?: string;
}

export interface IncomingMail {
    /**
     * UID письма внутри текущей IMAP-папки.
     */
    uid: number;

    messageId?: string;
    subject?: string;
    date?: Date;

    from: MailAddress[];
    to: MailAddress[];
    cc: MailAddress[];

    /**
     * Полный исходник письма в формате RFC822.
     *
     * Содержит заголовки, текст письма и вложения.
     */
    source: Buffer;
}

export interface MailboxRunResult {
    found: number;
    processed: number;
    deleted: number;
    failed: number;
}