import fs from "fs-extra"


export class FileService {

    constructor() {

    }

    async pathExsist(path: string) {
        return await fs.pathExists(path)
    }

    async writeFile(path: string, data: string) {
        await fs.outputFile(path, data)
    }

    async writeBinaryFile(path: string, data: Uint8Array | Buffer): Promise<void> {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        await fs.outputFile(path, buffer);
    }

    async writePdfFile(path: string, data: Uint8Array | Buffer): Promise<void> {
        const pdfBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        await fs.outputFile(path, pdfBuffer);
    }

    async createDirectory(path: string) {
        await fs.ensureDir(path);
    }

    async readFile(path: string) {
        return await fs.readFile(path)
    }

    async readDiretory(path: string) {
        return await fs.readdir(path);
    }

}