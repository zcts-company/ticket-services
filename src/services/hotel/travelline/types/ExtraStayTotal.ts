import { BookingTaxAmount } from "./BookingTaxAmount.js"

export type ExtraStayTotal = {
    priceBeforeTax:number,
    taxAmount:number,
    taxes:BookingTaxAmount[]
}