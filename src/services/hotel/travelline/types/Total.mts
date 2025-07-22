import { BookingTaxAmount } from "./BookingTaxAmount.mjs"

export type Total = {
    total:{
        priceBeforeTax: number,
        taxAmount: number,
        taxes: BookingTaxAmount[]
    }
}