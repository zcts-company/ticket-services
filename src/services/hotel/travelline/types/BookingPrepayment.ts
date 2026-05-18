import { PaymentTypeEnum } from "./PaymentTypeEnum.js"

export type BookingPrepayment = {
    remark: string|null,
    paymentType: PaymentTypeEnum,
    prepaidSum: number
}