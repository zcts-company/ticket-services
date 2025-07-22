import { BookingGuest } from "./BookingGuest.mjs";
import { DailyRate } from "./DailyRate.mjs";
import { ExtraStayCharge } from "./ExtraStayCharge.mjs";
import { GuestCount } from "./GuestCount.mjs";
import { RatePlan } from "./RatePlan.mjs";
import { RoomStayService } from "./RoomStayService.mjs";
import { RoomType } from "./RoomType.mjs";
import { StayDates } from "./StayDates.mjs";
import { Total } from "./Total.mjs";

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