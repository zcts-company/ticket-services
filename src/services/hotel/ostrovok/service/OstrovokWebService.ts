import { HotelWebService } from "../../interfaces/HotelWebService.js";
import { OrderInfoRQ } from "../model/OrderInfoRQ.js";
import { Base64 } from 'js-base64';
import { encode, decode } from 'js-base64';
import config from "../../../../config/hotel/ostrovok.json" with {type: 'json'} 
import { logger } from "../../../../common/logging/Logger.js";
import { OrdersInfoRS } from "../model/OrdersInfoRS.js";
import { HotelInfoRS } from "../model/HotelInfoRS.js";

export class OstrovokWebService implements HotelWebService {
    
    getOrder(locator: string): Promise<any> {
        throw new Error("Method not implemented.");
    }
    
    async getOrders(fromDate: Date, toDate:Date, pageNumber:number): Promise<any> {
        let data:OrdersInfoRS|undefined = undefined;
        const body:OrderInfoRQ = getBody(fromDate, pageNumber)
        let headers = this.getHeaders() 
        const url:string = config.baseUrl + config.ordedInfo;
        logger.info(`POST request to ${url}`)
        try {
            const response = await fetch(url,{
                method:"POST",
                headers:headers,
                body:JSON.stringify(body)
            })
            logger.info(`Response status: ${response.status}`)
            
            if(response.status == 200){
                data = await response.json() as OrdersInfoRS;
            }
        } catch (error) {
            logger.error(`Error request to ostrovok api (url:${url}): ${error}`)
        } finally {
            return data
        }
       
    }

    async getHotelInfo(hotelId:string) {
        let data:HotelInfoRS|undefined = undefined;
        const headers = this.getHeaders()
        const url:string = config.baseUrl + config.hotelInfo + this.getParams(hotelId,"hotelDatails");
        try {
            const response = await fetch(url,{
                method:"GET",
                headers:headers,
            })
            logger.info(`Response status: ${response.status}`)
            
            if(response.status == 200){
                data = await response.json() as HotelInfoRS;
            }
        } catch (error) {
            logger.error(`Error request to ostrovok api (url:${url}): ${error}`)
        } finally {
            return data
        }
    
    }

    private getParams(paramId: string, type: string) {
        switch (type) {
            case "hotelDatails":
                return `?data=${JSON.stringify({id:paramId,language:"ru"})}`        
            default:
                break;
        }
    }


    private getHeaders() {
        
        const headers = new Headers()
        headers.append('Authorization', 'Basic ' + encode(config.auth.current_username + ":" + config.auth.current_password))
        
        return headers
        
    }
    
    getReservation(locator: string): Promise<any> {
        throw new Error("Method not implemented.");
    }
    
}



function getBody(fromDate: Date, pageNumber:number): OrderInfoRQ {
    return {
        ordering: {
            ordering_type:"desc",
            ordering_by:"created_at"
        },
        pagination:{
            page_number:pageNumber.toString(),
            page_size:"10"
        },
        search:{
            created_at:{
                from_date:fromDate.toISOString()
            }
        },
        language:"ru"
    }
}
