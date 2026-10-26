import { logger } from "../../common/logging/Logger.js";
import { getRequiredEnv } from "../../util/environment.js";
import { toIsoStringLocalDate } from "../../util/dateFunction.js";

/**
 * Строка в формате прежнего SQL-запроса к прод-БД (orders + orders_type_hotel),
 * чтобы логика кэша броней не менялась.
 */
export type HotelBookingRow = {
    id: number,
    locator: string,
    updated: Date,
    reservation: { locator: string, provider: string }
}

type HotelBookingModel = {
    orderId: number,
    locator: string,
    provider: string,
    created: string,
    updated: string
}

type TokenResponse = {
    access_token: string,
    expires_in: number
}

// Метод corporate принимает окно не больше 31 суток
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
// Токен обновляем заранее, чтобы он не истёк посреди запроса
const TOKEN_MARGIN_MS = 30 * 1000;

/**
 * Клиент метода corporate GET /integration/hotel-bookings (номера броней отелей).
 * Доступ — токен Keycloak по client credentials сервисного клиента ticket-services; прямого доступа к БД нет.
 *
 * Переменные окружения:
 *   CORPORATE_API_URL  https://online.zcts.ru/api-corporate
 *   KC_TOKEN_URL       https://oauth-online.zcts.ru/auth/realms/master/protocol/openid-connect/token
 *   KC_CLIENT_ID       ticket-services
 *   KC_CLIENT_SECRET   секрет клиента (env_file, не в config/)
 */
export class CorporateApiClient {

    private readonly baseUrl = getRequiredEnv("CORPORATE_API_URL").replace(/\/+$/, "");
    private readonly tokenUrl = getRequiredEnv("KC_TOKEN_URL");
    private readonly clientId = getRequiredEnv("KC_CLIENT_ID");
    private readonly clientSecret = getRequiredEnv("KC_CLIENT_SECRET");

    private token: string | undefined;
    private tokenExpires = 0;

    /**
     * Брони поставщика (provider — префикс, например travelline) с датой создания
     * (или изменения, если byUpdated) в полуинтервале [from, to). Даты — локальное время сервиса (TZ=Europe/Moscow).
     */
    async getHotelBookings(provider: string, from: Date, to: Date, byUpdated: boolean): Promise<HotelBookingRow[]> {
        const rows: HotelBookingRow[] = [];
        let start = new Date(from);

        while (start < to) {
            const end = new Date(Math.min(to.getTime(), start.getTime() + MAX_WINDOW_MS));
            rows.push(...await this.fetchWindow(provider, start, end, byUpdated));
            start = end;
        }

        return rows;
    }

    private async fetchWindow(provider: string, from: Date, to: Date, byUpdated: boolean): Promise<HotelBookingRow[]> {
        const range = byUpdated ? "updated" : "created";
        const params = new URLSearchParams({
            provider: provider,
            [`${range}_from`]: toIsoStringLocalDate(from),
            [`${range}_to`]: toIsoStringLocalDate(to)
        });
        const url = `${this.baseUrl}/integration/hotel-bookings?${params}`;

        let response = await this.get(url);
        if (response.status === 401) {
            // токен отозван или истёк раньше срока — получаем новый один раз
            this.token = undefined;
            response = await this.get(url);
        }

        if (!response.ok) {
            const reason = (await response.text()).slice(0, 200);
            throw new Error(`hotel-bookings ${response.status} ${reason}`);
        }

        const bookings = await response.json() as HotelBookingModel[];
        logger.trace(`[CORPORATE API] hotel-bookings ${provider} ${range} ${params.get(`${range}_from`)} - ${params.get(`${range}_to`)}: ${bookings.length}`);

        return bookings.map((booking) => ({
            id: booking.orderId,
            locator: booking.locator,
            updated: new Date(booking.updated),
            reservation: { locator: booking.locator, provider: booking.provider }
        }));
    }

    private async get(url: string): Promise<Response> {
        return fetch(url, {
            method: 'get',
            headers: { 'Authorization': `Bearer ${await this.getToken()}`, 'Accept': 'application/json' }
        });
    }

    private async getToken(): Promise<string> {
        if (this.token && Date.now() < this.tokenExpires - TOKEN_MARGIN_MS) {
            return this.token;
        }

        const response = await fetch(this.tokenUrl, {
            method: 'post',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret
            })
        });

        if (!response.ok) {
            // тело ответа не логируем: Keycloak может вернуть в нём параметры запроса
            throw new Error(`Keycloak token request failed: ${response.status}`);
        }

        const data = await response.json() as TokenResponse;
        this.token = data.access_token;
        this.tokenExpires = Date.now() + data.expires_in * 1000;
        logger.trace(`[CORPORATE API] Got access token for ${this.clientId}, expires in ${data.expires_in} s`);

        return this.token;
    }
}
