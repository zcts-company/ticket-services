// import { PDFParse } from "pdf-parse";
// import { PdfAnalysisResult, PdfDocumentMetadata, PdfMailAttachment, PdfPageAnalysisResult } from "./types/PdfTypes.js";

// export class PdfAnalysisService {

//     async analyze(attachment: PdfMailAttachment): Promise<PdfAnalysisResult> {
//         const parserData = Buffer.from(attachment.content);
//         const parser = new PDFParse({ data: parserData });

//         try {
//             const infoResult = await parser.getInfo();
//             const textResult = await parser.getText({
//                 /*
//                  * Отключаем добавление текстовых маркеров
//                  * вида "-- 1 of 3 --" между страницами.
//                  *
//                  * Границы страниц у нас уже представлены
//                  * отдельными объектами в textResult.pages.
//                  */
//                 pageJoiner: ""
//             });

//             const pages = this.mapPages(textResult.pages);
//             const rawText = pages.map((page) => page.rawText).join("\n\n");
//             const normalizedText = pages.map((page) => page.normalizedText)                .filter(Boolean)                .join("\n\n");

//             if (!normalizedText) {
//                 throw new Error(`No text could be extracted from PDF ` + `"${attachment.filename}". ` + `The document may contain scanned images only`);
//             }

//             return {
//                 filename:                    attachment.filename,
//                 contentType:                    attachment.contentType,
//                 checksum:                    attachment.checksum,
//                 size:                    attachment.size,

//                 /*
//                  * infoResult.total — количество страниц
//                  * согласно метаданным документа.
//                  *
//                  * textResult.total используем как fallback.
//                  */
//                 pageCount:                    infoResult.total ??                    textResult.total ??                    pages.length,
//                 rawText,
//                 normalizedText,
//                 lines:                    this.extractLines(                        normalizedText                    ),
//                 pages,

//                 /*
//                  * В установленной версии pdf-parse
//                  * используется свойство info.
//                  */
//                 metadata:                    this.mapMetadata(                        infoResult.info                    )
//             };
//         } catch (error: unknown) {
//             throw new Error(`Could not analyze PDF ` + `"${attachment.filename}": ` + this.getErrorMessage(error));
//         } finally {
//             await parser.destroy();
//         }
//     }

//     private mapPages(pages: Array<{ num: number; text: string; }>): PdfPageAnalysisResult[] {
//         return pages.map((page) => {
//             const rawText = typeof page.text === "string" ? page.text : "";
//             const normalizedText = this.normalizeText(rawText);

//             return {
//                 pageNumber: page.num,
//                 rawText,
//                 normalizedText,
//                 lines: this.extractLines(normalizedText)
//             };
//         });
//     }

//     private normalizeText(text: string): string {
//         return text
//             .replace(/\uFFFE/g, "-")
//             .replace(/[\u00AD\uFFFF]/g, "")
//             .replace(/[‐-‒–—−]/g, "-")
//             .replace(/\u00A0/g, " ")
//             .replace(/\r\n?/g, "\n")
//             .replace(/[ \t]+\n/g, "\n")
//             .replace(/\n[ \t]+/g, "\n")
//             .replace(/[ \t]{2,}/g, " ")
//             .replace(/\n{3,}/g, "\n\n")
//             .trim();
//     }

//     private extractLines(text: string): string[] {
//         return text
//             .split("\n")
//             .map((line) => line.trim())
//             .filter((line) => line.length > 0);
//     }

//     private mapMetadata(info: unknown): PdfDocumentMetadata {
//         if (!this.isRecord(info)) {
//             return {};
//         }

//         return {
//             title: this.toOptionalString(info.Title),
//             author: this.toOptionalString(info.Author),
//             subject: this.toOptionalString(info.Subject),
//             creator: this.toOptionalString(info.Creator),
//             producer: this.toOptionalString(info.Producer),
//             creationDate: this.toOptionalDateString(info.CreationDate),
//             modificationDate: this.toOptionalDateString(info.ModDate)
//         };
//     }

//     private isRecord(value: unknown): value is Record<string, unknown> {
//         return (typeof value === "object" && value !== null && !Array.isArray(value));
//     }

//     private toOptionalString(value: unknown): string | undefined {
//         if (typeof value !== "string") {
//             return undefined;
//         }
//         const normalizedValue = value.trim();
//         return normalizedValue || undefined;
//     }

//     private toOptionalDateString(value: unknown): string | undefined {
//         if (value instanceof Date) {
//             return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
//         }

//         return this.toOptionalString(value);
//     }

//     private getErrorMessage(error: unknown): string {
//         if (error instanceof Error) {
//             return error.message;
//         }

//         if (typeof error === "string") {
//             return error;
//         }

//         return "Unknown PDF parsing error";
//     }
// }

import { PDFParse } from "pdf-parse";
import { PdfAnalysisResult, PdfDocumentMetadata, PdfMailAttachment, PdfPageAnalysisResult } from "./types/PdfTypes.js";
import { PdfOcrService, TesseractPdfOcrService } from "./PdfOcrService.js";
import { logger } from "../../../../common/logging/Logger.js";

export class PdfAnalysisService {

    constructor(private readonly ocrService: PdfOcrService = new TesseractPdfOcrService()) {
    }

    async analyze(attachment: PdfMailAttachment): Promise<PdfAnalysisResult> {

        const parserData = Buffer.from(attachment.content);
        const parser = new PDFParse({ data: parserData });
        try {
            const infoResult = await parser.getInfo();
            const textResult = await parser.getText({
                /*
                 * Отключаем добавление текстовых
                 * маркеров вида:
                 *
                 * -- 1 of 3 --
                 */
                pageJoiner: ""
            });

            /*
             * Сначала получаем обычный текстовый слой PDF.
             */
            const extractedPages = this.mapPages(textResult.pages);
            /*
             * Проверяем каждую страницу.
             *
             * Если текстовый слой битый либо отсутствует,
             * страницу рендерим в PNG и прогоняем через OCR.
             */
            const pages = await this.repairBrokenPagesWithOcr(parser, extractedPages, attachment.filename);
            const rawText = pages.map((page) => page.rawText).join("\n\n");

            const normalizedText =
                pages.map((page) => page.normalizedText)
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
                pageCount: infoResult.total ?? textResult.total ?? pages.length,
                rawText,
                normalizedText,
                lines: this.extractLines(normalizedText),
                pages,
                metadata: this.mapMetadata(infoResult.info)
            };

        } catch (error: unknown) {
            throw new Error(`Could not analyze PDF ` + `"${attachment.filename}": ` + this.getErrorMessage(error));
        } finally {
            await parser.destroy();
        }
    }


    /**
     * Проверяем текстовый слой каждой страницы.
     *
     * Нормальные PDF остаются полностью на pdf-parse.
     * OCR используется только как fallback.
     */
    private async repairBrokenPagesWithOcr(parser: PDFParse, pages: PdfPageAnalysisResult[], filename: string): Promise<PdfPageAnalysisResult[]> {

        const result: PdfPageAnalysisResult[] = [];

        for (const page of pages) {

            if (!this.isBrokenTextLayer(page.rawText)) {
                result.push(page);
                continue;
            }

            console.warn(`[PDF ANALYSIS] Broken text layer detected. ` + `Using OCR. File: "${filename}", ` + `page: ${page.pageNumber}`);
            const ocrText = await this.extractPageTextWithOcr(parser, page.pageNumber, filename);
            const normalizedText = this.normalizeText(ocrText);
            logger.info(`[PDF OCR] File: "${filename}", ` + `page: ${page.pageNumber}\n` + normalizedText);
            if (!normalizedText) {
                throw new Error(`OCR could not extract text from ` + `page ${page.pageNumber} of ` + `"${filename}"`);
            }

            result.push({
                pageNumber: page.pageNumber,
                /*
                 * Для последующих парсеров OCR-текст
                 * становится исходным текстом страницы.
                 */
                rawText: ocrText,
                normalizedText,
                lines: this.extractLines(normalizedText)
            });
        }

        return result;
    }


    /**
     * Рендерит одну страницу PDF и распознаёт её.
     */
    private async extractPageTextWithOcr(
        parser: PDFParse,
        pageNumber: number,
        filename: string
    ): Promise<string> {

        const screenshotResult =
            await parser.getScreenshot({
                partial: [
                    pageNumber
                ],
                scale: 4,
                imageBuffer: true,
                imageDataUrl: false
            });

        const screenshot =
            screenshotResult.pages[0];

        if (
            !screenshot ||
            !screenshot.data
        ) {
            throw new Error(
                `Could not render page ${pageNumber} ` +
                `of "${filename}" for OCR`
            );
        }

        /*
         * Основной OCR.
         *
         * PSM 3 хорошо распознаёт структуру страницы:
         * маршрут, даты, платформу, место и перевозчика.
         */
        const primaryText =
            await this.ocrService.recognize(
                screenshot.data,
                {
                    psm: 3
                }
            );

        /*
         * Если PSM 3 потерял ФИО пассажира,
         * делаем дополнительный OCR той же страницы
         * в PSM 11.
         */
        return await this.enrichPassengerNameWithOcr(
            screenshot.data,
            primaryText,
            filename,
            pageNumber
        );
    }


    /**
     * Определяем, что текстовый слой PDF повреждён.
     *
     * В Бжиков.pdf встречается большое количество
     * управляющих символов вместо кириллицы.
     */
    private isBrokenTextLayer(text: string): boolean {
        const trimmed = text.trim();

        /*
         * Сканированный PDF либо вообще без
         * текстового слоя.
         */
        if (!trimmed) {
            return true;
        }

        /*
         * Управляющие символы, кроме:
         *
         * \t
         * \n
         * \r
         *
         * В обычном extracted text их быть
         * практически не должно.
         */
        const controlCharacters = text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g)?.length ?? 0;

        /*
         * U+FFFD означает, что Unicode-символ
         * не удалось декодировать.
         */
        const replacementCharacters = text.match(/\uFFFD/g)?.length ?? 0;
        const meaningfulLength = text.replace(/\s/g, "").length;
        if (meaningfulLength === 0) {
            return true;
        }

        const suspiciousCharacters = controlCharacters + replacementCharacters;

        /*
         * Несколько управляющих символов уже
         * подозрительны, но используем ещё ratio,
         * чтобы случайный символ не запускал OCR.
         */
        if (suspiciousCharacters >= 5 && (suspiciousCharacters / meaningfulLength) >= 0.01) {
            return true;
        }

        /*
         * Дополнительная защита конкретно от
         * сильно повреждённого текстового слоя:
         * большой документ, но практически
         * отсутствуют нормальные буквы.
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

    private async enrichPassengerNameWithOcr(
        image: Uint8Array,
        primaryText: string,
        filename: string,
        pageNumber: number
    ): Promise<string> {

        /*
         * Если основной PSM 3 уже нашёл:
         *
         * Бжиков А.О.
         * Хайдаров И.И.
         *
         * второй OCR не нужен.
         */
        const primaryPassengerName =
            this.extractPassengerNameWithInitials(
                primaryText
            );

        if (primaryPassengerName) {
            return primaryText;
        }

        /*
         * Дополнительный OCR запускаем только для
         * документов, где вообще присутствует
         * пассажирская секция.
         *
         * Учитываем OCR-ошибку:
         *
         * "Информация o пассажире"
         *
         * где "o" может быть латинской.
         */
        if (
            !/Информация\s+[оo]\s+пассажире/iu
                .test(primaryText)
        ) {
            return primaryText;
        }

        console.log(
            `[PDF OCR] Passenger name was not found ` +
            `with PSM 3. Trying PSM 11. ` +
            `File: "${filename}", page: ${pageNumber}`
        );

        const secondaryText =
            await this.ocrService.recognize(
                image,
                {
                    psm: 11
                }
            );

        const passengerName =
            this.extractPassengerNameWithInitials(
                secondaryText
            );

        if (!passengerName) {
            console.log(
                `[PDF OCR] Passenger name was not found ` +
                `with PSM 11. ` +
                `File: "${filename}", page: ${pageNumber}`
            );

            return primaryText;
        }

        console.log(
            `[PDF OCR] Passenger name recovered: ` +
            `"${passengerName}". ` +
            `File: "${filename}", page: ${pageNumber}`
        );

        return [
            primaryText,
            `OCR_PASSENGER_NAME: ${passengerName}`
        ].filter(Boolean).join("\n");
    }

    private extractPassengerNameWithInitials(text: string): string | undefined {
        const match = text.match(/(?:^|\s)([А-ЯЁ][А-Яа-яЁё-]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.)(?=\s|\/|$)/u);
        return match?.[1] ? match[1].replace(/\s+/g, " ").trim() : undefined;
    }




}