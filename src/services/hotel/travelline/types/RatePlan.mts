import { Vat } from "./Vat.mjs"

export type RatePlan = {
    name: string,
    description: string,
    vat: Vat,
    id: string
}