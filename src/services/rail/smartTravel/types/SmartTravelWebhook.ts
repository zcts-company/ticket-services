export interface SmartTravelWebhook {
    OrderCustomers: SmartTravelCustomer[];
    PosSysName: string;
    EmployeeName: string;
    OrderItem: SmartTravelOrderItem;
}

export interface SmartTravelCustomer {
    OrderCustomerId: number;
    FirstName: string;
    MiddleName: string | null;
    LastName: string;

    [key: string]: unknown;
}

export interface SmartTravelOrderItem {
    OrderId: number;
    OrderItemId: number;
    ReservationNumber: string;
    OperationType: string;
    SimpleOperationStatus: string;
    DetailedOperationStatus: string;
    ServiceTypeInfo: string;
    Amount: number;

    OrderItemCustomers: Record<string, unknown>[];
    OrderItemBlanks: Record<string, unknown>[];

    [key: string]: unknown;
}