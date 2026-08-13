export class UnsupportedPdfFormatError extends Error {

    constructor(
        readonly filename: string,
        readonly detectedParsers: Array<{ parserId: string; confidence: number; }>
    ) {
        super(`Unsupported PDF ticket format: "${filename}"`);
        this.name = "UnsupportedPdfFormatError";
    }
}