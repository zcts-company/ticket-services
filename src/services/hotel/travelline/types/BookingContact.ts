import { Email } from "./Email.js"
import { Phone } from "./Phone.js"

export type BookingContact = {
    description:string,
    phones:Phone[],
    emails:Email[]
}