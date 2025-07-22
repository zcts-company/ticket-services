import express, { Request, Response } from "express";
import asyncHandler from 'express-async-handler'
import auth from "../midleware/Authentification.mjs";
import { NemoOrder } from "../model/NemoOrder.mjs";
import { validation } from "../../../../common/validation/validation.mjs";
import { nemoOrder } from "../shemas/NemoOrder.mjs";
import valid from "../midleware/valid.mjs";
import { fileConverterXml, fileService} from "../../../../instances/services.mjs";
import { logger } from "../../../../common/logging/Logger.mjs";
import checkSuppliers from "../midleware/CheckSuppliers.mjs";
import supplierValid from "../midleware/SupplierValid.mjs";
import checkStatus from "../midleware/CheckStatus.mjs";
import statusValid from "../midleware/StatusValid.mjs";
import config from "../../../../config/air/nemo.json" assert {type: 'json'}
import { nameOfFile } from "../../../../util/fileFunction.mjs";
export const callback = express.Router();

const currentDirectory = config.fileOutput.mainPath

callback.use(validation(nemoOrder));
callback.use(checkSuppliers());
callback.use(checkStatus());

callback.use('',asyncHandler(
    async (req:any,res:Response,next) => {
        logger.info(`[NEMO TRAVEL] Check current archive path, path of service: ${req.currentArchivePath}`)
    if(req.currentArchivePath){
        
        const directoryArhiveExist:boolean = await fileService.pathExsist(req.currentArchivePath);
        
        if(!directoryArhiveExist){
            await fileService.createDirectory(req.currentArchivePath)
            logger.info(`[NEMO TRAVEL] Directory created by middlware of service: ${req.currentArchivePath}`);
        }
    } else {
        logger.error(`[NEMO TRAVEL] Imposible created directory: ${req.currentArchivePath}`);
    }
        
        next()
    }
))

callback.post('/callback',auth(),valid,supplierValid,statusValid,asyncHandler(async(req:any, res:Response) => {

   logger.trace(`[NEMO TRAVEL] Resived post request for create reservation file: ${JSON.stringify(req.body)}`);

   try {
    const updated = new Date(req.body.data.lastModifiedDate);
    const fileName = nameOfFile(req.body.params.id.toString(),updated,config.checkUpdates);
    const existToCurrentArchive = await fileService.pathExsist(`${req.currentArchivePath}${fileName}`);
    const existToCurrent = await fileService.pathExsist(`${currentDirectory}${fileName}`);

            if(!existToCurrentArchive){
                
                if(!existToCurrent){
                    const path = await createFile(req.body, res);
                    await fileService.pathExsist(path);
                    res.status(200);
                    res.send() 
                    logger.info(`[NEMO TRAVEL] send response to nemo server ${res.statusCode}`);
                    
                } else {
                    logger.warn(`[NEMO TRAVEL] file with name ${fileName} exists in directory ${currentDirectory}`);
                    res.status(200);
                    res.send({fileExistsToCerrent:existToCurrent})
                }

            } else {
                logger.warn(`[NEMO TRAVEL] file with name ${fileName} exists in directory ${req.currentArchivePath}`);
                res.status(200);
                res.send({fileExistsToArchive:existToCurrentArchive})
            }
           
   } catch (error) {
        res.status(500);
        logger.error(`[NEMO TRAVEL] send response to nemo server ${res.statusCode}`);
        res.send()
   }
  
}))


async function createFile(order: NemoOrder, response: Response): Promise<string> {
  try {
    const res: string = fileConverterXml.jsonToXml(order);
    const updated = new Date(order.data.lastModifiedDate);
    const fileName = nameOfFile(order.params.id.toString(), updated, config.checkUpdates);
    const path = `${currentDirectory}${fileName}.xml`;

    await fileService.writeFile(path, res);

    logger.info(`[NEMO TRAVEL] File with name ${fileName}.xml created in directory: ${currentDirectory}`);

    return path;
  } catch (err) {
    logger.error(`[NEMO TRAVEL] Failed to create file: ${(err as Error).message}`);
    throw new Error(`Failed to create Nemo XML file: ${(err as Error).message}`);
  }
}


