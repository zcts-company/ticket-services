import { XmlAddress } from "./XmlAddress.js";
import { XmlOrderAttributes } from "./XmlOrderAttributes.js";
import { XmlOrderStatus } from "./XmlOrderStatus.js";
import { XmlXmlCorpUser } from "./XmlXmlCorpUser.js";

export interface XmlOrderRsp {
  $: XmlOrderAttributes;
  Status: XmlOrderStatus;
  DueDate: string;
  CorpUser: XmlXmlCorpUser;
  CostWithVat: string;
  FinishedDate: string;
  VehiclePickupAddress: XmlAddress;
  DestinationAddress: XmlAddress;
  Id: string;
  Cost: string;
  Tariff: string;
}