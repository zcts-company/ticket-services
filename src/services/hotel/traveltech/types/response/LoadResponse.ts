import { Order } from "../Order.js";
import { Hotel } from "./Hotel.js";
import { Rate } from "./Rate.js";

export type LoadResponse = {
  result: {
    order: Order
    hotel: Hotel 
    rate: Rate 
  };
  errors: any[];
};
