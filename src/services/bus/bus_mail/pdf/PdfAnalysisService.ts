import { PDFParse } from "pdf-parse";

import { PdfAnalysisResult, PdfDocumentMetadata, PdfMailAttachment, PdfPageAnalysisResult } from "./types/PdfTypes.js";

export class PdfAnalysisService {

    async analyze(attachment: PdfMailAttachment): Promise<PdfAnalysisResult> {
        const parserData = Buffer.from(attachment.content);
        const parser = new PDFParse({ data: parserData });

        try {
            const infoResult = await parser.getInfo();
            const textResult = await parser.getText({
                /*
                 * Отключаем добавление текстовых маркеров
                 * вида "-- 1 of 3 --" между страницами.
                 *
                 * Границы страниц у нас уже представлены
                 * отдельными объектами в textResult.pages.
                 */
                pageJoiner: ""
            });

            const pages = this.mapPages(textResult.pages);
            const rawText = pages.map((page) => page.rawText).join("\n\n");
            const normalizedText = pages.map((page) => page.normalizedText)
                .filter(Boolean)
                .join("\n\n");

            if (!normalizedText) {
                throw new Error(`No text could be extracted from PDF ` + `"${attachment.filename}". ` + `The document may contain scanned images only`);
            }

            return {
                filename:
                    attachment.filename,
                contentType:
                    attachment.contentType,
                checksum:
                    attachment.checksum,
                size:
                    attachment.size,

                /*
                 * infoResult.total — количество страниц
                 * согласно метаданным документа.
                 *
                 * textResult.total используем как fallback.
                 */
                pageCount:
                    infoResult.total ??
                    textResult.total ??
                    pages.length,

                rawText,
                normalizedText,

                lines:
                    this.extractLines(
                        normalizedText
                    ),

                pages,

                /*
                 * В установленной версии pdf-parse
                 * используется свойство info.
                 */
                metadata:
                    this.mapMetadata(
                        infoResult.info
                    )
            };
        } catch (error: unknown) {
            throw new Error(`Could not analyze PDF ` + `"${attachment.filename}": ` + this.getErrorMessage(error));
        } finally {
            await parser.destroy();
        }
    }

    private mapPages(pages: Array<{ num: number; text: string; }>): PdfPageAnalysisResult[] {
        return pages.map((page) => {
            const rawText = typeof page.text === "string" ? page.text : "";
            const normalizedText = this.normalizeText(rawText);

            return {
                pageNumber: page.num,
                rawText,
                normalizedText,
                lines: this.extractLines(normalizedText)
            };
        });
    }

    private normalizeText(text: string): string {
        return text
            .replace(/\uFFFE/g, "-")
            .replace(/[\u00AD\uFFFF]/g, "")
            .replace(/[‐-‒–—−]/g, "-")
            .replace(/\u00A0/g, " ")
            .replace(/\r\n?/g, "\n")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n[ \t]+/g, "\n")
            .replace(/[ \t]{2,}/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    private extractLines(text: string): string[] {
        return text
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }

    private mapMetadata(info: unknown): PdfDocumentMetadata {
        if (!this.isRecord(info)) {
            return {};
        }

        return {
            title: this.toOptionalString(info.Title),
            author: this.toOptionalString(info.Author),
            subject: this.toOptionalString(info.Subject),
            creator: this.toOptionalString(info.Creator),
            producer: this.toOptionalString(info.Producer),
            creationDate: this.toOptionalDateString(info.CreationDate),
            modificationDate: this.toOptionalDateString(info.ModDate)
        };
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return (typeof value === "object" && value !== null && !Array.isArray(value));
    }

    private toOptionalString(value: unknown): string | undefined {
        if (typeof value !== "string") {
            return undefined;
        }
        const normalizedValue = value.trim();
        return normalizedValue || undefined;
    }

    private toOptionalDateString(value: unknown): string | undefined {
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
        }

        return this.toOptionalString(value);
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        if (typeof error === "string") {
            return error;
        }

        return "Unknown PDF parsing error";
    }
}