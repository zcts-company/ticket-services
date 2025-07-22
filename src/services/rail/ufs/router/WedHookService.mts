import express, { Response } from "express";
import asyncHandler from 'express-async-handler'
import { fileConverterXml, fileService} from "../../../../instances/services.mjs";
import { logger } from "../../../../common/logging/Logger.mjs";
import config from "../../../../config/rail/ufs.json" assert {type: 'json'}
import mainConfig from "../../../../config/main-config.json" assert {type: 'json'}
import { nameOfFile } from "../../../../util/fileFunction.mjs";
import getRawBody from "raw-body";
import { UFSOrder } from "../types/UFSOrder";
import { UFSTransport } from "../transport/UFSTransport.mjs";
import { createHttpError } from "../../../../util/errorFunction.mjs";

export const webHookService = express.Router();

const transportService:UFSTransport = new UFSTransport();
const currentDirectory = config.fileOutput.mainPath

webHookService.post('/web-hook-load',asyncHandler( 
    async(req:any, res:Response) => {
        logger.info(`[UFS] Resived post request for webhook`);

        if(req.headers['content-type'] != "application/xml"){
            logger.error(`Unsupported Media Type. Expected application/xml. In request - ${req.headers['content-type']}`)
            throw createHttpError(415, `Unsupported Media Type. Expected application/xml. In request - ${req.headers['content-type']}`);
        }

        const xml = await getRawBody(req, {encoding: 'utf-8'})
        const order = await fileConverterXml.xmlToJson(xml) as UFSOrder;

        if(!order.UFS_RZhD_Gate){
            logger.error(`Missing 'UFS_RZhD_Gate' property in request body`)
            throw createHttpError(415,`Missing 'UFS_RZhD_Gate' property in request body`)
        }
                    
        const updated = new Date();

        if(order.UFS_RZhD_Gate.OperationInfo){
            const path = await createFile(order, order.UFS_RZhD_Gate.OperationInfo.idzakaz, updated);
            res.status(200);
            res.send()
        } else {
            logger.error(`Missing 'OperationInfo' property in request body`)
            throw createHttpError(400,`Missing 'OperationInfo' property in request body`)
        }
                  
    }
))

async function createFile(reservationData: UFSOrder, key:string, updated:Date) {
    const res:string = fileConverterXml.jsonToXml(reservationData);
    const fileName = nameOfFile(key, updated, config.checkUpdates) + "_hook.xml";
    const path = `${currentDirectory}${fileName}`
    fileService.writeFile(path,res).then(() => {
        
        logger.info(`[UFS WEB HOOK] File with name ${fileName}.xml created by hand in directory: ${currentDirectory}`);

    })

    return path;
}



