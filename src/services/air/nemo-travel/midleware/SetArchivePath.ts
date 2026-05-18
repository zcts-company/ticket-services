import { logger } from "../../../../common/logging/Logger.js";


const setArchivePath = (path:string) => {

    return (req:any,res:any,next:any) => {
       
        req.currentArchivePath = path;
        
        logger.info(`Set archive path for Nemo service: ${req.currentArchivePath}`);
        
        next()
    }
}

export default setArchivePath