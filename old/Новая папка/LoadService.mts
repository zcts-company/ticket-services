import express, { Response, Request } from "express";
import asyncHandler from 'express-async-handler';
import { fileConverterXml, fileService } from "../../../../instances/services.js";
import { logger } from "../../../../common/logging/Logger.js";
import config from "../../../../config/taxi/yandex.json" with {type: 'json'};
import mainConfig from "../../../../config/main-config.json" with {type: 'json'};
import { nameOfFile } from "../../../../util/fileFunction.js";
import { HandCheckReservation } from "../../../../common/types/HandCheckReservation.js";
import { createHttpError } from "../../../../util/errorFunction.js";
import { ProfileType } from "../../../../common/types/ProfileType.js";
import { YandexWebService } from "../web-service/YandexWebService.js";
import { YandexTransport } from "../transport-service/YandexTransport.js";
// Импортируем расширенный тип данных
import { YandexTaxiOrderInfo } from "../types/response/YandexTaxiOrderInfo.js";

// Тип для обертки, которую понимает ваш XML-конвертер
export type LoadResponse = {
  result: {
    order: YandexTaxiOrderInfo;
  };
  source: string;
};

export const loadService = express.Router();
const webService = new YandexWebService();

loadService.post('/load', asyncHandler(
  async (req: Request, res: Response) => {
    const request: HandCheckReservation = req.body;

    if (!request.locator) {
      throw createHttpError(400, `Missing 'locator' (order_id) property in request body`);
    }

    if (!request.profile) {
      throw createHttpError(400, `Missing 'profile' property in request body`);
    }

    const transportService = new YandexTransport(request.profile);
    logger.info(`[YANDEX] Processing hand check for order_id: ${request.locator}`);

    // Получаем данные. Типизируем как расширенный инфо-объект
    const orderData: YandexTaxiOrderInfo | undefined = await webService.getOrder(request.locator, request.profile);

    if (orderData) {
      const updated = new Date();
      // orderData.id — это UUID строка из Яндекса
      const path = await createFile(orderData, orderData.id, updated, request.profile, transportService);

      res.status(200).json({
        status: "success",
        order_id: orderData.id,
        path: path
      });
    } else {
      throw createHttpError(404, `Order ${request.locator} not found in Yandex API`);
    }
  }
));

async function createFile(orderInfo: YandexTaxiOrderInfo, key: string, updated: Date, profile: ProfileType, transportService: YandexTransport): Promise<string> {
  try {
    // Конвертер теперь получит объект, где внутри order есть и performer, и toll_roads
    const xmlContent: string = fileConverterXml.jsonToXml(orderInfo);

    const fileName = nameOfFile(key, updated, config[profile].checkUpdates) + "_hand.xml";
    const path = `${config[profile].fileOutput.mainPath}${fileName}`;

    await fileService.writeFile(path, xmlContent);

    logger.info(`[YANDEX] XML created with Performer data: ${orderInfo.performer?.fullname || 'N/A'}`);

    if (mainConfig.main.transport.smbserver) {
      await transportService.forceSendTo1CSamba(fileName, config[profile].fileOutput.mainPath);
    }

    return path;
  } catch (err) {
    const errorMessage = (err as Error).message;
    logger.error(`[YANDEX] File creation error: ${errorMessage}`);
    throw new Error(`Failed to process reservation: ${errorMessage}`);
  }
}