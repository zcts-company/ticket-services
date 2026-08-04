import fs from "fs-extra";
import path from "node:path";
import SambaClient from "samba-client";
import { logger } from "../../../../common/logging/Logger.js";
import config from "../../../../config/bus/bus_config.json"    with { type: "json" };
export class BusTransportService {

    private readonly sambaClient: SambaClient;

    constructor() {
        this.sambaClient = new SambaClient({
            address: config.samba.server,
            username: config.samba.user,
            password: config.samba.password,
            domain: config.samba.domain
        });
    }

    /**
     * Отправляет один файл на Samba.
     *
     * Локальный файл удаляется только после того,
     * как Samba подтвердила его наличие.
     */
    async sendFile(localFilePath: string): Promise<void> {
        const localFileExists = await fs.pathExists(localFilePath);

        if (!localFileExists) {
            throw new Error(`Local file does not exist: ` + `"${localFilePath}"`);
        }

        const fileName = path.basename(localFilePath);
        const remoteFilePath = this.createRemoteFilePath(fileName);

        try {
            logger.info(`[BUS TRANSPORT] Sending file ` + `"${localFilePath}" to Samba ` + `"${remoteFilePath}"`);
            await this.sambaClient.sendFile(localFilePath, remoteFilePath);
            const remoteFileExists = await this.sambaClient.fileExists(remoteFilePath);
            if (!remoteFileExists) {
                throw new Error(`File was sent, but Samba did not ` + `confirm its existence: ` + `"${remoteFilePath}"`);
            }
            logger.info(`[BUS TRANSPORT] File "${fileName}" ` + `successfully sent to Samba server ` + `"${config.samba.server}"`);
            await this.removeLocalFile(localFilePath);
        } catch (error: unknown) {
            const errorMessage = this.getErrorMessage(error);

            logger.error(`[BUS TRANSPORT] Could not send file ` + `"${localFilePath}" to Samba. ` + `Remote path: "${remoteFilePath}". ` + `Error: ${errorMessage}`);
            /*
             * Обязательно пробрасываем ошибку.
             * Тогда процесс обработки письма завершится
             * ошибкой, и письмо не будет удалено.
             */
            throw new Error(`Could not send file "${fileName}" ` + `to Samba: ${errorMessage}`);
        }
    }

    private async removeLocalFile(localFilePath: string): Promise<void> {
        await fs.remove(localFilePath);

        const stillExists = await fs.pathExists(localFilePath);

        if (stillExists) {
            throw new Error(`File was sent to Samba, but could not ` + `be removed locally: ` + `"${localFilePath}"`);
        }

        logger.info(`[BUS TRANSPORT] Local file removed: ` + `"${localFilePath}"`);
    }

    private createRemoteFilePath(fileName: string): string {
        const directory = config.samba.directory.replace(/[\\/]+$/, "");
        const separator = directory.includes("\\") ? "\\" : "/";
        return (`${directory}` + `${separator}` + `${fileName}`);
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return (
                error.message ||
                error.name
            );
        }

        if (typeof error === "string") {
            return error;
        }

        return "Unknown Samba error";
    }
}