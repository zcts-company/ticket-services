import { SexEnum } from "./SexEnum.mjs"

export type BookingGuest = {
    
    sex: SexEnum,
    firstName: string,
    lastName: string,
    middleName: string,
    citizenship: string|null
}