import { Geo } from "./Geo";
import { PrimaryServices } from "./PrimaryServices";

export type Hotel = {
      description: string;
      email: string;
      url: string;
      photos: string[];
      defaults: {
        checkIn: string;
        checkOut: string;
      };
      specialRemark: string;
      name: string;
      thumbnailUrl: string;
      phone: string;
      stars: number;
      geo: Geo;
      hotelType: string;
      services: {
        primary: PrimaryServices;
        secondary: {
          facilities: string[] | null;
        };
      };
      officialCertificate: string;
    };