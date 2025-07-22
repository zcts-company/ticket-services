import { CancellationPolicy } from "./CancellationPolicy";
import { Price } from "./Price";
import { Room } from "./Room";
import { RzpvInfo } from "./RzpvInfo";
import { SBO } from "./SBO";

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