
import express, { Response } from "express";
import asyncHandler from "express-async-handler";
import { fileConverterXml, fileService } from "../../../../instances/services.js";
import { logger } from "../../../../common/logging/Logger.js";
import config from "../../../../config/rail/smart_travel.json" with { type: "json" };
import { nameOfFile } from "../../../../util/fileFunction.js";
import { createHttpError } from "../../../../util/errorFunction.js";
import { SmartTravelOrder } from "../types/SmartTravelOrder.js";

export const webHookService = express.Router();

const currentDirectory = config.fileOutput.mainPath;

webHookService.post("/load", express.json({ type: "application/json" }), asyncHandler(async (req, res: Response) => {
    logger.info("[SMART TRAVEL] Received POST request for webhook");
    if (!req.is("application/json")) {
        logger.error(`Unsupported Media Type. Expected application/json. In request - ${req.headers["content-type"]}`);
        throw createHttpError(415, `Unsupported Media Type. Expected application/json. In request - ${req.headers["content-type"]}`);
    }

    const order = req.body as SmartTravelOrder;

    if (!order || typeof order !== "object" || !order.UFS_RZhD_Gate) {
        logger.error("Missing 'UFS_RZhD_Gate' property in request body");
        throw createHttpError(400, "Missing 'UFS_RZhD_Gate' property in request body");
    }

    const operationInfo = order.UFS_RZhD_Gate.OperationInfo;

    if (!operationInfo) {
        logger.error("Missing 'OperationInfo' property in request body");
        throw createHttpError(400, "Missing 'OperationInfo' property in request body");
    }

    if (!operationInfo.idzakaz) {
        logger.error("Missing 'idzakaz' property in OperationInfo");
        throw createHttpError(400, "Missing 'idzakaz' property in OperationInfo");
    }
    const updated = new Date();
    await createFile(order, String(operationInfo.idzakaz), updated);
    res.sendStatus(200);
})
);

async function createFile(reservationData: SmartTravelOrder, key: string, updated: Date): Promise<string> {
    const res: string = fileConverterXml.jsonToXml(reservationData);
    const fileName = nameOfFile(key, updated, config.checkUpdates) + "_hook.xml";
    const path = `${currentDirectory}${fileName}`;
    await fileService.writeFile(path, res);
    logger.info(`[SMART TRAVEL WEB HOOK] File ${fileName} created in directory: ${currentDirectory}`);

    return path;
}
