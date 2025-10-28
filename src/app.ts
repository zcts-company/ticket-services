import { callBackServices, fileService, nemoTavelServer, services, servicesIndividualInterval } from "./instances/services.mjs";
import { TicketService } from "./services/interfaces/TicketService.mjs";
import { toDateForSQL } from "./util/dateFunction.mjs";
import { LOGGER_PATH } from "./common/constants/constant.mjs";
import { changeLoggerFileName, getCurrentPath, logger } from "./common/logging/Logger.mjs";
import config from "./config/main-config.json" assert {type: 'json'}


import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import errorHandler from "./common/middleware/errorHandler.mjs";
import { mainRouter } from "./api/MainRouter.mjs";
import auth from "./common/middleware/Authentification.mjs";

let counter = 0;
let time = 0

let dateFrom: Date;
let dateTo: Date;

fileService.createDirectory(LOGGER_PATH)
logger.info(`[MAIN APP] Directory for logging: ${LOGGER_PATH} created`)

setSearchDate();
logger.info(`[MAIN APP] Start tickets service`)
logger.info(`[MAIN APP] main interval of checking: ${config.main.interval} seconds`)

if (config.main.servers.api.enabled) {

    const server = express();
    server.use(cors())
    server.use(bodyParser.urlencoded({ extended: true }));
    server.use(bodyParser.json());

    server.listen(config.main.servers.api.port, () => {
        logger.info(`[API SERVER] Api server listening on port ${config.main.servers.api.port}`);
        server.use(errorHandler);
    });

    server.use("/api", auth(), mainRouter)

}

callBackServices.forEach(callbackService => {
    callbackService.startServer()
})

setInterval(() => {
    counter++;
    time += 10000;
    if (Date.now() > dateTo.getTime()) {
        logger.info(`[MAIN APP] start process of changing the current date`)
        setSearchDate()
    } else {
        logger.trace(`[MAIN APP] current date not need changing`)
    }

    services.forEach(async (service: TicketService) => {
        logger.trace(`[MAIN APP] Step number ${counter} [service name ${service.getServiceName()}]`)
        service.run(dateFrom, dateTo);
    })
}, config.main.interval * 1000)

function setSearchDate() {
    const now = new Date()

    // for tests
    // dateFrom = new Date(2025,6,28,0,0,0,1)
    // dateTo = new Date(2025,6,28,23,59,59,0)

    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 1)
    dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 0)


    callBackServices.forEach(callbackService => {
        callbackService.setCurrentArchiveDirectory(dateTo)
    })

    changeLoggerFileName(dateTo);


    logger.info(`[MAIN APP] Current date for search reservation setted: from ${toDateForSQL(dateFrom)} to ${toDateForSQL(dateTo)}`)
    logger.info(`[MAIN APP] Current path for logging setted: ${getCurrentPath()}`)
}
