import fs from "fs-extra"
import SambaClient from 'samba-client'
import { logger } from "../../../../common/logging/Logger.js"
import config from "../../../../config/taxi/yandex.json" with {type: 'json'}
import { ProfileType } from "../../../../common/types/ProfileType.js"

export class YandexTransport {

    private currentDirectory: string
    private directory1C: string
    private sambaClient: SambaClient
    private profile: ProfileType

    constructor(profile: ProfileType) {
        this.profile = profile
        this.currentDirectory = config[this.profile].fileOutput.mainPath
        this.directory1C = config[this.profile].directory1C.mainPath
        this.sambaClient = new SambaClient({
            address: config[this.profile].samba.server,
            username: config[this.profile].samba.user,
            password: config[this.profile].samba.password,
            domain: config[this.profile].samba.domain
        })
    }



    async sendTo1CLocalPath(currentArchive: string | undefined) {
        if (currentArchive) {
            const files: string[] = await fs.readdir(this.currentDirectory)
            if (files.length > 0) {
                files.forEach(async (fileName) => {
                    try {
                        await fs.copy(this.currentDirectory + fileName, this.directory1C + fileName);
                        const exists: boolean = await fs.pathExists(`${this.directory1C}${fileName}`)

                        if (exists) {
                            logger.info(`[YANDEX TRANSPORT] File ${fileName} sended to directory: ${this.directory1C}`);
                            await this.sendToArchive(currentArchive, fileName)
                        }
                    } catch (error: any) {
                        logger.error(`[YANDEX TRANSPORT] Directory ${this.directory1C} not exists or not available`)
                        logger.error(`[YANDEX TRANSPORT] ERROR: ${error.message}`)
                    }
                })
            }

        }
    }

    // async sendTo1CSamba(currentArchive: string | undefined) {
    //     if (currentArchive) {
    //         const files: string[] = await fs.readdir(this.currentDirectory)
    //         if (files.length > 0) {
    //             files.forEach(async (fileName) => {
    //                 try {
    //                     await this.sambaClient.sendFile(this.currentDirectory + fileName, config[this.profile].samba.directory + fileName)
    //                     const exists: boolean = await this.sambaClient.fileExists(config[this.profile].samba.directory + fileName)

    //                     if (exists) {
    //                         logger.info(`[YANDEX TRANSPORT] File ${this.currentDirectory + fileName} sended to directory (SAMBA SERVER:${config[this.profile].samba.server}): ${config[this.profile].samba.directory}`);
    //                         await this.sendToArchive(currentArchive, fileName)
    //                     }
    //                 } catch (error: any) {
    //                     logger.error(`[YANDEX TRANSPORT] Directory (SAMBA SERVER:${config[this.profile].samba.server}) ${config[this.profile].samba.directory} not exists or not available`)
    //                     logger.error(`[YANDEX TRANSPORT] ERROR: ${error.message}`)
    //                 }
    //             })
    //         }

    //     }
    // }


    //  async forceSendTo1CSamba(fileName:string, path:string){
    //     try{
    //         logger.info(`[YANDEX TRANSPORT] file name ${fileName}`)
    //         logger.info(`[YANDEX TRANSPORT] current directory name ${this.currentDirectory}`)
    //         logger.info(`[YANDEX TRANSPORT] current sambaClient directory name ${config[this.profile].samba.directory}`)
    //         await this.sambaClient.sendFile(this.currentDirectory + fileName,config[this.profile].samba.directory + fileName)
    //         const exists:boolean = await this.sambaClient.fileExists(config[this.profile].samba.directory + fileName)

    //         if(exists){
    //            logger.info(`[YANDEX TRANSPORT] File ${path + fileName} sended to directory (SAMBA SERVER:${config[this.profile].samba.server}): ${config[this.profile].samba.directory}`);
    //            this.removeFileFromCurrent(fileName)
    //         }
    //     }catch (error:any) {
    //         logger.error(`[YANDEX TRANSPORT] Directory (SAMBA SERVER:${config[this.profile].samba.server}) ${config[this.profile].samba.directory} not exists or not available`)
    //         logger.error(`[YANDEX TRANSPORT] ERROR: ${error.message}`)
    //     }

    //  }

    async sendTo1CSamba(currentArchive: string | undefined) {
        if (!currentArchive) return;

        const files: string[] = await fs.readdir(this.currentDirectory);

        if (files.length === 0) return;

        const targetDir = this.getRemoteDir();

        await this.ensureRemoteDir(targetDir);

        for (const fileName of files) {
            try {
                const sourcePath = this.currentDirectory + fileName;
                const targetPath = targetDir + fileName;

                await this.sambaClient.sendFile(sourcePath, targetPath);

                const exists = await this.sambaClient.fileExists(targetPath);

                if (exists) {
                    logger.info(
                        `[YANDEX TRANSPORT] File ${sourcePath} sent to (SAMBA SERVER:${config[this.profile].samba.server}): ${targetDir}`
                    );

                    await this.sendToArchive(currentArchive, fileName);
                }

            } catch (error: any) {
                logger.error(
                    `[YANDEX TRANSPORT] SAMBA ERROR: ${config[this.profile].samba.directory}`
                );
                logger.error(error.message);
            }
        }
    }

    async forceSendTo1CSamba(fileName: string, path: string) {
        try {
            const targetDir = this.getRemoteDir();

            logger.info(`[YANDEX TRANSPORT] targetDir ${targetDir}`);

            await this.ensureRemoteDir(targetDir);

            const sourcePath = this.currentDirectory + fileName;
            const targetPath = targetDir + fileName;

            await this.sambaClient.sendFile(sourcePath, targetPath);

            const exists = await this.sambaClient.fileExists(targetPath);

            if (exists) {
                logger.info(
                    `[YANDEX TRANSPORT] File ${path + fileName} sent to (SAMBA SERVER:${config[this.profile].samba.server}): ${targetDir}`
                );
                this.removeFileFromCurrent(fileName);
            }

        } catch (error: any) {
            logger.error(`[YANDEX TRANSPORT] FORCE SEND ERROR`);
            logger.error(error.message);
        }
    }

    private async sendToArchive(currentArchive: string, fileName: string) {

        await fs.copy(this.currentDirectory + fileName, currentArchive + fileName);
        const exists: boolean = await fs.pathExists(`${currentArchive}${fileName}`)
        if (exists) {
            logger.info(`[YANDEX TRANSPORT] File ${fileName} sended to archive directory: ${currentArchive}`);
            await this.removeFileFromCurrent(fileName)
        }

    }

    private async removeFileFromCurrent(fileName: string) {
        await fs.remove(`${this.currentDirectory}${fileName}`)
        const exist: boolean = await fs.pathExists(`${this.currentDirectory}${fileName}`)
        if (!exist) {
            logger.info(`[YANDEX TRANSPORT] File ${fileName} removed from current directory: ${this.currentDirectory}`);
        }
    }

    private async ensureRemoteDir(remoteDir: string): Promise<void> {
        try {
            await this.sambaClient.list(remoteDir);
        } catch {
            logger.info(`[YANDEX TRANSPORT] Creating directory ${remoteDir}`);
            await this.sambaClient.mkdir(remoteDir);
        }
    }

    private getDateFolder(): string {
        const now = new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        return `${year}${month}${day}`;
    }

    private getRemoteDir(): string {
        const baseDir = config[this.profile].samba.directory.replace(/\/?$/, '/');
        return `${baseDir}${this.getDateFolder()}/`;
    }

}