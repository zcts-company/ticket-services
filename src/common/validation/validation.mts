import { NextFunction, Request, Response } from "express";
import { logger } from "../logging/Logger.mjs";

export function validation(schema:any){

    return (req:Request,res:Response,next:NextFunction) => {

        if(schema && req.body) {
            logger.info(`[VALIDATION] request object ${JSON.stringify(req.body)}`)
            const {error} = schema.validate(req.body);
            req.body.validated = true;
            if(error){
                req.body.joiError = error.details[0].message;
            }   
        }
        next();
    }
}