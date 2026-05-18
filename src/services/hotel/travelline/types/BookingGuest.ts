import { SexEnum } from "./SexEnum.js"

export type BookingGuest = {
    
    sex: SexEnum,
    firstName: string,
    lastName: string,
    middleName: string,
    citizenship: string|null
}