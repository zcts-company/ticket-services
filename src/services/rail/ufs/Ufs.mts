import { FileService } from "../../../common/file-service/FileService.mjs";
import { fileService} from "../../../instances/services.mjs";
import { logger } from "../../../common/logging/Logger.mjs";
import config from "../../../config/rail/ufs.json" assert {type: 'json'}
import mainConf from "../../../config/main-config.json" assert {type: 'json'}
import { RailServiceServer } from "../interfaces/RailServiceServer";
import { UFSTransport } from "./transport/UFSTransport.mjs";

export class Ufs implements RailServiceServer {
    
    private fileService:FileService;
    private archiveDirectory:string;
    private currentDirectory:string;
    private currentArchiveDirectory:string;
    private directory1C:string;
    private transport:UFSTransport;

    constructor(){
        this.transport = new UFSTransport()
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
            logger.info(`[UFS] Directory created: ${this.archiveDirectory}`);
        }

        if(!directoryCurrentExist){
            await this.fileService.createDirectory(this.currentDirectory)
            logger.info(`[UFS] Directory created: ${this.currentDirectory}`);
        }

        if(!directory1CExist){
            await this.fileService.createDirectory(this.directory1C)
            logger.info(`[UFS] Directory created: ${this.directory1C}`);
        }
          
        setInterval(() => {
            logger.trace(`[UFS] Step transport service of nemo travel`);

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
        logger.info(`[UFS] Server recived date from archive path: ${date.toLocaleDateString()}`);
        this.currentArchiveDirectory = `${config.fileArhive.mainPath}${date.toLocaleDateString().replace(new RegExp('[./]', 'g'),"-")}/`;
        logger.info(`[UFS] Cerrent archive path setted: ${this.currentArchiveDirectory}`);
        
        const directoryArhiveExist:boolean = await this.fileService.pathExsist(this.currentArchiveDirectory);
        
        if(!directoryArhiveExist){
            await this.fileService.createDirectory(this.currentArchiveDirectory)
            logger.info(`[UFS] Directory created by server methods: ${this.currentArchiveDirectory}`);
        }
    
    }
      
}