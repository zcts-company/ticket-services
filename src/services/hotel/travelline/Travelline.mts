
import { HotelCache } from "../../../common/cache/HotelCache.mjs";
import { fileConverterXml, fileService, hotelCacheTravelline} from "../../../instances/services.mjs";
import { toDateForSQL } from "../../../util/dateFunction.mjs";
import { HotelServiceDb } from "../../database/HotelServiceDb.mjs";
import { HotelService } from "../interfaces/HotelService.mjs";
import { HotelWebService } from "../interfaces/HotelWebService.mjs";
import { TravellineTransport } from "./transport-service/TravellineTransport.mjs";
import { BookingResponse } from "./types/BookingResponse.mjs";
import { TravellineWebService } from "./web-service/TravellineWebService.mjs";
import { logger } from "../../../common/logging/Logger.mjs";
import config from "../../../config/hotel/travelline.json" assert {type: 'json'}
import mainConf from "../../../config/main-config.json" assert {type: 'json'}
import { nameOfFile } from "../../../util/fileFunction.mjs";
import { replaceSymbols } from "../../../util/stringFunction.mjs";
import { ProfileType } from "../../../common/types/ProfileType";

export class Travelline implements HotelService{

    private database:HotelServiceDb
    private webService:HotelWebService
    private transportService:TravellineTransport;
    private currentDirectory:string
    private arhiveDirectory:string
    private currentArhivePath:string | undefined
    private directory1C:string
    private currentDate:Date;
    private beginCheckDate:Date;
    private profile:ProfileType;

    constructor(profile:ProfileType){
        this.profile = profile
        this.database = new HotelServiceDb(config[this.profile].database.orders,hotelCacheTravelline,config[this.profile].checkUpdates);
        this.webService = new TravellineWebService();
        this.transportService = new TravellineTransport(profile)
        this.currentDirectory = config[this.profile].fileOutput.mainPath
        this.arhiveDirectory = config[this.profile].fileArhive.mainPath
        this.directory1C = config[this.profile].directory1C.mainPath
        this.currentDate = new Date() 
        this.beginCheckDate = new Date(this.currentDate.getFullYear(),this.currentDate.getMonth(),this.currentDate.getDate(),0,0,0,1)
        logger.info(`[TRAVELLINE] Service ${config[this.profile].name} created instance and started. Date: ${toDateForSQL(this.currentDate)}`);
    }

    getServiceName() {
        return config[this.profile].name
    }


    async run(dateFrom: Date, dateTo: Date):Promise<void> {
        this.checkDate(dateFrom)
            logger.trace(`[${this.getServiceName().toUpperCase()}] run iteration for check reservation: from - ${toDateForSQL(dateFrom)} to - ${toDateForSQL(dateTo)}`)  
        
        // this.beginCheckDate.setDate(this.currentDate.getDate())   
        
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
        
        const reservationFromBase:HotelCache = await this.database.getReservationsByDate(this.beginCheckDate,dateTo);
        this.checkReservation(reservationFromBase.getCache(),this.beginCheckDate,this.arhiveDirectory,this.currentDirectory).then((list) => {
            this.requestToWebService(list)

            if(mainConf.main.transport.local){
                this.transportService.sendTo1CLocalPath(this.currentArhivePath)
            }

            if(mainConf.main.transport.smbserver){
                this.transportService.sendTo1CSamba(this.currentArhivePath);
            }

        });
        
    }

    private checkDate(dateFrom:Date){
      
        if(this.currentDate < dateFrom){
              logger.info(`[${this.getServiceName().toUpperCase()}] start process of cleared cache of date ${this.currentDate} `);
              hotelCacheTravelline.clearCache()
              logger.info(`[${this.getServiceName().toUpperCase()}] Cache of date ${this.currentDate} cleared`);
              logger.info(`[${this.getServiceName().toUpperCase()}] rows in cache: ${Array.from(hotelCacheTravelline.getCache().keys())}`);

              this.currentDate = new Date(dateFrom);
              logger.info(`[${this.getServiceName().toUpperCase()}] Current date of cache setted ${this.currentDate}`);
        }
  
      }


    requestToWebService(listReservation: Map<string, any>) {
        Array.from(listReservation.keys()).forEach(async (key) => {
            const reservation:any = listReservation.get(key);
            const locator:string = reservation.reservation.locator;
            const reservationData:BookingResponse = await this.webService.getOrder(locator,this.profile);
            await this.createFile(reservationData,key,reservation.updated)
        })
    }


     private async createFile(reservationData: BookingResponse, key:string, updated:Date) {
        
        for (let index = 0; index < reservationData.booking.roomStays.length; index++) {
            
            if(reservationData.booking.roomStays[index].ratePlan.description){
                reservationData.booking.roomStays[index].ratePlan.description = replaceSymbols(reservationData.booking.roomStays[index].ratePlan.description)
            }
                
        }

        const res:string = fileConverterXml.jsonToXml(reservationData);
        const fileName = nameOfFile(key,updated,config[this.profile].checkUpdates);
        const path = `${this.currentDirectory}${fileName}.xml`
        await fileService.writeFile(path, res);
        logger.info(`[${this.getServiceName().toUpperCase()}] File ${fileName}.xml created`);
    }


     private async checkReservation(reservationFromBase: Map<string,any>,beginCheckDate:Date,arhiveDirectory:string, currentDirectory:string) {
        const arrayOfkeys = Array.from(reservationFromBase.keys())
        const result: Map<string,any> = new Map();

        for (let index = 0; index < arrayOfkeys.length; index++) {
            const reservation = reservationFromBase.get(arrayOfkeys[index])
            const fileName = nameOfFile(arrayOfkeys[index],reservation.updated, config[this.profile].checkUpdates)
            const existArchive:boolean = await this.checkAllArchives(beginCheckDate,fileName,arhiveDirectory);

            if(!existArchive){
                const existCurrent:boolean = await fileService.pathExsist(currentDirectory + `${fileName}.xml`)
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
                logger.error(`[${this.getServiceName().toUpperCase()}] ERROR CHECK ARCHIVE: ${error}`)
            }
           
        }

        return exist;
    }

  
}