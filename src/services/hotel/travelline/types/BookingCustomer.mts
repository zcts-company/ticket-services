import { BookingContact } from "./BookingContact.mjs"

export type BookingCustomer = {
    contacts:BookingContact[],
    comment:string,
    firstName:string,
    lastName:string,
    middleName:string,
    citizenship:string|null
}