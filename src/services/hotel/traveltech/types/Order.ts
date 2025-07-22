import { Client } from "pg";
import { Guest } from "./response/Guest";

export type Order = {
      id: number;
      created: string;
      id_state: number;
      id_type: number;
      startDate: string;
      endDate: string;
      dateChanged: string;
      documents: {
        type: string;
        caption: string;
        fileName: string;
        url: string;
      }[];
      guests: Guest[];
      client: Client;
      billing: {
        billNumber: string;
        payed: {
          total: number;
          currencyCode: string;
        };
        price: {
          total: number;
          currencyCode: string;
        };
        refund: {
          wasRefunded: boolean;
          date: string;
          price: {
            total: number;
            currencyCode: string;
          };
        };
        payTillDate: string;
        paymentType: {
          withBankTransfer: boolean;
          withAgreementAtHotel: boolean;
          withCardAtHotel: boolean;
          withCardOnline: boolean;
        };
        vat: {
          applicable: boolean;
        };
      };
    };