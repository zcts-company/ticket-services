import express, { Response } from "express";
import asyncHandler from "express-async-handler";
import { fileConverterXml, fileService } from "../../../../instances/services.mjs";
import { logger } from "../../../../common/logging/Logger.mjs";
import config from "../../../../config/air/ttbooking.json" assert { type: "json" };
import { nameOfFile } from "../../../../util/fileFunction.mjs";
import getRawBody from "raw-body";
import { TTBookingTransport } from "../transport/TTBookingTransport.mjs";
import { createHttpError } from "../../../../util/errorFunction.mjs";
import { OrderSnapshot } from "../types/OrderSnapshot";

export const webHookService = express.Router();

const transportService: TTBookingTransport = new TTBookingTransport();
const currentDirectory = config.fileOutput.mainPath;

webHookService.post(
    "/web-hook-load",
    asyncHandler(async (req: any, res: Response) => {
        logger.info(`[OrderSnapshot] Received post request for webhook`);
        if (req.headers["content-type"] !== "application/xml") {
            logger.error(
                `Unsupported Media Type. Expected application/xml. In request - ${req.headers["content-type"]}`
            );
            throw createHttpError(
                415,
                `Unsupported Media Type. Expected application/xml. In request - ${req.headers["content-type"]}`
            );
        }

        const xml = await getRawBody(req, { encoding: "utf-8" });
        logger.info(xml)
        const order = (await fileConverterXml.xmlToJson(xml)) as OrderSnapshot;

        if (!order.order_snapshot) {
            logger.error(`Missing 'order_snapshot' property in request body`);
            throw createHttpError(415, `Missing 'order_snapshot' property in request body`);
        }

        const updated = new Date();
        const ordId = order.order_snapshot.header.$.ord_id;

        if (!ordId) {
            logger.error(`Missing 'ord_id' in order_snapshot.header`);
            throw createHttpError(400, `Missing 'ord_id' in order_snapshot.header`);
        }

        const path = await createFile(order, ordId, updated);
        res.status(200).send();
    })
);

async function createFile(order: OrderSnapshot, key: string, updated: Date) {
    const xmlString = fileConverterXml.jsonToXml(order);
    const fileName = nameOfFile(key, updated, config.checkUpdates) + "_hook.xml";
    const path = `${currentDirectory}${fileName}`;

    await fileService.writeFile(path, xmlString);
    logger.info(`[Order WebHook] File '${fileName}' created in directory: ${currentDirectory}`);

    return path;
}
