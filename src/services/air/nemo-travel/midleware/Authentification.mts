import { NextFunction, Request } from "express";
import { BEARER } from "../../../../common/constants/constant.mjs";
import { logger } from "../../../../common/logging/Logger.mjs";



const auth = () => {

    return (req:Request,res:any,next:any) => {
        logger.info('Request from NemoBackOffice. Middleware autorization')
        logger.warn("Autorization not implemented")
        logger.warn(req.header('Authorization'))
        // const authHeader = req.header('Authorization');
        // if(authHeader && authHeader.startsWith(BEARER)){
        //     const accessToken = authHeader.substring(BEARER.length);
        //     try {
        //         const payload = Jwt.verify(accessToken,process.env[config.get(ENV_JWT_SECRET)]);
        //         req.user = {username: payload.sub, roles:payload.roles};
        //     } catch (error) {
                
        //     }
        // }
        next()
    }
}
    

export default auth;