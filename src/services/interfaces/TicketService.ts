
export interface TicketService  {
    
    run(dateFrom:Date,dateTo:Date):void;
    getServiceName():string;
}