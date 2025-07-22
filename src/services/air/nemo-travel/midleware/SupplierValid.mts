import { Request, Response } from "express";
import { logger } from "../../../../common/logging/Logger.mjs";

export const supplierValid = (req:Request,res:Response,next:any) => {

    if (!req.body.allSuppliersPermitted) {
        res.status(200); //test был 400
        let errorMessage = `In Order are available not permitted suppliers`
        if( typeof req.body.suppliers == "object"){
            const allSupliersString:string = JSON.stringify(Object.fromEntries(req.body.suppliers.entries()));
            logger.warn(`[NEMO SUPLIER VALID] In Order are available not permitted suppliers: ${allSupliersString}`)
            errorMessage = errorMessage + ` : ${allSupliersString}`
        }
        throw errorMessage;
    }

    res.status(200);
    logger.info("[NEMO SUPLIER VALID] all suppliers permited");
    
    next();
}

export default supplierValid;