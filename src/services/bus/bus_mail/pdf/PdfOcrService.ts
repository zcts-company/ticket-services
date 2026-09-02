import { spawn } from "node:child_process";

export interface PdfOcrOptions {
    psm?: number;
}

export interface PdfOcrService {
    recognize(image: Uint8Array, options?: PdfOcrOptions): Promise<string>;
}

export class TesseractPdfOcrService
    implements PdfOcrService {

    async recognize(
        image: Uint8Array,
        options?: PdfOcrOptions
    ): Promise<string> {

        const psm =
            options?.psm ?? 3;

        return new Promise<string>(
            (resolve, reject) => {

                const process = spawn(
                    "tesseract",
                    [
                        "stdin",
                        "stdout",
                        "-l",
                        "rus+eng",
                        "--psm",
                        String(psm),
                        "-c",
                        "preserve_interword_spaces=1"
                    ],
                    {
                        stdio: [
                            "pipe",
                            "pipe",
                            "pipe"
                        ]
                    }
                );

                const stdoutChunks: Buffer[] = [];
                const stderrChunks: Buffer[] = [];

                process.stdout.on(
                    "data",
                    (chunk: Buffer) => {
                        stdoutChunks.push(chunk);
                    }
                );

                process.stderr.on(
                    "data",
                    (chunk: Buffer) => {
                        stderrChunks.push(chunk);
                    }
                );

                process.on(
                    "error",
                    (error) => {
                        reject(
                            new Error(
                                `Could not start Tesseract: ${error.message}`
                            )
                        );
                    }
                );

                process.on(
                    "close",
                    (code) => {
                        if (code !== 0) {
                            const stderr =
                                Buffer
                                    .concat(
                                        stderrChunks
                                    )
                                    .toString("utf8")
                                    .trim();

                            reject(
                                new Error(
                                    `Tesseract failed with code ${code}: ${stderr}`
                                )
                            );

                            return;
                        }

                        resolve(
                            Buffer
                                .concat(
                                    stdoutChunks
                                )
                                .toString("utf8")
                        );
                    }
                );

                process.stdin.end(
                    Buffer.from(image)
                );
            }
        );
    }
}