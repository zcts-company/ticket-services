import { AirSegment } from "./AirSegment";
import { Fee } from "./Fee";

export type AirTicketProd = {
    $: {
        prod_id: string;
        origin: string;
        destination: string;
        psg_type: string;
        fare: string;
        taxes: string;
        form_owner: string;
        validating_carrier: string;
        air_seg: AirSegment;
        fees: { fee: Fee[] | Fee };
    }
}