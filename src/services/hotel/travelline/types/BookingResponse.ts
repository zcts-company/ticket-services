import { Booking } from "./Booking.js";
import { HotelInfo } from "./HotelInfo.js";

export type BookingResponse = {
    booking:Booking;
    hotelInfo?:HotelInfo
}