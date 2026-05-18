import { YandexUserLimit } from "./YandexUserLimit.js";


export interface YandexUserProfile {
  id: string;
  fullname: string;
  nickname: string;
  email: string;
  phone: string;
  is_active: boolean;
  is_deleted: boolean;
  cost_center: string;
  cost_centers_id: string;
  department_id: string;
  client_id: string;
  limits: YandexUserLimit[];
}