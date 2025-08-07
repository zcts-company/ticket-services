import { ProfileType } from "../../../../common/types/ProfileType";
import { HotelWebService } from "../../interfaces/HotelWebService.mjs";
import { OrderInfoResponse } from "../types/OrderInfoResponse";
import config from "../../../../config/hotel/panda.json" assert {type: 'json'}
import { logger } from "../../../../common/logging/Logger.mjs";
import { fileConverterXml } from "../../../../instances/services.mjs";
import { OrderListResponse } from "../types/OrderListResponse";

export class PandaWebService implements HotelWebService {

    async getOrder(locator: string, profile: ProfileType): Promise<any> {
        let data:OrderInfoResponse|undefined = undefined;
        try {
            const url = `${config[profile].baseUrl}?token=${config[profile].token}&id=${locator}`
            logger.trace(`Get request to ${url}`)
            const response = await fetch(url,{
                method: 'get'
            })
            logger.trace(`Response status: ${response.status}`)
            if(response.status == 200){
                const xml = await response.text();
                data = await fileConverterXml.xmlToJson(xml) as OrderInfoResponse
                logger.trace(`Response body:`)
                logger.trace(data)
            }
       } catch (error) {
            logger.error(`Error request to panda reservation: ${error}`)
       } finally {
            logger.trace(`Return reservation:`)
            logger.trace(data)
            return data
       }   
    }
    
    async getOrders(fromDate: Date, toDate: Date, pageNumber: number, profile: ProfileType): Promise<any> {
        let data:OrderListResponse|undefined = undefined;
        try { fromDate.toLocaleDateString()
            const url = `${config[profile].baseUrl}?token=${config[profile].token}&date1=${this.toDateStr(fromDate)}&date2=${this.toDateStr(toDate)}`
            logger.trace(`Get request to ${url}`)
            const response = await fetch(url,{
                method: 'get'
            })
            logger.trace(`Response status: ${response.status}`)
            if(response.status == 200){
                const xml = await response.text();
                data = await fileConverterXml.xmlToJson(xml) as OrderListResponse
                logger.trace(`Response body:`)
                logger.trace(data)
            }
       } catch (error) {
            logger.error(`Error request to panda list reservations: ${error}`)
       } finally {
            logger.trace(`Return reservations:`)
            logger.trace(data)
            return data
       }  
    }

    toDateStr(date:Date){
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`
    }
    
}