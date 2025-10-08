import { Booking } from "./Booking.mjs";
import { HotelInfo } from "./HotelInfo";

export type BookingResponse = {
    booking:Booking;
    hotelInfo?:HotelInfo
}