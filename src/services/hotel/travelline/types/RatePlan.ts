import { Vat } from "./Vat.js"

export type RatePlan = {
    name: string,
    description: string,
    vat: Vat,
    id: string
}