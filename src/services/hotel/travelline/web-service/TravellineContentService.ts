import { logger } from "../../../../common/logging/Logger.js";
import config from "../../../../config/hotel/travelline.json" with {type: 'json'}
import { ProfileType } from "../../../../common/types/ProfileType.js";
import { HotelInfo } from "../types/HotelInfo.js";

type PropertyInfo = {
    id: string,
    name: string,
    contactInfo?: {
        address?: { addressLine?: string },
        phones?: { phoneNumber?: string }[],
        emails?: string[]
    }
}

/**
 * Название и контакты отеля из TravelLine Content API (GET content/v1/properties/{propertyId}),
 * вместо БД hotel-directory. Поля — как при импорте отелей в hotel-directory (zcts-misc/dump/travelline_hotels.js).
 */
export class TravellineContentService {

    async getHotelInfo(propertyId: string, profile: ProfileType): Promise<HotelInfo[]> {
        try {
            const url = `${config[profile].baseUrl}content/v1/properties/${encodeURIComponent(propertyId)}`;
            logger.info(`[TRAVELLINE CONTENT] Get hotel info ${propertyId}`);
            const response = await fetch(url, {
                method: 'get',
                headers: { 'X-API-KEY': config[profile].apiKey }
            });

            if (response.status != 200) {
                logger.error(`[TRAVELLINE CONTENT] Hotel ${propertyId}: response status ${response.status}`);
                return [];
            }

            const property = await response.json() as PropertyInfo;
            return [{
                hotel_name: property.name,
                address: property.contactInfo?.address?.addressLine ?? '',
                email: property.contactInfo?.emails?.[0],
                phone: property.contactInfo?.phones?.[0]?.phoneNumber ?? ''
            }];
        } catch (error) {
            logger.error(`[TRAVELLINE CONTENT] Hotel ${propertyId}: ${error}`);
            return [];
        }
    }
}
