import { Request, Response } from "express";
import { logger } from "../../../../common/logging/Logger.mjs";

export const valid = (req:Request,res:Response,next:any) => {

    if (!req.body) { 
        logger.warn('Not body exists')
        throw 'Not body exists'
    } 

    if (!req.body.validated) {
        logger.warn('Body must be validated')
        throw 'Body must be validated'
    }

    if(req.body.joiError){
        res.status(200); //test был 400
        logger.warn(`Error validate: ${req.body.joiError}`)
        throw req.body.joiError;
    }
    res.status(200);
    logger.info("[NEMO TRAVEL] validation successful");
    
    next();
}

export default valid;