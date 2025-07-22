import { LanguageType } from "../../../../model/LanguageType"
import { OrderingBy } from "./OrderingBy"
import { OrderingType } from "./OrderingType"

export type OrderInfoRQ = {
        ordering: {
            ordering_type: OrderingType
            ordering_by: OrderingBy
        },
        pagination: {
            page_size: string,
            page_number: string
        }, 
        search: {
              created_at: {
                from_date: string //"2024-08-07T00:00"
              }
          },
        language:LanguageType
}