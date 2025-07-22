export interface Order1C {
    ProviderType:       string;
    ProviderClientId:   string;
    Number:             string;
    HotelId:            string;
    HotelName:          string;
    RoomId:             string;
    RoomType:           string;
    RoomTypeIds:        RoomTypeIDS;
    Checkin:            Date;
    Checkout:           Date;
    Guests:             Guests1C[];
    MealsIncluded:      string;
    City:               string;
    Country:            string;
    StatusName:         string;
    TotalPrice:         Price;
    Commission:         Price;
    CreatedDatetime:    Date;
    InvoiceNumber:      string;
    InvoiceDateCreated: Date;
    userdata:           Userdata;
    RoomCount:          number;
    Pdf?:                string;
    InvoisePdf?:         string;
}

export interface Price {
    Currency:    string;
    Amount:      number;
    VatPercent?:  number;
    VatIncluded?: boolean;
    VatAmount?:   number;
}

export interface Guests1C {
    string: string;
}

export interface RoomTypeIDS {
    string: string[];
}

export interface Userdata {
    email: string;
}
