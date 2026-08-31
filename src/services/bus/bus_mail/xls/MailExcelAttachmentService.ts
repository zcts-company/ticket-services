import { simpleParser } from "mailparser";

export interface ExcelMailAttachment {
    filename: string;
    contentType: string;
    size: number;
    content: Uint8Array<ArrayBuffer>;
}

export class MailExcelAttachmentService {

    private readonly maxExcelSizeBytes = 25 * 1024 * 1024;

    async extractExcelAttachments(mailSource: Buffer): Promise<ExcelMailAttachment[]> {

        if (!Buffer.isBuffer(mailSource)) {
            throw new Error("Mail source must be a Buffer");
        }

        if (mailSource.length === 0) {
            throw new Error("Mail source is empty");
        }

        const parsedMail = await simpleParser(
            mailSource,
            {
                skipHtmlToText: true,
                skipTextToHtml: true,
                skipImageLinks: true,
                checksumAlgo: "sha256"
            }
        );

        const result: ExcelMailAttachment[] = [];

        for (let attachmentIndex = 0; attachmentIndex < parsedMail.attachments.length; attachmentIndex++) {
            const attachment = parsedMail.attachments[attachmentIndex];

            if (!this.looksLikeExcel(attachment.filename, attachment.contentType)) {
                continue;
            }

            const content = this.copyBinaryData(attachment.content);
            const filename = attachment.filename?.trim() || this.createDefaultFilename(attachment.contentType, attachmentIndex);

            if (content.length === 0) {
                throw new Error(`Excel attachment "${filename}" is empty`);
            }

            if (content.length > this.maxExcelSizeBytes) {
                throw new Error(`Excel attachment "${filename}" is too large. ` + `Size: ${content.length} bytes, ` + `maximum: ${this.maxExcelSizeBytes} bytes`);
            }

            result.push({ filename, contentType: attachment.contentType || "application/octet-stream", size: attachment.size ?? content.length, content });
        }

        return result;
    }

    private looksLikeExcel(filename: string | undefined, contentType: string | undefined): boolean {
        const normalizedFilename = filename?.trim().toLowerCase() ?? "";
        const normalizedContentType = contentType?.trim().toLowerCase() ?? "";
        return (
            normalizedFilename.endsWith(".xls")
            || normalizedFilename.endsWith(".xlsx")
            || normalizedContentType === "application/vnd.ms-excel"
            || normalizedContentType ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
    }

    private createDefaultFilename(contentType: string | undefined, attachmentIndex: number): string {

        const normalizedContentType = contentType?.trim().toLowerCase() ?? "";
        const extension = normalizedContentType === "application/vnd.ms-excel" ? "xls" : "xlsx";

        return `attachment-${attachmentIndex + 1}.${extension}`;
    }

    private copyBinaryData(source: ArrayLike<number>): Uint8Array<ArrayBuffer> {

        const result = new Uint8Array(
            new ArrayBuffer(source.length)
        );

        for (let index = 0; index < source.length; index++) {
            result[index] = source[index];
        }

        return result;
    }
}