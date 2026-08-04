import { simpleParser } from "mailparser";

import { PdfMailAttachment } from "./types/PdfTypes.js";

export class MailPdfAttachmentService {

    private readonly maxPdfSizeBytes = 25 * 1024 * 1024;

    async extractPdfAttachments(mailSource: Buffer): Promise<PdfMailAttachment[]> {
        if (!Buffer.isBuffer(mailSource)) {
            throw new Error("Mail source must be a Buffer");
        }

        if (mailSource.length === 0) {
            throw new Error("Mail source is empty");
        }

        const parsedMail = await simpleParser(mailSource, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true, checksumAlgo: "sha256" });

        const result: PdfMailAttachment[] = [];

        for (let attachmentIndex = 0; attachmentIndex < parsedMail.attachments.length; attachmentIndex++) {
            const attachment = parsedMail.attachments[attachmentIndex];
            const content = this.copyBinaryData(attachment.content);

            if (!this.looksLikePdf(attachment.filename, attachment.contentType, content)) {
                continue;
            }

            const filename = attachment.filename?.trim() || `attachment-${attachmentIndex + 1}.pdf`;

            if (content.length === 0) {
                throw new Error(`PDF attachment "${filename}" is empty`);
            }

            if (content.length > this.maxPdfSizeBytes) {
                throw new Error(`PDF attachment "${filename}" is too large. ` + `Size: ${content.length} bytes, ` + `maximum: ${this.maxPdfSizeBytes} bytes`);
            }

            if (!this.hasPdfSignature(content)) {
                throw new Error(`Attachment "${filename}" looks like PDF, ` + `but does not contain a valid PDF signature`);
            }

            result.push({
                filename,
                contentType:
                    attachment.contentType ||
                    "application/pdf",
                contentDisposition:
                    attachment.contentDisposition,
                checksum:
                    attachment.checksum,
                size:
                    attachment.size ??
                    content.length,
                content
            });
        }

        return result;
    }

    private looksLikePdf(filename: string | undefined, contentType: string | undefined, content: ArrayLike<number>): boolean {
        const normalizedFilename = filename?.trim().toLowerCase() ?? "";

        const normalizedContentType = contentType?.trim().toLowerCase() ?? "";

        return (normalizedFilename.endsWith(".pdf") || normalizedContentType === "application/pdf" || this.hasPdfSignature(content));
    }

    /**
     * Проверяет наличие ASCII-сигнатуры:
     *
     * %PDF-
     */
    private hasPdfSignature(content: ArrayLike<number>): boolean {
        const signature: readonly number[] = [
            0x25, // %
            0x50, // P
            0x44, // D
            0x46, // F
            0x2D  // -
        ];

        const searchLimit = Math.min(content.length, 1024);

        if (searchLimit < signature.length) {
            return false;
        }

        for (let position = 0; position <= searchLimit - signature.length; position++) {
            let matches = true;

            for (let signatureIndex = 0; signatureIndex < signature.length; signatureIndex++) {
                if (content[position + signatureIndex] !== signature[signatureIndex]) {
                    matches = false;
                    break;
                }
            }

            if (matches) {
                return true;
            }
        }

        return false;
    }

    /**
     * Копирует Buffer или другой массив байтов
     * в Uint8Array, основанный строго на ArrayBuffer.
     */
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