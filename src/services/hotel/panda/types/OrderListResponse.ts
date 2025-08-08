export type OrderListResponse = {
  OrderListResponse: {
    $: {
      date1: string;
      date2: string;
    };
    Orders: string | { Order: Order[] }; 
  };
};

export type Order = {
  $: {
    Id: string;
    Updated: string;
    ReferenceNumber: string;
    RegistrationDate: string;
    Price: string;
    StartDate: string;
    ArrivalTime: string;
    EndDate: string;
    DepartureTime: string;
  };

  Currency: {
    $: {
      Code: string;
      Name: string;
    };
  };

  Status: {
    $: {
      Id: string;
      Name: string;
    };
  };

  ContactPerson: {
    $: {
      Name: string;
      Phone: string;
      Fax: string;
      Email: string;
    };
  };

  DocumentList: {
    Document?: DocumentTypePanda | DocumentTypePanda[];
  };
};


export type DocumentTypePanda = {
  $: {
    Type: string;
    Number: string;
    Amount: string;
    VAT: string;
    VATPercent: string;
    VAT0: string;
    VAT_name: string;
    Url: string;
    Contract: string;
    INN: string;
    KPP: string;
    ContractNumber: string;
    Updated: string;
  };
};
