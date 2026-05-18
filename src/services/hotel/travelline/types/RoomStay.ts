import { BookingGuest } from "./BookingGuest.js";
import { DailyRate } from "./DailyRate.js";
import { ExtraStayCharge } from "./ExtraStayCharge.js";
import { GuestCount } from "./GuestCount.js";
import { RatePlan } from "./RatePlan.js";
import { RoomStayService } from "./RoomStayService.js";
import { RoomType } from "./RoomType.js";
import { StayDates } from "./StayDates.js";
import { Total } from "./Total.js";

export type RoomStay = {
    dailyRates: DailyRate[],
    total:Total,
    services:RoomStayService[],
    extraStayCharge: ExtraStayCharge,
    stayDates:StayDates,
    ratePlan: RatePlan,
    roomType:RoomType,
    guest:BookingGuest,
    guestCount:GuestCount,
    checksum:string
}