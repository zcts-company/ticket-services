export interface ParsedAirMailAddress {
    name?: string;
    address?: string;
}


export interface ParsedAirMail {

    uid: number;

    messageId?: string;

    subject?: string;

    date?: Date;

    from: ParsedAirMailAddress[];

    to: ParsedAirMailAddress[];

    cc: ParsedAirMailAddress[];

    /**
     * Декодированная text/plain MIME part.
     */
    text?: string;

    /**
     * Декодированная text/html MIME part.
     */
    html?: string;
}