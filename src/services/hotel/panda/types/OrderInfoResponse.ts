export type OrderInfoResponse = {
  OrderInfoResponse: {
    $: {
      Id: string;
      ReferenceNumber: string;
      RegistrationDate: string;
      Price: string;
      StartDate: string;
      EndDate: string;
      DeadlineDate: string;
      PossiblePenalty: string;
    };

    Success: string;

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

    AccommodationList: {
      Accommodation: Accommodation;
    };

    ServiceList?: {
      Service: Service[]; 
    };

    DocumentList: {
      Document: Document;
    };
  };
}

export type Accommodation = {
  $: {
    Id: string;
    RoomIndex: string;
    ArrivalDate: string;
    ArrivalTime: string;
    DepartureDate: string;
    DepartureTime: string;
    Price: string;
    InvoiceId: string;
  };

  Hotel: {
    $: {
      Code: string;
      Name: string;
    };
  };

  City: {
    $: {
      Code: string;
      Name: string;
    };
  };

  Country: {
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

  Product: {
    $: {
      Code: string;
      RoomName: string;
      RateName: string;
      RateDescription: string;
    };

    Allotment: {
      $: {
        Code: string;
        Name: string;
      };
    };
  };

  Persons: {
    Person: Person;
  };
}

export type Person = {
  $: {
    Id: string;
    Name: string;
    ReservationNumber: string;
    ArrivalDate: string;
    DepartureDate: string;
  };

  Category: {
    $: {
      Code: string;
      Name: string;
    };
  };
}

export type Service = {
  $: {
    Id: string;
    Name: string;
    Price: string;
    ServiceType: string;
    ServiceName: string;
    StartDate: string;
    EndDate: string;
    InvoiceId: string;
    PersonId: string;
  };
}

export type Document = {
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
}
