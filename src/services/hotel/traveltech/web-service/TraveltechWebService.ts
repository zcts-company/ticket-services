import { HotelWebService } from "../../interfaces/HotelWebService.js";
import { LoadRequest } from "../types/LoadRequest.js";
import config from "../../../../config/hotel/traveltech.json" with {type: 'json'}
import { LoadResponse } from "../types/response/LoadResponse.js";
import { logger } from "../../../../common/logging/Logger.js";
import { LoadListRequest } from "../types/LoadListRequest.js";
import { ListResponse } from "../types/response_list/ListResponse.js";
import { ProfileType } from "../../../../common/types/ProfileType.js";
import { toIsoStringLocalDate } from "../../../../util/dateFunction.js";


export class TraveltechWebService implements HotelWebService {


    async getOrder(locator:string, profile:ProfileType): Promise<LoadResponse|undefined>{
        let data:LoadResponse|undefined = undefined;
        try {
            const url = `${config[profile].baseUrl}${config[profile].reseration}`
            logger.info(`Get request to ${url}`)

            const request:LoadRequest = {
                                            lang:"ru",
                                            id:Number(locator)
                                        }

            const response = await fetch(url, {
                    method:'POST',
                    headers:{
                        'x-auth':config[profile].apiKey,
                        'Content-Type':'application/json'
                    },
                    body:JSON.stringify(request)
                })
            logger.info(`Response status: ${response.status}`)
            if(response.status == 200){
                data = await response.json() as LoadResponse;
                logger.info(`Response body:`)
                logger.info(data)
            }
       } catch (error) {
            logger.error(`Error request to traveltech reservation: ${error}`)
       } finally {
            logger.info(`Return reservation:`)
            logger.info(data)
            return data
       }    

     }

    async getOrders(fromDate: Date, toDate: Date, pageNumber: number, profile:ProfileType): Promise<any> {
            let data:ListResponse = this.getEmptyListResponce();
        try {
            const url = `${config[profile].baseUrl}${config[profile].reserationList}`
            logger.trace(`Get request to ${url}`)

            const request:LoadListRequest = {
                    lang:"ru",
                    createdFrom: toIsoStringLocalDate(fromDate),
                    createdTo:toIsoStringLocalDate(toDate),
                    pageNumber:pageNumber,
                    pageSize:50
            }

            const response = await fetch(url, {
                    method:'POST',
                    headers:{
                        'x-auth':config[profile].apiKey,
                        'Content-Type':'application/json'
                    },
                    body:JSON.stringify(request)
                })
            logger.trace(`Response status: ${response.status}`)
            if(response.status == 200){
                data = await response.json() as ListResponse;
                logger.trace(data)
            }
       } catch (error) {
            logger.error(`Error request to traveltech reservation: ${error}`)
       } finally {
            logger.trace(`Return reservations:`)
            logger.trace(data)
            return data
       } 
    }

    getEmptyListResponce():ListResponse{
        
        return {
            result:{
                orders:[],
                page:1,
                size:50,
                total:0
            },
            errors:[]
        }
    }
    
}