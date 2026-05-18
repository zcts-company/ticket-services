import { BookingContact } from "./BookingContact.js"

export type BookingCustomer = {
    contacts:BookingContact[],
    comment:string,
    firstName:string,
    lastName:string,
    middleName:string,
    citizenship:string|null
}