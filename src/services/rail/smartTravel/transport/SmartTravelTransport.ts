import fs from "fs-extra"
import SambaClient from 'samba-client'
import { logger } from "../../../../common/logging/Logger.js"
import config from "../../../../config/rail/smart_travel.json" with {type: 'json'}
import { join, posix } from "node:path";

export class SmartTravelTransport {

    private currentDirectory: string
    private directory1C: string
    private sambaClient: SambaClient

    constructor() {
        this.currentDirectory = config.fileOutput.mainPath
        this.directory1C = config.directory1C.mainPath
        this.sambaClient = new SambaClient({
            address: config.samba.server,
            username: config.samba.user,
            password: config.samba.password,
            domain: config.samba.domain
        })
    }



    async sendTo1C(currentArchive: string | undefined) {
        if (currentArchive) {
            const files: string[] = await fs.readdir(this.currentDirectory)
            if (files.length > 0) {
                files.forEach(async (fileName) => {
                    try {
                        await fs.copy(this.currentDirectory + fileName, this.directory1C + fileName);
                        const exists: boolean = await fs.pathExists(`${this.directory1C}${fileName}`)

                        if (exists) {
                            logger.info(`[SMARTTRAVEL TRANSPORT] File ${fileName} sended to directory: ${this.directory1C}`);
                            await this.sendToArchive(currentArchive, fileName)
                        }
                    } catch {
                        logger.error(`[SMARTTRAVEL TRANSPORT] Directory ${this.directory1C} not exists or not available`)
                    }
                })
            }

        }
    }

    async sendTo1CSamba(currentArchive: string | undefined) {
        if (!currentArchive) return;

        const files: string[] = await fs.readdir(this.currentDirectory);

        for (const fileName of files) {
            if (!fileName.endsWith(".xml")) continue;
            const transportType = fileName.split("_")[0];

            let directory: string;

            switch (transportType) {
                case "rail":
                    directory = config.samba.rail_directory;
                    break;
                case "bus":
                    directory = config.samba.bus_directory;
                    break;
                default:
                    directory = "/";
                    logger.warn(`[SMARTTRAVEL TRANSPORT] Unknown transport type: ${transportType}. File ${fileName} will be sent to Samba root`);
                    break;
            }

            const sourcePath = join(this.currentDirectory, fileName);
            const destinationPath = posix.join(directory, fileName);

            try {
                await this.sambaClient.sendFile(sourcePath, destinationPath);
                const exists = await this.sambaClient.fileExists(destinationPath);
                if (exists) {
                    logger.info(`[SMARTTRAVEL TRANSPORT] File ${sourcePath} sent to ` + `SAMBA SERVER: ${config.samba.server}${destinationPath}`);
                    await this.sendToArchive(currentArchive, fileName);
                } else {
                    logger.error(`[SMARTTRAVEL TRANSPORT] File not found on Samba: ${destinationPath}`);
                }

            } catch (error: any) {
                logger.error(`[SMARTTRAVEL TRANSPORT] Failed to send ${fileName} ` + `to ${directory}: ${error.message}`);
            }
        }
    }


    private async sendToArchive(currentArchive: string, fileName: string) {

        await fs.copy(this.currentDirectory + fileName, currentArchive + fileName);
        const exists: boolean = await fs.pathExists(`${currentArchive}${fileName}`)

        if (exists) {
            logger.info(`[SMARTTRAVEL TRANSPORT] File ${fileName} sended to archive directory: ${currentArchive}`);
            await this.removeFileFromCurrent(fileName)
        }

    }

    private async removeFileFromCurrent(fileName: string) {
        await fs.remove(`${this.currentDirectory}${fileName}`)
        const exist: boolean = await fs.pathExists(`${this.currentDirectory}${fileName}`)

        if (!exist) {
            logger.info(`[SMARTTRAVEL TRANSPORT] File ${fileName} removed from current directory: ${this.currentDirectory}`);
        }
    }

}