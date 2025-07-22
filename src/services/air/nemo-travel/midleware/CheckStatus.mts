import { NextFunction, Request, Response } from "express"
import { NemoOrder } from "../model/NemoOrder.mjs";
//import {config} from "../config/config.mjs"
import { logger } from "../../../../common/logging/Logger.mjs";
import { number } from "joi";
import config from "../../../../config/air/nemo.json" assert {type: 'json'}
const checkStatus = () => {

    return (req:Request,res:Response,next:NextFunction) => {
        logger.info(`[NEMO CHECK STATUS] Start process checking statuses`)
        const body:NemoOrder = req.body;
        let counter = 1;

        const mapStatus:Map<number,string> = new Map();

        while(body.data.products["ID_FLT_" + counter]){
            logger.trace(`[NEMO CHECK STATUS] Check status : ${JSON.stringify(body.data.products["ID_FLT_" + counter])}`)
            const status:string = body.data.products["ID_FLT_" + counter].info.nemo.status;
            mapStatus.set(counter,status)
            counter++;
        }

        let helperStatus:boolean[] = []
        Array.from(mapStatus.values()).forEach((status,index) => {
              
            helperStatus[index] = config.permitedStatuses.includes(status) 

        }) 

        req.body.containsePermittedStatus = helperStatus.includes(true)
        req.body.allStatuses = mapStatus;

        logger.info(`[NEMO CHECK STATUSES] add statuses ${JSON.stringify(Object.fromEntries(mapStatus.entries()))} to body of request`)
        
        next();
    }
}

export default checkStatus;