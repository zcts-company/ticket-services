import { AirSegment } from "./AirSegment.js";
import { Fee } from "./Fee.js";

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