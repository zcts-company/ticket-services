import config from "../../../config/hotel/traveltech.json" assert {type: 'json'}
import { logger } from "../../../common/logging/Logger.mjs";
import { toDateForSQL } from "../../../util/dateFunction.mjs";
import { fileConverterXml, fileService } from "../../../instances/services.mjs";
import { nameOfFile } from "../../../util/fileFunction.mjs";
import { HotelService } from "../interfaces/HotelService.mjs";
import { replaceSymbols } from "../../../util/stringFunction.mjs";
import { TraveltechWebService } from "./web-service/TraveltechWebService.mjs";
import { HotelWebService } from "../interfaces/HotelWebService.mjs";
import { ListResponse, OrderEntry } from "./types/response_list/ListResponse";
import mainConf from "../../../config/main-config.json" assert {type: 'json'}
import { TraveltechTransport } from "./transport-service/TraveltechTransport.mjs";
import { ProfileType } from "../../../common/types/ProfileType";


export class Traveltech implements HotelService{

    private transportService:TraveltechTransport
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
        this.transportService = new TraveltechTransport(this.profile)
        this.webService = new TraveltechWebService();   
        this.currentDirectory = config[this.profile].fileOutput.mainPath
        this.arhiveDirectory = config[this.profile].fileArhive.mainPath
        this.directory1C = config[this.profile].directory1C.mainPath
        this.currentDate = new Date() 
        this.beginCheckDate = new Date(this.currentDate.getFullYear(),this.currentDate.getMonth(),this.currentDate.getDate(),0,0,0,1)
        logger.info(`[${config[this.profile].name}] Service created instance and started. Date: ${toDateForSQL(this.currentDate)}`);
    }

    getServiceName() {
        return config[this.profile].name
    }


    async run(dateFrom: Date, dateTo: Date):Promise<void> {
        this.checkDate(dateFrom)
            logger.trace(`[${this.getServiceName().toUpperCase()}] run iteration for check reservation: from - ${toDateForSQL(dateFrom)} to - ${toDateForSQL(dateTo)}`)  
        
        // this.beginCheckDate.setDate(this.currentDate.getDate() - (config[this.profile].countCheckDays))   
        
        logger.trace(`[${this.getServiceName().toUpperCase()}] begin check date setted - ${toDateForSQL(this.beginCheckDate)}`);

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

        const reservations:ListResponse = await this.webService.getOrders(dateFrom,dateTo,1,this.profile)
        const mapReservation:Map<string,OrderEntry> = this.convertToMap(reservations);

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

    convertToMap(reservations: ListResponse): Map<string, OrderEntry> {
        const map = new Map<string, OrderEntry>();
        
            for (const entry of reservations.result.orders) {
                const key = String(entry.order.id);
                map.set(key, entry);
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

    requestToWebService(listReservation: Map<string, OrderEntry>) {
              Array.from(listReservation.keys()).forEach(async (key) => {
                  const reservation:OrderEntry|undefined = listReservation.get(key);
                  if(reservation){
                    this.createFile(reservation,key,new Date(reservation.order.dateChanged))
                  }
              })
    }


    private createFile(reservationData: OrderEntry|undefined, key:string, updated:Date) {

       if(reservationData){
            reservationData.rate.room.description = replaceSymbols(reservationData.rate.room.description)
            reservationData.hotel.description = replaceSymbols(reservationData.hotel.description)

            const res:string = fileConverterXml.jsonToXml(reservationData);
            const fileName = nameOfFile(key, updated, config[this.profile].checkUpdates);
            const path = `${this.currentDirectory}${fileName}.xml`
            fileService.writeFile(path,res).then(() => {     
                logger.info(`[${this.getServiceName().toUpperCase()}] File with name ${fileName}.xml created in directory: ${this.currentDirectory}`);     
        })
       }
    }


     private async checkReservation(reservations: Map<string,any>) {
        const arrayOfkeys = Array.from(reservations.keys())
        const result: Map<string,any> = new Map();

        for (let index = 0; index < arrayOfkeys.length; index++) {
            const reservation = reservations.get(arrayOfkeys[index])
            const fileName = nameOfFile(arrayOfkeys[index],reservation.updated, config[this.profile].checkUpdates)
            const existArchive:boolean = await this.checkAllArchives(this.beginCheckDate,fileName,this.arhiveDirectory);

            if(!existArchive){
                const existCurrent:boolean = await fileService.pathExsist(this.currentDirectory + `${fileName}.xml`)
                if (!existCurrent) {
                    result.set(arrayOfkeys[index],reservation)
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
   
}
