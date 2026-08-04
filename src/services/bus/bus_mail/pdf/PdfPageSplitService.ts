import { PDFDocument } from "pdf-lib";

export class PdfPageSplitService {

    /**
     * Создаёт отдельные одностраничные PDF.
     *
     * Ключ Map — номер страницы, начиная с 1.
     */
    async extractPages(
        sourceContent: Uint8Array,
        pageNumbers: number[]
    ): Promise<Map<number, Uint8Array>> {
        const sourceDocument =
            await PDFDocument.load(
                sourceContent
            );

        const sourcePageCount =
            sourceDocument.getPageCount();

        const uniquePageNumbers = [
            ...new Set(pageNumbers)
        ].sort(
            (first, second) =>
                first - second
        );

        const result =
            new Map<number, Uint8Array>();

        for (
            const pageNumber of uniquePageNumbers
        ) {
            this.validatePageNumber(
                pageNumber,
                sourcePageCount
            );

            const targetDocument =
                await PDFDocument.create();

            /*
             * В pdf-lib страницы индексируются с нуля.
             */
            const [copiedPage] =
                await targetDocument.copyPages(
                    sourceDocument,
                    [pageNumber - 1]
                );

            targetDocument.addPage(
                copiedPage
            );

            const pdfContent =
                await targetDocument.save();

            result.set(
                pageNumber,
                pdfContent
            );
        }

        return result;
    }

    private validatePageNumber(
        pageNumber: number,
        pageCount: number
    ): void {
        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1 ||
            pageNumber > pageCount
        ) {
            throw new Error(
                `Cannot extract PDF page ` +
                `${pageNumber}. Document contains ` +
                `${pageCount} page(s)`
            );
        }
    }
}