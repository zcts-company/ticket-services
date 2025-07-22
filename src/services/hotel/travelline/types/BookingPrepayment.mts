import { PaymentTypeEnum } from "./PaymentTypeEnum.mjs"

export type BookingPrepayment = {
    remark: string|null,
    paymentType: PaymentTypeEnum,
    prepaidSum: number
}