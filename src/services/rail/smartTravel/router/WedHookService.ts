
import express, { Response } from "express";
import asyncHandler from "express-async-handler";
import { join } from "node:path";
import { fileConverterXml, fileService } from "../../../../instances/services.js";
import { logger } from "../../../../common/logging/Logger.js";
import config from "../../../../config/rail/smart_travel.json" with { type: "json" };
import { createHttpError } from "../../../../util/errorFunction.js";
import { SmartTravelWebhook } from "../types/SmartTravelWebhook.js";

export const webHookService = express.Router();

const currentDirectory = config.fileOutput.mainPath;

webHookService.post("/load", asyncHandler(async (req, res: Response) => {
    logger.info("[SMART TRAVEL WEBHOOK] Request received");

    try {
        const requestInfo = {
            method: req.method,
            url: req.originalUrl,
            httpVersion: req.httpVersion,
            remoteAddress: req.socket.remoteAddress,
            contentType: req.get("content-type") ?? null,
            contentLength: req.get("content-length") ?? null,
            headers: {
                ...req.headers,
                authorization: req.headers.authorization ? "[REDACTED]" : undefined
            },
            body: req.body
        };

        logger.info(`[SMART TRAVEL WEBHOOK] Incoming HTTP request:\n${JSON.stringify(requestInfo, null, 2)}`);

        if (!req.is("application/json")) {
            throw createHttpError(415, "Unsupported Media Type. Expected application/json");
        }

        logger.info("[SMART TRAVEL WEBHOOK] Content-Type validated");

        const order = req.body as SmartTravelWebhook;

        if (!order || typeof order !== "object" || !order.OrderItem ||
            !Number.isSafeInteger(order.OrderItem.OrderId) || order.OrderItem.OrderId <= 0 || typeof order.OrderItem.DetailedOperationStatus !== "string" ||
            !order.OrderItem.DetailedOperationStatus.trim()) {

            throw createHttpError(400, "Invalid SmartTravel order data");
        }

        logger.info(`[SMART TRAVEL WEBHOOK] Parsed JSON body:\n${JSON.stringify(order, null, 2)}`);

        const updated = new Date();

        logger.info("[SMART TRAVEL WEBHOOK] Starting file creation");

        const filePath = await createFile(order, updated);

        logger.info(`[SMART TRAVEL WEBHOOK] File successfully created: ${filePath}`);

        res.sendStatus(200);

    } catch (error) {
        logger.error(`[SMART TRAVEL WEBHOOK] Request processing failed:\n${error instanceof Error ? error.stack : String(error)}`);
        throw error;
    }
}));

async function createFile(data: SmartTravelWebhook, updated: Date): Promise<string> {
    logger.info("[SMART TRAVEL WEBHOOK] Converting JSON to XML");
    const xml = fileConverterXml.jsonToXml(data);
    logger.info("[SMART TRAVEL WEBHOOK] XML conversion completed");

    const orderId = data.OrderItem.OrderId;
    const status = data.OrderItem.DetailedOperationStatus.replace(/[^a-zA-Z0-9_-]/g, "_");
    const serviceType = data.OrderItem?.ServiceTypeInfo;
    const transportType = serviceType === "RailwayTickets" ? "rail" : serviceType === "BusTickets" ? "bus" : "unknown";
    const timestamp = updated.toISOString().replace(/[:.]/g, "-");
    const fileName = `${transportType}_${orderId}_${status}_${timestamp}.xml`;
    const filePath = join(currentDirectory, fileName);

    logger.info(`[SMART TRAVEL WEBHOOK] Writing file: ${filePath}`);
    await fileService.writeFile(filePath, xml);
    logger.info(`[SMART TRAVEL WEBHOOK] File written: ${filePath}`);

    return filePath;
}
