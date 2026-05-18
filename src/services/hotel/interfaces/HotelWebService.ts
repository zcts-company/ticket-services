import { ProfileType } from "../../../common/types/ProfileType.js";

export interface HotelWebService {

    getOrder(locator:string,profile:ProfileType):Promise<any>;

    getOrders(fromDate:Date, toDate:Date, pageNumber:number, profile:ProfileType):Promise<any>;
    
}