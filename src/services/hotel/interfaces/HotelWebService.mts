import { ProfileType } from "../../../common/types/ProfileType";

export interface HotelWebService {

    getOrder(locator:string,profile:ProfileType):Promise<any>;

    getOrders(fromDate:Date, toDate:Date, pageNumber:number, profile:ProfileType):Promise<any>;
    
}