import { HotelService } from "../interfaces/HotelService.mjs";
import config from "../../../config/hotel/ostrovok.json" assert {type:'json'};
import {logger} from "../../../common/logging/Logger.mjs"
import { toDateForSQL } from "../../../util/dateFunction.mjs";
import { FileService } from "../../../common/file-service/FileService.mjs";
import { fileService } from "../../../instances/services.mjs";
import { HotelWebService } from "../interfaces/HotelWebService.mjs";
import { OstrovokWebService } from "./service/OstrovokWebService.mjs";
import { OrdersInfoRS } from "./model/OrdersInfoRS";

export class Ostrovok implements HotelService{
    
    private currentDate:Date;
    private beginCheckDate:Date;
    private currentDirectory:string
    private arhiveDirectory:string
    private currentArhivePath:string | undefined
    private directory1C:string
    private webService:HotelWebService

    constructor(){
        const now:Date = new Date();
        this.currentDate = now; 
        this.currentDirectory = config.fileOutput.mainPath
        this.arhiveDirectory = config.fileArhive.mainPath
        this.directory1C = config.directory1C.mainPath
        this.webService = new OstrovokWebService();
        this.beginCheckDate = new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,1)
        logger.info(`[OSTROVOK] Service ${config.name} created instance and started. Date: ${toDateForSQL(this.currentDate)}`);
    }

    async run(dateFrom: Date, dateTo: Date):Promise<void> {
        this.beginCheckDate.setDate(dateFrom.getDate() - config.countCheckDays);
        logger.info("[OSTROVOK] run iteration for check reservation: from - " +  toDateForSQL(dateFrom) + " to - " + toDateForSQL(dateTo))
        logger.info("[OSTROVOK] begin check date setted - " +  toDateForSQL(this.beginCheckDate));
        this.currentArhivePath = `${this.arhiveDirectory}${dateTo.toLocaleDateString().replace(new RegExp('[./]', 'g'),"-")}/`;
        const directoryArhiveExist:boolean = await fileService.pathExsist(this.currentArhivePath);
        const directoryCurrentExist:boolean = await fileService.pathExsist(this.currentDirectory);
        const directory1CExist:boolean = await fileService.pathExsist(this.directory1C);

        if(!directoryArhiveExist){
            await fileService.createDirectory(this.currentArhivePath)
            logger.info(`[OSTROVOK] Directory created: ${this.currentArhivePath}`);
        }

        if(!directoryCurrentExist){
            await fileService.createDirectory(this.currentDirectory)
            logger.info(`[OSTROVOK] Directory created: ${this.currentDirectory}`);
        }

        if(!directory1CExist){
            await fileService.createDirectory(this.directory1C)
            logger.info(`[OSTROVOK] Directory created: ${this.directory1C}`);
        }

        const orders:OrdersInfoRS = await this.webService.getOrders(dateFrom,dateTo,1,"ZE")
        await printOrdders(orders)
        
    }

    getServiceName(): string {
        return config.name;
    }
    
}

async function printOrdders(orders: OrdersInfoRS) {
    orders.data.orders.forEach(order => {
        logger.info(`InvoiceID of order: ${order.order_id} - ${order.invoice_id}`);
        
    })
}
