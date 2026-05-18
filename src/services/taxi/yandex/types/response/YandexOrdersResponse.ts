import { YandexTaxiOrder } from "./YandexTaxiOrder.js";

export type YandexTaxiOrderResponse = {
  items: YandexTaxiOrder[];
  limit: number;
  offset: number;
  total_amount: number;
};