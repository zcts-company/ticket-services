import config from "../../../../config/taxi/yandex.json" with {type: 'json'}
import { logger } from "../../../../common/logging/Logger.js";
import { ProfileType } from "../../../../common/types/ProfileType.js";
import { toIsoStringLocalDate } from "../../../../util/dateFunction.js";
import { TaxiWebService } from "../../interfaces/TaxiWebService.js";
import { YandexTaxiOrderResponse } from "../types/response/YandexOrdersResponse.js";
import { YandexTaxiOrderInfo } from "../types/response/YandexTaxiOrderInfo.js";
import { YandexUserProfile } from "../types/response/YandexUserProfile.js";

export class YandexWebService implements TaxiWebService {


    async getUserData(userId: string, profile: ProfileType): Promise<YandexUserProfile | undefined> {
        let data: YandexUserProfile | undefined = undefined;
        const baseUrl = config[profile].baseUrl;
        const url = new URL(`${baseUrl}/integration/2.0/users`);
        url.searchParams.append("user_id", userId);

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config[profile].token.trim()}`,
                    'Content-Type': 'application/json'
                }
            });

            const responseBody = await response.text();

            if (response.ok) {
                data = JSON.parse(responseBody) as YandexUserProfile;
                logger.info('Success: Data received');
            } else {
                logger.error(`Status: ${response.status}. Body: ${responseBody}`);
            }
        } catch (error) {
            logger.error(`Fetch Error: ${error}`);
        }
        return data;
    }

    /**
     * Получение детальной информации об одном заказе
     * URL: /integration/2.0/orders?order_id=...
     */
    async getOrder(locator: string, profile: ProfileType): Promise<YandexTaxiOrderInfo | undefined> {
        let data: YandexTaxiOrderInfo | undefined = undefined;
        try {
            const baseUrl = config[profile].baseUrl;
            const url = new URL(`${baseUrl}/integration/2.0/orders/info`);


            url.searchParams.append('order_id', locator);

            // Убираем ВООБЩЕ всё лишнее из токена
            const cleanToken = 'Bearer ' + config[profile].token.trim();
            logger.info(`Sending request. Token length check: ${cleanToken.length}`);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': cleanToken,
                }
            });

            const responseBody = await response.text();

            if (response.ok) {
                data = JSON.parse(responseBody) as YandexTaxiOrderInfo;
                logger.info('Success: Data received');
            } else {
                logger.error(`Status: ${response.status}. Body: ${responseBody}`);
            }
        } catch (error) {
            logger.error(`Fetch Error: ${error}`);
        }
        return data;
    }

    /**
     * Получение списка заказов
     * URL: /integration/2.0/orders/list
     */
    async getOrders(fromDate: Date, toDate: Date, pageNumber: number, profile: ProfileType): Promise<any> {
        let data: YandexTaxiOrderResponse = this.getEmptyListResponce();
        try {
            const baseUrl = config[profile].baseUrl;
            const pageSize = 100;
            const offset = (pageNumber - 1) * pageSize;

            // Формируем URL с Query-параметрами
            const url = new URL(`${baseUrl}/integration/2.0/orders/list`);

            const params = {
                'limit': pageSize.toString(),
                'offset': offset.toString(),
                'sorting_field': 'finished_date',
                'sorting_direction': '-1',
                'since_datetime': toIsoStringLocalDate(fromDate), // Убедитесь, что формат YYYY-MM-DDTHH:mm:ss
                'till_datetime': toIsoStringLocalDate(toDate)
            };

            Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

            logger.trace(`Request to Yandex: ${url.toString()}`);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config[profile].token}`,
                    'Content-Type': 'application/json'
                }
            });

            logger.trace(`Response status: ${response.status}`);

            if (response.status === 200) {
                data = await response.json() as YandexTaxiOrderResponse;
            } else {
                const errorBody = await response.text();
                logger.error(`Yandex API Error: ${response.status} - ${errorBody}`);
            }
        } catch (error) {
            logger.error(`Error request to Yandex orders list: ${error}`);
        } finally {
            return data;
        }
    }

    getEmptyListResponce(): YandexTaxiOrderResponse {
        return {
            items: [],
            limit: 100,
            offset: 0,
            total_amount: 0
        };
    }
}