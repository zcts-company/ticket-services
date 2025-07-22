import { Order } from "../Order";
import { Hotel } from "./Hotel";
import { Rate } from "./Rate";

export type LoadResponse = {
  result: {
    order: Order
    hotel: Hotel 
    rate: Rate 
  };
  errors: any[];
};
