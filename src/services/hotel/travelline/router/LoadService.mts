import express, { Response } from "express";
import { TravellineWebService } from "../web-service/TravellineWebService.mjs";
import { BookingResponse } from "../types/BookingResponse.mjs";
import asyncHandler from 'express-async-handler'
import { TravellineTransport } from "../transport-service/TravellineTransport.mjs";
import { fileConverterXml, fileService} from "../../../../instances/services.mjs";
import { logger } from "../../../../common/logging/Logger.mjs";
import config from "../../../../config/hotel/travelline.json" assert {type: 'json'}
import mainConfig from "../../../../config/main-config.json" assert {type: 'json'}
import { nameOfFile } from "../../../../util/fileFunction.mjs";
import { HandCheckReservation } from "../../../../common/types/HandCheckReservation";
import { createHttpError } from "../../../../util/errorFunction.mjs";
import { ProfileType } from "../../../../common/types/ProfileType";

export const loadService = express.Router();

const webService = new TravellineWebService();


loadService.post('/load',asyncHandler( 
    
    async(req:any, res:Response) => {
    
    const request: HandCheckReservation = req.body
        
    if(!request.locator){
        throw createHttpError(400,`Missing 'locator' property in request body`)
    }

    if(!request.profile){
        throw createHttpError(400,`Missing 'profile' property in request body`)
    }
    
    const transportService:TravellineTransport = new TravellineTransport(request.profile);

    logger.trace(`[TRAVELLINE] Resived post request for hand check reservation file for locator: ${request.locator}`);

    const reservation:BookingResponse|undefined = await webService.getOrder(request.locator,request.profile)
    const updated = new Date();

    if(reservation){
        const path = await createFile(reservation, reservation.booking.number, updated, request.profile, transportService);
        const exist = await fileService.pathExsist(path);
        res.status(200);
        res.send()
 
    }
          
}))


async function createFile(reservationData: BookingResponse, key: string, updated: Date, profile:ProfileType, transportService:TravellineTransport): Promise<string> {
  try {
    const res: string = fileConverterXml.jsonToXml(reservationData);
    const fileName = nameOfFile(key, updated, config[profile].checkUpdates) + "_hand.xml";
    const path = `${config[profile].fileOutput.mainPath}${fileName}`;

    await fileService.writeFile(path, res);

    logger.info(`[TRAVELLINE] File with name ${fileName} created by hand in directory: ${config[profile].fileOutput.mainPath}`);

    if (mainConfig.main.transport.smbserver) {
      await transportService.forceSendTo1CSamba(fileName, config[profile].fileOutput.mainPath);
    }

    return path;
  } catch (err) {
    logger.error(`[TRAVELLINE] Failed to create file: ${err}`);
    throw new Error(`Failed to create reservation file: ${(err as Error).message}`);
  }
}


