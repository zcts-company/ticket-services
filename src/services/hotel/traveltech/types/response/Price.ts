import { PriceFeatures } from "./PriceFeatures";

export type Price = {
        currencyCode: string;
        total: number;
        priceFeatures:PriceFeatures 
      };