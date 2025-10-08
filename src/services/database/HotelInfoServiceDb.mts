
import pg from "pg"
const Pool =  pg.Pool;
import { logger } from "../../common/logging/Logger.mjs";
import config from "../../config/db/database.json" assert {type: 'json'}
import { HotelInfo } from "../hotel/travelline/types/HotelInfo";

export class HotelInfoServiceDb {

    private pool;

    constructor(databaseName:string){
            this.pool = new Pool({
                user:config.login,
                password:config.password,
                database:databaseName,
                host:config.mainHost,
                port:config.port,
                max: 0,
                idleTimeoutMillis: 8000,
            })             
        }

      async getHotelInfo(id: string, provider: string):Promise<HotelInfo[]> {
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
