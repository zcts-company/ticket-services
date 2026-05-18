import { BookingTaxAmount } from "./BookingTaxAmount.js"

export type Total = {
    total:{
        priceBeforeTax: number,
        taxAmount: number,
        taxes: BookingTaxAmount[]
    }
}