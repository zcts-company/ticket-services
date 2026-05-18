import { Geopoint } from "./GeoPoint.js";


export interface Address {
  address_id: string;
  fullname: string;
  geopoint: Geopoint;
  locale: string;
  porchnumber?: string; // Необязательный, так как есть не везде
}

