import { BookingTaxAmount } from "./BookingTaxAmount.mjs"

export type ExtraStayTotal = {
    priceBeforeTax:number,
    taxAmount:number,
    taxes:BookingTaxAmount[]
}