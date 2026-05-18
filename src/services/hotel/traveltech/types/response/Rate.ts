import { CancellationPolicy } from "./CancellationPolicy.js";
import { Price } from "./Price.js";
import { Room } from "./Room.js";
import { RzpvInfo } from "./RzpvInfo.js";
import { SBO } from "./SBO.js";

export type Rate = {
      roomsAvailable: number;
      isOnRequest: boolean;
      is3D: boolean;
      isNonRefundable: boolean;
      timeZone: number;
      hasBreakfast: boolean;
      mealName: string;
      freeCancelationDate: string;
      sbo: SBO;
      price: Price
      defaults: {
        checkIn: string;
        checkOut: string;
      };
      cancelationPolicies: CancellationPolicy[];
      rzpvInfo: RzpvInfo
      room:Room 
    };