import { Request, Response } from "express";
import { logger } from "../../../../common/logging/Logger.mjs";

export const statusValid = (req:Request,res:Response,next:any) => {

    if (!req.body.containsePermittedStatus) {
        res.status(200);
        let errorMessage = `Order not have permitted statuses`
        if( typeof req.body.allStatuses == "object"){
            const allStatusesString:string = JSON.stringify(Object.fromEntries(req.body.allStatuses.entries()));
            logger.warn(`[NEMO STATUS VALID] Order not have permitted statuses: ${allStatusesString}`)
            errorMessage = errorMessage + ` : ${allStatusesString}`
        }
        throw errorMessage;
    }

    res.status(200);
    logger.info("[NEMO STATUS VALID] order containse permitted status");
    
    next();
}

export default statusValid;