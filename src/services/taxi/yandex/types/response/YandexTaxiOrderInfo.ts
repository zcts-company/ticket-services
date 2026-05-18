import { Performer } from "./Performer.js";
import { TollRoads } from "./TollRoads.js";
import { YandexTaxiOrder } from "./YandexTaxiOrder.js";

export interface YandexTaxiOrderInfo extends YandexTaxiOrder {
  performer?: Performer; // Опционально, так как исполнителя может не быть в отмененных заказах
  toll_roads: TollRoads;
}