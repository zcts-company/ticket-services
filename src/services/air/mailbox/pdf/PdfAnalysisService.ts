import { PDFParse } from "pdf-parse";
import { logger } from "../../../../common/logging/Logger.js";
import { PdfOcrService, TesseractPdfOcrService } from "../../../bus/bus_mail/pdf/PdfOcrService.js";
import { PdfAnalysisResult, PdfDocumentMetadata, PdfMailAttachment, PdfPageAnalysisResult } from "../../../bus/bus_mail/pdf/types/PdfTypes.js";


export class PdfAnalysisService {

    constructor(
        private readonly ocrService: PdfOcrService = new TesseractPdfOcrService()) {
    }


    async analyze(attachment: PdfMailAttachment): Promise<PdfAnalysisResult> {
        const parserData = Buffer.from(attachment.content);
        const parser = new PDFParse({ data: parserData });
        try {
            const infoResult = await parser.getInfo();
            const textResult = await parser.getText({ pageJoiner: "" });
            const extractedPages = this.mapPages(textResult.pages);
            const pages = await this.repairBrokenPagesWithOcr(parser, extractedPages, attachment.filename);
            const rawText = pages.map((page) => page.rawText).join("\n\n");

            const normalizedText = pages.map((page) => page.normalizedText)
                .filter(Boolean)
                .join("\n\n");


            if (!normalizedText) {
                throw new Error(`No text could be extracted from PDF ` + `"${attachment.filename}"`);
            }

            return {
                filename: attachment.filename,
                contentType: attachment.contentType,
                checksum: attachment.checksum,
                size: attachment.size,
                pageCount:
                    infoResult.total ??
                    textResult.total ??
                    pages.length,
                rawText,
                normalizedText,
                lines: this.extractLines(normalizedText),
                pages,
                metadata: this.mapMetadata(infoResult.info)
            };

        } catch (error: unknown) {
            throw new Error(`Could not analyze AIR PDF ` + `"${attachment.filename}": ` + this.getErrorMessage(error));
        } finally {
            await parser.destroy();
        }
    }


    /**
     * Проверяет текстовый слой каждой страницы.
     *
     * Нормальные PDF остаются полностью на pdf-parse.
     *
     * OCR является fallback, а не основным способом
     * разбора документа.
     */
    private async repairBrokenPagesWithOcr(parser: PDFParse, pages: PdfPageAnalysisResult[], filename: string): Promise<PdfPageAnalysisResult[]> {
        const result: PdfPageAnalysisResult[] = [];
        for (const page of pages) {
            if (!this.isBrokenTextLayer(page.rawText)) {
                result.push(page);
                continue;
            }

            logger.warn(
                `[AIR PDF ANALYSIS] Broken text layer detected. ` +
                `Using OCR. ` +
                `File: "${filename}", ` +
                `page: ${page.pageNumber}`
            );


            const ocrText = await this.extractPageTextWithOcr(parser, page.pageNumber, filename);
            const normalizedText = this.normalizeText(ocrText);
            if (!normalizedText) {
                throw new Error(
                    `OCR could not extract text from ` +
                    `page ${page.pageNumber} of ` +
                    `"${filename}"`
                );
            }

            logger.info(
                `[AIR PDF OCR] File: "${filename}", ` +
                `page: ${page.pageNumber}\n` +
                normalizedText
            );


            result.push({
                pageNumber: page.pageNumber,
                rawText: ocrText,
                normalizedText,
                lines: this.extractLines(normalizedText)
            });
        }

        return result;
    }


    /**
     * Рендерит конкретную страницу PDF в PNG
     * и передает ее Tesseract.
     */
    private async extractPageTextWithOcr(parser: PDFParse, pageNumber: number, filename: string): Promise<string> {
        const screenshotResult =
            await parser.getScreenshot({
                partial: [pageNumber],
                scale: 4,
                imageBuffer: true,
                imageDataUrl: false
            });


        const screenshot = screenshotResult.pages[0];
        if (!screenshot || !screenshot.data) {
            throw new Error(`Could not render page ${pageNumber} ` + `of "${filename}" for OCR`);
        }


        /*
         * PSM 3:
         *
         * автоматическое определение структуры страницы.
         *
         * Это наиболее подходящий дефолт для NDC PDF,
         * содержащего таблицы:
         *
         * Flight Details
         * Passengers Details
         * Baggage
         */
        return await this.ocrService.recognize(
            screenshot.data,
            {
                psm: 3
            }
        );
    }


    /**
     * Определяет, является ли текстовый слой страницы
     * непригодным для дальнейшего парсинга.
     */
    private isBrokenTextLayer(text: string): boolean {
        const trimmed = text.trim();
        if (!trimmed) {
            return true;
        }
        const controlCharacters = text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g)?.length ?? 0;
        const replacementCharacters = text.match(/\uFFFD/g)?.length ?? 0;
        const meaningfulLength = text.replace(/\s/g, "").length;
        if (meaningfulLength === 0) {
            return true;
        }

        const suspiciousCharacters = controlCharacters + replacementCharacters;

        if (suspiciousCharacters >= 5 && (suspiciousCharacters / meaningfulLength) >= 0.01) {
            return true;
        }


        /*
         * Дополнительная защита от текста,
         * который технически присутствует,
         * но фактически состоит из мусора.
         */
        const letters = text.match(/\p{L}/gu)?.length ?? 0;

        if (meaningfulLength >= 200 && letters < 10 && suspiciousCharacters > 0) {
            return true;
        }

        return false;
    }


    private mapPages(pages: Array<{ num: number; text: string; }>): PdfPageAnalysisResult[] {
        return pages.map(
            (page) => {
                const rawText = typeof page.text === "string" ? page.text : "";
                const normalizedText = this.normalizeText(rawText);
                return {
                    pageNumber: page.num,
                    rawText,
                    normalizedText,
                    lines: this.extractLines(normalizedText)
                };
            }
        );
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
            .map(
                (line) =>
                    line.trim()
            )
            .filter(
                (line) =>
                    line.length > 0
            );
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
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }


    private toOptionalString(value: unknown): string | undefined {

        if (typeof value !== "string") {
            return undefined;
        }

        const normalizedValue = value.trim();
        return (normalizedValue || undefined);
    }


    private toOptionalDateString(value: unknown): string | undefined {
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
        }

        return this.toOptionalString(value);
    }

    private getErrorMessage(error: unknown): string {

        if (error instanceof Error) {
            return (error.message || error.name);
        }


        if (typeof error === "string") {
            return (error || "Empty string error");
        }

        try {
            return JSON.stringify(error);
        } catch {
            return "Unknown AIR PDF parsing error";
        }
    }
}