import { HotelCache } from "../../common/cache/HotelCache.js";
import { logger } from "../../common/logging/Logger.js";
import { toDateForSQL } from "../../util/dateFunction.js";
import { CorporateApiClient, HotelBookingRow } from "./CorporateApiClient.js";

/**
 * Брони поставщика из corporate (вместо прежнего SQL к прод-БД, HotelServiceDb).
 * Кэш заполняется так же, как раньше: по номеру брони, более свежий updated заменяет старую запись.
 */
export class HotelBookingsService {

    private api: CorporateApiClient;
    private reservationCache: HotelCache;
    private checkUpdate: boolean;
    private currentDate: Date;

    constructor(api: CorporateApiClient, cache: HotelCache, checkUpdate: boolean) {
        this.api = api;
        this.reservationCache = cache;
        this.checkUpdate = checkUpdate;
        this.currentDate = new Date();
    }

    async getReservationsByDate(dateFrom: Date, dateTo: Date): Promise<HotelCache> {
        try {
            const rows = await this.api.getHotelBookings(this.reservationCache.getProviderName(), dateFrom, dateTo, this.checkUpdate);
            this.checkDate(dateFrom);
            this.checkAndSetReservationCache(rows);
        } catch (error) {
            logger.error(`[HOTEL BOOKINGS] ${error}`);
        }
        return this.reservationCache;
    }

    private checkDate(dateFrom: Date) {
        if (this.currentDate < dateFrom) {
            this.currentDate = new Date(dateFrom);
        }
    }

    private checkAndSetReservationCache(rows: HotelBookingRow[]) {
        let count = 0;

        rows.forEach((row) => {
            // в кэш сервиса — только брони поставщика этого сервиса
            if (row.reservation.provider.includes(this.reservationCache.getProviderName()) && row.reservation.locator) {
                const reservation = this.reservationCache.getItem(row.reservation.locator);
                if (!reservation || (row.updated > reservation.updated)) {
                    this.reservationCache.addToCache(row.reservation.locator, row);
                    count++;
                    logger.info(`[HOTEL BOOKINGS] reservation added to cache. Locator: ${row.reservation.locator}`);
                }
            }
        });

        logger.trace(`[HOTEL BOOKINGS] Date: ${toDateForSQL(this.currentDate)}. Rows from corporate ${rows.length}, set to cache ${count}`);
    }
}
