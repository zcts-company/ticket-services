
import { Address } from "./Adress.js";
import { CostCenterValue } from "./CostCenterValue.js";
import { YandexUserProfile } from "./YandexUserProfile.js";

export interface YandexTaxiOrder {
  id: string;
  user_id: string;
  status: "complete" | "cancelled" | string; // Можно расширить список статусов
  class: string;
  source: Address;
  interim_destinations?: Address[]; // Промежуточные точки
  destination: Address;
  cost_center_values: CostCenterValue[];
  due_date: string;       // ISO Date string
  finished_date: string;  // ISO Date string
  cost: number;
  cost_with_vat: number;
  userProfile?:YandexUserProfile
}