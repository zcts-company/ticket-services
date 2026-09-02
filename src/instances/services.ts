import { HotelCache } from "../common/cache/HotelCache.js";
import { Nemo } from "../services/air/nemo-travel/Nemo.js";
import { Travelline } from "../services/hotel/travelline/Travelline.js";
import { TicketService } from "../services/interfaces/TicketService.js";
import { TicketServiceServer } from "../services/interfaces/TicketServiceServer.js";
import travellineConfig from "../config/hotel/travelline.json" with {type: 'json'}
import busMailConfig from "../config/bus/mailbox.json" with {type: 'json'}
import { FileService } from "../common/file-service/FileService.js";
import { FileConverterXml } from "../common/converter/FileConverterXml.js";
import { Traveltech } from "../services/hotel/traveltech/Traveltech.js";
import { Ufs } from "../services/rail/ufs/Ufs.js";
import { Panda } from "../services/hotel/panda/Panda.js";
import { TTBooking } from "../services/air/ttbooking/TTBooking.js";
import { UfsBus } from "../services/rail/ufs-bus/Ufs.js";
import { Yandex } from "../services/taxi/yandex/Yandex.js";
import { BusMailService } from "../services/bus/bus_mail/BusMail.js";
import { MailboxServiceOptions } from "../services/bus/bus_mail/types/MailboxTypes.js";


const busMailOptions: MailboxServiceOptions = busMailConfig


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
export const yandexTaxiZE: TicketService = new Yandex("ZE")
export const yandexTaxiIT: TicketService = new Yandex("IT")

export const busMailService: TicketService = new BusMailService(busMailOptions)
// export const ostrovok:TicketService = new Ostrovok();

//server instances
export const nemoTavelServer: TicketServiceServer = new Nemo();
export const ufsServer: TicketServiceServer = new Ufs()
export const ufsBusServer: TicketServiceServer = new UfsBus()
export const ttBookingServer: TicketServiceServer = new TTBooking()

export const callBackServices: TicketServiceServer[] = [nemoTavelServer, ufsServer, ttBookingServer, ufsBusServer]

export const services: TicketService[] = [traveltechZE, traveltechIT, travellineZE, yandexTaxiZE, yandexTaxiIT, pandaZE, pandaIT, busMailService]
// export const services: TicketService[] = [busMailService]
