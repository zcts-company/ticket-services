export type AirTicketDoc = {
    $: {
        tkt_oper: string;
        tkt_date: string;
        tkt_number: string;
        no_conj_tickets?: string;
        prod_id: string;
        psgr_id: string;
    }
}