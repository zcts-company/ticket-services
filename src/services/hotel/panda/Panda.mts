import config from "../../../config/hotel/panda.json" assert {type: 'json'}
import { logger } from "../../../common/logging/Logger.mjs";
import { toDateForSQL } from "../../../util/dateFunction.mjs";
import { fileConverterXml, fileService } from "../../../instances/services.mjs";
import { nameOfFile } from "../../../util/fileFunction.mjs";
import { HotelService } from "../interfaces/HotelService.mjs";
import mainConf from "../../../config/main-config.json" assert {type: 'json'}
import { PandaTransport } from "./transport-service/PandaTransport.mjs";
import { ProfileType } from "../../../common/types/ProfileType";
import { HotelWebService } from "../interfaces/HotelWebService.mjs";
import { PandaWebService } from "./web-service/PandaWebService.mjs";
import { DocumentTypePanda, Order, OrderListResponse } from "./types/OrderListResponse";


export class Panda implements HotelService {

    private transportService:PandaTransport
    private webService:HotelWebService  
    private currentDirectory:string
    private arhiveDirectory:string
    private currentArhivePath:string | undefined
    private directory1C:string
    private currentDate:Date;
    private beginCheckDate:Date;
    private profile:ProfileType

    constructor(profile:ProfileType){
        this.profile = profile;
        this.transportService = new PandaTransport(this.profile)
        this.webService = new PandaWebService();   
        this.currentDirectory = config[this.profile].fileOutput.mainPath
        this.arhiveDirectory = config[this.profile].fileArhive.mainPath
        this.directory1C = config[this.profile].directory1C.mainPath
        this.currentDate = new Date() 
        this.beginCheckDate = new Date(this.currentDate.getFullYear(),this.currentDate.getMonth(),this.currentDate.getDate(),0,0,0,1)
        logger.info(`[${config[this.profile].name}] Service created instance and started. Date: ${toDateForSQL(this.currentDate)}`);
    }

    
    async run(dateFrom: Date, dateTo: Date): Promise<void> {
       try {
            this.checkDate(dateFrom)
            logger.trace(`[${this.getServiceName().toUpperCase()}] run iteration for check reservation: from - ${toDateForSQL(dateFrom)} to - ${toDateForSQL(dateTo)}`)  
            
            this.beginCheckDate.setDate(this.currentDate.getDate() - (config[this.profile].countCheckDays))   
            
            logger.trace(`[${this.getServiceName().toUpperCase()}] begin check date setted - ${toDateForSQL(this.beginCheckDate)}`);

            await this.checkDirectories(dateTo)

            const reservations:OrderListResponse = await this.webService.getOrders(dateFrom,dateTo,1,this.profile)   
            
            if(typeof reservations.OrderListResponse.Orders === 'object'){

                    let ordersRaw = reservations.OrderListResponse.Orders.Order;

                    if(!ordersRaw){
                        reservations.OrderListResponse.Orders.Order = []
                    }

                    reservations.OrderListResponse.Orders.Order = Array.isArray(ordersRaw) ? ordersRaw : [ordersRaw]
                    const mapReservation:Map<string,Order> = this.convertToMap(reservations);       

                    this.checkReservation(mapReservation).then((list) => {
                        this.requestToWebService(list)

                        if(mainConf.main.transport.local){
                            this.transportService.sendTo1CLocalPath(this.currentArhivePath)
                        }

                        if(mainConf.main.transport.smbserver){
                            this.transportService.sendTo1CSamba(this.currentArhivePath);
                        }

                    }); 

            }
       } catch (error) {
         logger.error(`[${this.getServiceName().toUpperCase()}] Error executing run: ${error}`);
       }

    }

    private async checkDirectories(dateTo: Date) {
            this.currentArhivePath = `${this.arhiveDirectory}${dateTo.toLocaleDateString().replace(new RegExp('[./]', 'g'),"-")}/`;
            const directoryArhiveExist:boolean = await fileService.pathExsist(this.currentArhivePath);
            const directoryCurrentExist:boolean = await fileService.pathExsist(this.currentDirectory);
            const directory1CExist:boolean = await fileService.pathExsist(this.directory1C);

            if(!directoryArhiveExist){
                await fileService.createDirectory(this.currentArhivePath)
                logger.info(`[${this.getServiceName().toUpperCase()}] Directory created: ${this.currentArhivePath}`);
            }

            if(!directoryCurrentExist){
                await fileService.createDirectory(this.currentDirectory)
                logger.info(`[${this.getServiceName().toUpperCase()}] Directory created: ${this.currentDirectory}`);
            }

            if(!directory1CExist){
                await fileService.createDirectory(this.directory1C)
                logger.info(`[${this.getServiceName().toUpperCase()}] Directory created: ${this.directory1C}`);
            }
    }

    private requestToWebService(listReservation: Map<string, Order>) {
            Array.from(listReservation.keys()).forEach(async (key) => {
                const reservation:Order|undefined = listReservation.get(key);
                if(reservation){
                this.createFile(reservation,key,new Date(reservation.$.Updated))
                        }
            })
    }

    private createFile(reservationData: Order|undefined, key:string, updated:Date) {

       if(reservationData){
            // reservationData.rate.room.description = replaceSymbols(reservationData.rate.room.description)
            // reservationData.hotel.description = replaceSymbols(reservationData.hotel.description)

            const res:string = fileConverterXml.jsonToXml(reservationData);
            const fileName = `${nameOfFile(key, updated, config[this.profile].checkUpdates)}_${reservationData.Status.$.Id}`;
            const path = `${this.currentDirectory}${fileName}.xml`
            fileService.writeFile(path,res).then(() => {     
            logger.info(`[${this.getServiceName().toUpperCase()}] File with name ${fileName}.xml created in directory: ${this.currentDirectory}`);     
        })
       }
    }

    private convertToMap(reservations: OrderListResponse): Map<string, Order> {
            const map = new Map<string, Order>();
            
            if(typeof reservations.OrderListResponse.Orders === 'object'){
                for (const entry of reservations.OrderListResponse.Orders.Order) {
                    const key = String(entry.$.Id);
                    map.set(key, entry);
                }

            }

            return map;     
        }


    private checkDate(dateFrom:Date){
      
        if(this.currentDate < dateFrom){
              logger.info(`[${this.getServiceName().toUpperCase()}] start process change of date ${this.currentDate} `);
              this.currentDate = new Date(dateFrom);
              logger.info(`[${this.getServiceName().toUpperCase()}] Current date setted ${this.currentDate}`);
        }
  
      }

    private async checkReservation(reservations: Map<string, any>) {
        const arrayOfkeys = Array.from(reservations.keys())
        const result: Map<string,any> = new Map();

        for (let index = 0; index < arrayOfkeys.length; index++) {
            const reservation = reservations.get(arrayOfkeys[index])
            const fileName = `${nameOfFile(arrayOfkeys[index],new Date(reservation?.$.Updated), config[this.profile].checkUpdates)}_${reservation.Status.$.Id}`
            
            const validProfile:boolean = this.chekProfileReservation(reservation);
            //validProfile только ИНН заказов которые указаны в конфиге профиля
            if(validProfile){

                const existArchive:boolean = await this.checkAllArchives(this.beginCheckDate,fileName,this.arhiveDirectory);
                const validStatus:boolean = config[this.profile].validStatuses.includes(reservation.Status.$.Id)
                
                //validStatus только статусы заказов которые указаны в конфиге профиля
                if(!existArchive && validStatus){
                    const existCurrent:boolean = await fileService.pathExsist(this.currentDirectory + `${fileName}.xml`)
                    if (!existCurrent) {
                        result.set(arrayOfkeys[index],reservation)
                    }
                }

            }
           
        }

        return result;
    }

        private async checkAllArchives(beginDate:Date,filename:String, mainArchiveDirectory:string):Promise<boolean>{
        let startDate:Date = new Date(beginDate)
        let exist:boolean = false;
        while(startDate <= this.currentDate && !exist){
            try {
                logger.trace(`[${this.getServiceName().toUpperCase()}] start checking exist of file: ${filename}.xml`)
                const archivePath = `${mainArchiveDirectory}${startDate.toLocaleDateString().replace(new RegExp('[./]', 'g'),"-")}/`;
                exist = await fileService.pathExsist(archivePath + `${filename}.xml`);
                if(exist){
                    logger.trace(`[${this.getServiceName().toUpperCase()}] file: ${filename}.xml exist in directory: ${archivePath}`)
                }
                startDate.setDate(startDate.getDate() + 1)
            } catch (error) {
                logger.error(`[${this.getServiceName().toUpperCase()}] ERROR CHECK ARHIVE: ${error}`)
            }
           
        }

        return exist;
    }

    private chekProfileReservation(reservation: Order): boolean {
        const doc:DocumentTypePanda | DocumentTypePanda[] | undefined = reservation.DocumentList.Document
        
        if(doc){
            return Array.isArray(doc) ? config[this.profile].inn === doc[0].$.INN : config[this.profile].inn === doc.$.INN
        }

        return false
    }

    getServiceName() {
        return config[this.profile].name
    }
    
}



