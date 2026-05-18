
export interface TicketServiceServer  {
    
    startServer():void;
    getServiceName():string;
    setCurrentArchiveDirectory(date:Date):void;

}