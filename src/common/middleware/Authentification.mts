import { BEARER } from "../constants/constant.mjs";
import { logger } from "../logging/Logger.mjs";


const auth = () => {

    return (req:any,res:any,next:any) => {
        logger.info('Request from BackOffice. Middleware autorization')
        logger.warn("Autorization not implemented")
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