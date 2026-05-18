import { ProfileType } from "../../../common/types/ProfileType.js";

export interface TaxiWebService {

    getOrder(locator:string,profile:ProfileType):Promise<any>;

    getOrders(fromDate:Date, toDate:Date, pageNumber:number, profile:ProfileType):Promise<any>;

    getUserData(userId:string, profile:ProfileType):Promise<any>;
    
}