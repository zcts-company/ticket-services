import fs from "fs-extra"
import SambaClient from 'samba-client'
import { logger } from "../../../../common/logging/Logger.mjs"
import config from "../../../../config/hotel/travelline.json" assert {type: 'json'}
import { ProfileType } from "../../../../common/types/ProfileType"

export class TravellineTransport {

    private currentDirectory:string
    private directory1C:string
    private sambaClient:SambaClient
    private profile:ProfileType
    
    constructor(profile:ProfileType){
        this.profile = profile
        this.currentDirectory = config[this.profile].fileOutput.mainPath
        this.directory1C = config[this.profile].directory1C.mainPath
        this.sambaClient = new SambaClient({
            address:config[this.profile].samba.server,
            username:config[this.profile].samba.user,
            password:config[this.profile].samba.password,
            domain:config[this.profile].samba.domain
        }) 
    }



    async sendTo1CLocalPath(currentArchive:string|undefined){
       if(currentArchive){
            const files: string[] = await fs.readdir(this.currentDirectory)
            if(files.length > 0){
                files.forEach(async (fileName) => {
                    try{
                            await fs.copy(this.currentDirectory + fileName,this.directory1C + fileName);
                            const exists:boolean = await fs.pathExists(`${this.directory1C}${fileName}`)
                
                            if(exists){
                                logger.info(`[TRAVELLINE TRANSPORT] File ${fileName} sended to directory: ${this.directory1C}`);
                                await this.sendToArchive(currentArchive,fileName)
                            }
                    }catch (error:any) {
                        logger.error(`[TRAVELLINE TRANSPORT] Directory ${this.directory1C} not exists or not available`)
                        logger.error(`[TRAVELLINE TRANSPORT] ERROR: ${error.message}`)
                    }
            })
           }
               
       } 
    }

    async sendTo1CSamba(currentArchive:string|undefined){
        if(currentArchive){
             const files: string[] = await fs.readdir(this.currentDirectory)
             if(files.length > 0){
                 files.forEach(async (fileName) => {
                     try{
                             await this.sambaClient.sendFile(this.currentDirectory + fileName,config[this.profile].samba.directory + fileName)
                             const exists:boolean = await this.sambaClient.fileExists(config[this.profile].samba.directory + fileName)
                 
                             if(exists){
                                 logger.info(`[TRAVELLINE TRANSPORT] File ${this.currentDirectory + fileName} sended to directory (SAMBA SERVER:${config[this.profile].samba.server}): ${config[this.profile].samba.directory}`);
                                 await this.sendToArchive(currentArchive,fileName)
                             }
                     }catch (error:any) {
                         logger.error(`[TRAVELLINE TRANSPORT] Directory (SAMBA SERVER:${config[this.profile].samba.server}) ${config[this.profile].samba.directory} not exists or not available`)
                         logger.error(`[TRAVELLINE TRANSPORT] ERROR: ${error.message}`)
                     }
             })
            }
                
        } 
     }


     async forceSendTo1CSamba(fileName:string, path:string){
        try{
            await this.sambaClient.sendFile(this.currentDirectory + fileName,config[this.profile].samba.directory + fileName)
            const exists:boolean = await this.sambaClient.fileExists(config[this.profile].samba.directory + fileName)
                 
            if(exists){
               logger.info(`[TRAVELLINE TRANSPORT] File ${path + fileName} sended to directory (SAMBA SERVER:${config[this.profile].samba.server}): ${config[this.profile].samba.directory}`);
               this.removeFileFromCurrent(fileName)
            }
        }catch (error:any) {
            logger.error(`[TRAVELLINE TRANSPORT] Directory (SAMBA SERVER:${config[this.profile].samba.server}) ${config[this.profile].samba.directory} not exists or not available`)
            logger.error(`[TRAVELLINE TRANSPORT] ERROR: ${error.message}`)
        }

     }

    private async sendToArchive(currentArchive:string,fileName:string){

        await fs.copy(this.currentDirectory + fileName,currentArchive + fileName);
        const exists:boolean = await fs.pathExists(`${currentArchive}${fileName}`)
        if(exists){
            logger.info(`[TRAVELLINE TRANSPORT] File ${fileName} sended to archive directory: ${currentArchive}`);
            await this.removeFileFromCurrent(fileName)
      }

    }

    private async removeFileFromCurrent(fileName:string){
       await fs.remove(`${this.currentDirectory}${fileName}`)
       const exist:boolean = await fs.pathExists(`${this.currentDirectory}${fileName}`)
            if(!exist){
                logger.info(`[TRAVELLINE TRANSPORT] File ${fileName} removed from current directory: ${this.currentDirectory}`);
            }
    }

}