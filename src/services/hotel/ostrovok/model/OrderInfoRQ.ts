import { LanguageType } from "../../../../model/LanguageType.js"
import { OrderingBy } from "./OrderingBy.js"
import { OrderingType } from "./OrderingType.js"

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