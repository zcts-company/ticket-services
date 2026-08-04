export interface PdfMailAttachment {
    filename: string;
    contentType: string;
    contentDisposition?: string;
    checksum?: string;
    size: number;

    content: Uint8Array<ArrayBuffer>;
}

export interface PdfDocumentMetadata {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
}

export interface PdfPageAnalysisResult {
    /**
     * Номер страницы в исходном PDF.
     * Нумерация начинается с 1.
     */
    pageNumber: number;

    rawText: string;
    normalizedText: string;
    lines: string[];
}
export interface PdfAnalysisResult {
    filename: string;
    contentType: string;
    checksum?: string;
    size: number;

    /**
     * Общее количество страниц исходного PDF.
     */
    pageCount: number;

    /**
     * Номер текущей страницы.
     *
     * Заполняется, когда объект создаётся для передачи
     * конкретной страницы в билетный парсер.
     */
    pageNumber?: number;

    rawText: string;
    normalizedText: string;
    lines: string[];

    /**
     * Результаты анализа каждой страницы отдельно.
     */
    pages: PdfPageAnalysisResult[];

    metadata: PdfDocumentMetadata;
}

// export interface PdfAnalysisResult {
//     filename: string;
//     contentType: string;
//     checksum?: string;
//     size: number;

//     pageCount: number;

//     /**
//      * Текст в том виде, в котором его вернула PDF-библиотека.
//      */
//     rawText: string;

//     /**
//      * Текст после нормализации пробелов и переносов строк.
//      */
//     normalizedText: string;

//     /**
//      * Непустые строки документа.
//      */
//     lines: string[];

//     metadata: PdfDocumentMetadata;
// }

/**
 * Результат бизнес-парсинга документа.
 *
 * Поля здесь пока универсальные. После получения примера PDF
 * можно будет добавить конкретные поля автобусного билета.
 */
export interface ParsedBusPdfDocument {
    filename: string;
    checksum?: string;
    size: number;
    pageCount: number;
    metadata: PdfDocumentMetadata;

    /**
     * Поля формата:
     *
     * Номер билета: 123456
     * Пассажир: Иван Иванов
     */
    fields: Record<string, string>;

    lines: string[];
    text: string;
}