
import pg from "pg"
const Pool =  pg.Pool;
import { HotelCache } from "../../common/cache/HotelCache.mjs";
import { toDateForSQL } from "../../util/dateFunction.mjs";
import { logger } from "../../common/logging/Logger.mjs";
import config from "../../config/db/database.json" assert {type: 'json'}

export class HotelServiceDb {

    private reservationCache:HotelCache;
    private pool;
    private currentDate:Date;
    private checkUpdate:boolean;

    constructor(databaseName:string, cache:HotelCache, checkUpdate:boolean){
            this.pool = new Pool({
                user:config.login,
                password:config.password,
                database:databaseName,
                host:config.mainHost,
                port:config.port,
                max: 0,
                idleTimeoutMillis: 8000,
            }) 
            this.reservationCache = cache; 
            this.currentDate = new Date() 
            this.checkUpdate = checkUpdate;
            
        }

        async getAllReservations(){
            this.pool.query('SELECT * FROM orders_type_hotel WHERE reservation notNull', async (err:any, res:any) => {
                if (err) {
                  logger.error(`[DATABASE SERVICE] ${err}`);
                  return 'Error query';
                }    
                     await this.checkAndSetReservationCache(res.rows)
                return res
              })

            return this.reservationCache;  

       }

       async getReservationsByDate(dateFrom:Date, dateTo:Date){
          let from = toDateForSQL(dateFrom)
          let to = toDateForSQL(dateTo)

        const query:string = `SELECT o.id,
                                     o.locator,
                                     o.updated,
                                     h.reservation
                              FROM orders o
                              LEFT JOIN orders_type_hotel h ON h.id = o.id
                              WHERE o.${this.checkUpdate ? 'updated' : 'created'} > '${from}' AND o.${this.checkUpdate ? 'updated' : 'created'} < '${to}' 
                              AND h.reservation notNull and o.service = '${config.service.name}' 
                              AND h.reservation ->>'provider' like '%${this.reservationCache.getProviderName()}%'`
        logger.trace(`[DATABASE SERVICE] Starting query for database. QUERY: ${query}`)
        try {
          this.pool.query(query, async (err:any, res:any) => {
              if (err) {
                logger.error(`[DATABASE SERVICE] ${err}`)
                return 'Error query';
              } else {
                logger.trace(`[DATABASE SERVICE] succsess query: rows ${res.rows.length}`)
                
              }    
              
              this.checkDate(dateFrom)
                   
              
              await this.checkAndSetReservationCache(res.rows)
              
              return res
            })
        } catch (error:any) {
            logger.error(`[DATABASE SERVICE] error: ${error.getMessage()}`)
        }

        return this.reservationCache;       

    }

    private checkDate(dateFrom:Date){
      
      if(this.currentDate < dateFrom){ 
            this.currentDate = new Date(dateFrom);
      }

    }

    private async checkAndSetReservationCache(rows:any[]){
            let count:number = 0;
            rows.forEach((row) => {
              // добавляем в кэш сервиса только записи из базы у который provider равен имени сервиса из config
              if(row.reservation.provider.includes(this.reservationCache.getProviderName())){
                logger.trace(`[DATABASE SERVICE] recived reservation from database of provider: ${row.reservation.provider}`)
                if(row.reservation.locator){
                  logger.trace(`[DATABASE SERVICE] recived reservation from database with locator: ${row.reservation.locator}`)
                  const reservation = this.reservationCache.getItem(row.reservation.locator);
                    if(!reservation || (row.updated > reservation.updated) ){
                      logger.info(`[DATABASE SERVICE] start adding process for new reeservation to cache. Locator: ${row.reservation.locator}`)
                        this.reservationCache.addToCache(row.reservation.locator,row)
                        count++;
                        logger.info(`[DATABASE SERVICE] finish adding process process for new reeservation to cache. Locator: ${row.reservation.locator}`)
                    }
                }

              } else {
                  logger.trace(`[DATABASE SERVICE] recived reservation from database of provider: ${row.reservation.provider} for service ${this.reservationCache.getProviderName()}`)
              }
               
            })
            logger.trace(`[DATABASE SERVICE] Date: ${toDateForSQL(this.currentDate)}. Rows from database ${rows.length} setting to cache ${count} reservation`);         
        }

    }
