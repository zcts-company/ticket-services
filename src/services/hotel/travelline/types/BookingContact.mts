import { Email } from "./Email.mjs"
import { Phone } from "./Phone.mjs"

export type BookingContact = {
    description:string,
    phones:Phone[],
    emails:Email[]
}