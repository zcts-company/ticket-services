
import pg from "pg"
const Pool = pg.Pool;
import { logger } from "../../common/logging/Logger.js";
import { HotelInfo } from "../hotel/travelline/types/HotelInfo.js";
import { getEnvNumber, getRequiredEnv } from "../../util/environment.js";

export class HotelInfoServiceDb {

  private pool;

  constructor(databaseName: string) {
    this.pool = new Pool({
      user: getRequiredEnv("DB_USER"),
      password: getRequiredEnv("DB_PASSWORD"),
      database: databaseName,
      host: getRequiredEnv("DB_HOST"),
      port: getEnvNumber("DB_PORT", 5432),
      max: 0,
      idleTimeoutMillis: 8000,
    });
  }

  async getHotelInfo(id: string, provider: string): Promise<HotelInfo[]> {
    try {
      logger.info(`[HotelInfoServiceDb] Recived request for hotel info by id ${id} provider ${provider}`)
      const query = `SELECT 
                        hn.value as hotel_name,
                        h.address as address,
                        h.email as email,
                        h.phone as phone
                        FROM hotels h 
                        LEFT JOIN hotel_names hn ON hn.hotel_id = h.id AND hn.lang = 'ru' 
                        WHERE ${provider} = $1`;
      const result = await this.pool.query(query, [id]);
      logger.info(`[HotelInfoServiceDb] find ${result.rows.length} hotels in database`)
      return result.rows;
    } catch (err) {
      logger.error(`[DATABASE SERVICE] ${err}`);
      return [];
    }
  }

}
