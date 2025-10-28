import { HotelCache } from "../common/cache/HotelCache.mjs";
import { Nemo } from "../services/air/nemo-travel/Nemo.mjs";
import { Travelline } from "../services/hotel/travelline/Travelline.mjs";
import { TicketService } from "../services/interfaces/TicketService.mjs";
import { TicketServiceServer } from "../services/interfaces/TicketServiceServer.mjs";
import travellineConfig from "../config/hotel/travelline.json" assert {type: 'json'}
import { FileService } from "../common/file-service/FileService.mjs";
import { FileConverterXml } from "../common/converter/FileConverterXml.mjs";
import { Traveltech } from "../services/hotel/traveltech/Traveltech.mjs";
import { Ufs } from "../services/rail/ufs/Ufs.mjs";
import { Panda } from "../services/hotel/panda/Panda.mjs";
import { TTBooking } from "../services/air/ttbooking/TTBooking.mjs";


//common instances
export const fileService: FileService = new FileService();
export const fileConverterXml: FileConverterXml = new FileConverterXml();

//instances with common interval
export const hotelCacheTravelline: HotelCache = new HotelCache(travellineConfig.ZE.nameProvider);
export const travellineZE: TicketService = new Travelline("ZE");
export const traveltechZE: TicketService = new Traveltech("ZE");
export const traveltechIT: TicketService = new Traveltech("IT")
export const pandaZE: TicketService = new Panda("ZE")
export const pandaIT: TicketService = new Panda("IT")
// export const ostrovok:TicketService = new Ostrovok();

//server instances
export const nemoTavelServer: TicketServiceServer = new Nemo();
export const ufsServer: TicketServiceServer = new Ufs()
export const ttBookingServer: TicketServiceServer = new TTBooking()

export const callBackServices: TicketServiceServer[] = [nemoTavelServer, ufsServer, ttBookingServer]

export const services: TicketService[] = [traveltechZE, traveltechIT, travellineZE, pandaZE, pandaIT]

export const servicesIndividualInterval: TicketService[] = []