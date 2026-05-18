import { Customer } from "./Customer.js";
import { Header } from "./Header.js";
import { Manager } from "./Manager.js";
import { Passenger } from "./Passenger.js";
import { Payment } from "./Payment.js";
import { Product } from "./Product.js";
import { Reservation } from "./Reservation.js";
import { TravelDoc } from "./TravelDoc.js";

export type OrderSnapshot = {
  order_snapshot: {
    header: Header;
    customer: Customer;
    manager: Manager;
    products: { product: Product[] | Product };
    reservations: { reservation: Reservation[] | Reservation };
    passengers: { passenger: Passenger[] | Passenger };
    travel_docs: { travel_doc: TravelDoc[] | TravelDoc };
    payments: { payment: Payment[] | Payment };
  };
}










