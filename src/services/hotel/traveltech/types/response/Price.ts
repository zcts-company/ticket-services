import { PriceFeatures } from "./PriceFeatures.js";

export type Price = {
        currencyCode: string;
        total: number;
        priceFeatures:PriceFeatures 
      };