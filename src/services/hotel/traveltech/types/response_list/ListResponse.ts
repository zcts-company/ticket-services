export type ListResponse = {
  result: {
    page: number;
    size: number;
    total: number;
    orders: OrderEntry[];
  };
  errors: any[];
};

export type OrderEntry = {
  order: Order;
  hotel: Hotel;
  rate: Rate;
};

type Order = {
  id: number;
  created: string;
  id_state: number;
  id_type: number;
  startDate: string;
  endDate: string;
  dateChanged: string;
  documents: Document[] | {
    document:Document[]
  };
  guests: Guest[] | {
    guest: Guest[]
  };
  client: Client;
  billing: Billing;
};

type Document = {
  type: string;
  caption: string;
  fileName: string;
  url: string;
};

type Guest = {
  firstName: string;
  lastName: string;
  middleName: string;
  citizenShip: string;
  mobile: string;
  email: string;
  isChild: boolean;
  age: number;
  gender: boolean;
};

type Client = {
  user: {
    id: number;
    email: string;
  };
  profile: {
    id: string;
    name: string;
    finDocName: string;
  };
  agreement: {
    id: number;
    contractNumber: string;
    company: string;
  };
};

type Billing = {
  billNumber: string;
  payed: CurrencyAmount;
  price: CurrencyAmount;
  refund: {
    wasRefunded: boolean;
    date: string;
    price: CurrencyAmount;
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

type CurrencyAmount = {
  total: number;
  currencyCode: string;
};

type Hotel = {
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
  geo: {
    latitude: number;
    longitude: number;
    address: string;
    cityId: number;
  };
  hotelType: string;
  services: {
    primary: {
      hasInternet: boolean;
      hasFitness: boolean;
      hasParking: boolean;
      hasAirportTransfer: boolean;
      hasSpa: boolean;
      hasPool: boolean;
    };
    secondary: {
      facilities: any[];
    };
  };
  officialCertificate: string;
};

type Rate = {
  roomsAvailable: number;
  isOnRequest: boolean;
  is3D: boolean;
  isNonRefundable: boolean;
  timeZone: number;
  hasBreakfast: boolean;
  mealName: string;
  freeCancelationDate: string;
  sbo: {
    hotelId: number;
    mappedRateId: number;
    roomId: number;
    resortFee: number;
  };
  price: {
    currencyCode: string;
    total: number;
    priceFeatures: {
      comission: number;
      comissionPercent: number;
      bar: number;
    };
  };
  defaults: {
    checkIn: string;
    checkOut: string;
  };
  cancelationPolicies: CancelationPolicy[];
  rzpvInfo: RzpvInfo;
  room: Room;
};

type CancelationPolicy = {
  dateStart: string;
  fee: number;
  currencyCode: string;
};

type RzpvInfo = {
  automaticEarlyCheckin: boolean;
  automaticLateCheckout: boolean;
  earlyCheckinComment: string;
  lateCheckoutComment: string;
  checkInSurcharge: Record<string, unknown>;
  checkOutSurcharge: Record<string, unknown>;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
};

type Room = {
  name: string;
  description: string;
  photos: string[];
  services: {
    primary: {
      hasInternet: boolean;
      hasBathroom: boolean;
    };
    secondary: {
      facilities: any[];
    };
  };
};
