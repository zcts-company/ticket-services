import { BookingCancellation } from "./BookingCancellation.mjs"
import { BookingCancellationPolicy } from "./BookingCancellationPolicy.mjs"
import { BookingCustomer } from "./BookingCustomer.mjs"
import { BookingPrepayment } from "./BookingPrepayment.mjs"
import { BookingService } from "./BookingService.mjs"
import { BookingTaxes } from "./BookingTaxes.mjs"
import { RoomStay } from "./RoomStay.mjs"
import { StatusBooking } from "./StatusBooking.mjs"
import { Total } from "./Total.mjs"

export type Booking = {
    number:string,
    status:StatusBooking,
    createdDateTime:string,
    modifiedDateTime: string,
    version: string,
    total:Total,
    taxes: BookingTaxes[],
    currencyCode:string,
    cancellation:BookingCancellation,
    cancellationPolicy: BookingCancellationPolicy,
    propertyId:string,
    roomStays:RoomStay[],
    services:BookingService[],
    customer:BookingCustomer,
    prepayment:BookingPrepayment,
    bookingComments:string[]
}