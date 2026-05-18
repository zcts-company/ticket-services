import { BookingCancellation } from "./BookingCancellation.js"
import { BookingCancellationPolicy } from "./BookingCancellationPolicy.js"
import { BookingCustomer } from "./BookingCustomer.js"
import { BookingPrepayment } from "./BookingPrepayment.js"
import { BookingService } from "./BookingService.js"
import { BookingTaxes } from "./BookingTaxes.js"
import { RoomStay } from "./RoomStay.js"
import { StatusBooking } from "./StatusBooking.js"
import { Total } from "./Total.js"

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