import { FileService } from "../../../common/file-service/FileService.js";
import { fileService} from "../../../instances/services.js";
import { logger } from "../../../common/logging/Logger.js";
import config from "../../../config/rail/smart_travel.json" with {type: 'json'}
import mainConf from "../../../config/main-config.json" with {type: 'json'}
import { RailServiceServer } from "../interfaces/RailServiceServer.js";
import { SmartTravelTransport } from "./transport/SmartTravelTransport.js";

export class SmartTravel implements RailServiceServer {
    
    private fileService:FileService;
    private archiveDirectory:string;
    private currentDirectory:string;
    private currentArchiveDirectory:string;
    private directory1C:string;
    private transport:SmartTravelTransport;

    constructor(){
        this.transport = new SmartTravelTransport()
        this.fileService = fileService;
        this.currentDirectory = config.fileOutput.mainPath
        this.archiveDirectory = config.fileArhive.mainPath
        this.directory1C = config.directory1C.mainPath
        this.currentArchiveDirectory = `${config.fileArhive.mainPath}${new Date().toLocaleDateString().replace(new RegExp('[./]', 'g'),"-")}/`;
    }

    getServiceName(): string {
        return config.nameService
    }
    
    async startServer(): Promise<void> {
        const directoryArhiveExist:boolean = await this.fileService.pathExsist(this.archiveDirectory);
        const directoryCurrentExist:boolean = await this.fileService.pathExsist(this.currentDirectory);
        const directory1CExist:boolean = await this.fileService.pathExsist(this.directory1C);

        if(!directoryArhiveExist){
            await this.fileService.createDirectory(this.archiveDirectory)
            logger.info(`[SmartTravel] Directory created: ${this.archiveDirectory}`);
        }

        if(!directoryCurrentExist){
            await this.fileService.createDirectory(this.currentDirectory)
            logger.info(`[SmartTravel] Directory created: ${this.currentDirectory}`);
        }

        if(!directory1CExist){
            await this.fileService.createDirectory(this.directory1C)
            logger.info(`[SmartTravel] Directory created: ${this.directory1C}`);
        }
          
        setInterval(() => {
            logger.trace(`[SmartTravel] Step transport service of smart_travel service`);

            if(mainConf.main.transport.local){
                this.transport.sendTo1C(this.currentArchiveDirectory)
            }

            if(mainConf.main.transport.smbserver){
                this.transport.sendTo1CSamba(this.currentArchiveDirectory)
            }
            
        },config.intervalSending * 1000)
        
    }   

     public async setCurrentArchiveDirectory(date:Date):Promise<void>{      
        // for tests
        // dateFrom = new Date(2024,4,15,0,0,0,1)
        // dateTo = new Date(2024,4,15,23,59,59,0)
        logger.info(`[SmartTravel] Server recived date from archive path: ${date.toLocaleDateString()}`);
        this.currentArchiveDirectory = `${config.fileArhive.mainPath}${date.toLocaleDateString().replace(new RegExp('[./]', 'g'),"-")}/`;
        logger.info(`[SmartTravel] Cerrent archive path setted: ${this.currentArchiveDirectory}`);
        
        const directoryArhiveExist:boolean = await this.fileService.pathExsist(this.currentArchiveDirectory);
        
        if(!directoryArhiveExist){
            await this.fileService.createDirectory(this.currentArchiveDirectory)
            logger.info(`[SmartTravel] Directory created by server methods: ${this.currentArchiveDirectory}`);
        }
    
    }
      
}