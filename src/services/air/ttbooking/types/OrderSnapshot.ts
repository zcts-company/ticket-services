import { Customer } from "./Customer";
import { Header } from "./Header";
import { Manager } from "./Manager";
import { Passenger } from "./Passenger";
import { Payment } from "./Payment";
import { Product } from "./Product";
import { Reservation } from "./Reservation";
import { TravelDoc } from "./TravelDoc";

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










