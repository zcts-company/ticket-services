import express, { Response } from "express";
import asyncHandler from 'express-async-handler'
import { fileConverterXml, fileService} from "../../../../instances/services.js";
import { logger } from "../../../../common/logging/Logger.js";
import config from "../../../../config/hotel/traveltech.json" with {type: 'json'}
import mainConfig from "../../../../config/main-config.json" with {type: 'json'}
import { TraveltechWebService } from "../web-service/TraveltechWebService.js";
import { TraveltechTransport } from "../transport-service/TraveltechTransport.js";
import { LoadResponse } from "../types/response/LoadResponse.js";
import { nameOfFile } from "../../../../util/fileFunction.js";
import { HandCheckReservation } from "../../../../common/types/HandCheckReservation.js";
import { createHttpError } from "../../../../util/errorFunction.js";
import { ProfileType } from "../../../../common/types/ProfileType.js";

export const loadService = express.Router();
const webService = new TraveltechWebService();


loadService.post('/load',asyncHandler( 
    
    async(req:any, res:Response) => {
    const request: HandCheckReservation = req.body

    if(!request.locator){
        throw createHttpError(400,`Missing 'locator' property in request body`)
    }

    if(!request.profile){
        throw createHttpError(400,`Missing 'profile' property in request body`)
    }

    const transportService:TraveltechTransport = new TraveltechTransport(request.profile);
    
    logger.info(`[TRAVELTECH] Resived post request for hand check reservation file for locator: ${request.locator}`);
        const reservation:LoadResponse|undefined = await webService.getOrder(request.locator,request.profile)
        const updated = new Date();

        if(reservation){
            const path = await createFile(reservation, reservation.result.order.id.toString(), updated, request.profile, transportService);
            res.status(200);
            res.send()
        }
                  
    }
))

async function createFile(reservationData: LoadResponse, key: string, updated: Date, profile:ProfileType, transportService:TraveltechTransport ): Promise<string> {
  try {
    const res: string = fileConverterXml.jsonToXml(reservationData);
    const fileName = nameOfFile(key, updated, config[profile].checkUpdates) + "_hand.xml";
    const path = `${config[profile].fileOutput.mainPath}${fileName}`;

    await fileService.writeFile(path, res);

    logger.info(`[TRAVELTECH] File with name ${fileName}.xml created by hand in directory: ${config[profile].fileOutput.mainPath}`);

    if (mainConfig.main.transport.smbserver) {
      await transportService.forceSendTo1CSamba(fileName, config[profile].fileOutput.mainPath);
    }

    return path;
  } catch (err) {
    logger.error(`[TRAVELTECH] Failed to create or send file: ${(err as Error).message}`);
    throw new Error(`Failed to create or send reservation file: ${(err as Error).message}`);
  }
}


