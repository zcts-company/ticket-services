import { Vat } from "./Vat.js"

export type RoomStayService = {
    name: string,
    description: string,
    totalPrice: number,
    serviceTotal: {},
    inclusive: boolean,
    kind: string,
    mealPlanCode: string,
    mealPlanName: string,
    vat: Vat,
    id: string,
    quantity: number,
    quantityByGuests: {}
}