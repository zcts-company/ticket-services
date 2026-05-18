import { HotelWebService } from "../../interfaces/HotelWebService.js"
import { BookingResponse } from "../types/BookingResponse.js"
import { logger } from "../../../../common/logging/Logger.js";
import config from "../../../../config/hotel/travelline.json" with {type: 'json'}
import { ProfileType } from "../../../../common/types/ProfileType.js";
export class TravellineWebService implements HotelWebService {
    
    constructor() {
        
    }
    
    getOrders(fromDate: Date, toDate: Date, pageNumber: number, profile:ProfileType): Promise<any> {
        throw new Error("Method not implemented.");
    }

    async getOrder(locator:string, profile:ProfileType): Promise<BookingResponse|undefined>{
        let data:BookingResponse|undefined = undefined;
        try {
            const url = `${config[profile].baseUrl}${config[profile].reseration}${locator}`
            logger.info(`Get request to ${url}`)
            const response = await fetch(url,{
                method: 'get',
                headers: {'X-API-KEY':config[profile].apiKey}
            })
            logger.info(`Response status: ${response.status}`)
            if(response.status == 200){
                data = await response.json() as BookingResponse;
                logger.info(`Response body:`)
                logger.info(data)
            }
       } catch (error) {
            logger.error(`Error request to travelline reservation: ${error}`)
       } finally {
            logger.info(`Return reservation:`)
            logger.info(data)
            return data
       }    

     }

}