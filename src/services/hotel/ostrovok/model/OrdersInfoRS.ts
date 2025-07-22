export interface OrdersInfoRS {
    data: OrderInfoDataRS
    debug: any
    error: any
    status: string
  }
  
  export interface OrderInfoDataRS {
    current_page_number: number
    found_orders: number
    found_pages: number
    orders: OrderProvider[]
    total_orders: number
    total_pages: number
  }
  
  export interface OrderProvider {
    agreement_number: string
    amount_payable: AmountPayable
    amount_payable_vat: AmountPayableVat
    amount_payable_with_upsells: AmountPayableWithUpsells
    amount_refunded: AmountRefunded
    amount_sell: AmountSell
    amount_sell_b2b2c: AmountSellB2b2c
    api_auth_key_id: any
    cancellation_info: CancellationInfo
    cancelled_at: any
    checkin_at: string
    checkout_at: string
    contract_slug: string
    created_at: string
    has_tickets: boolean
    hotel_data: HotelData
    invoice_id: any
    is_cancellable: boolean
    is_checked: boolean
    meta_data: MetaData
    modified_at: string
    nights: number
    order_id: number
    order_type: string
    partner_data: PartnerData
    payment_data: PaymentData
    roomnights: number
    rooms_data: RoomsData[]
    source: string
    status: string
    supplier_data: SupplierData
    taxes: Tax[]
    total_vat: TotalVat
    upsells: any[]
    user_data: UserData
  }
  
  export interface AmountPayable {
    amount: string
    currency_code: string
  }
  
  export interface AmountPayableVat {
    amount: string
    currency_code: string
  }
  
  export interface AmountPayableWithUpsells {
    amount: string
    currency_code: string
  }
  
  export interface AmountRefunded {
    amount: string
    currency_code: string
  }
  
  export interface AmountSell {
    amount: string
    currency_code: string
  }
  
  export interface AmountSellB2b2c {
    amount: string
    currency_code: string
  }
  
  export interface CancellationInfo {
    free_cancellation_before?: string
    policies: Policy[]
  }
  
  export interface Policy {
    end_at?: string
    penalty: Penalty
    start_at?: string
  }
  
  export interface Penalty {
    amount: string
    amount_info: AmountInfo
    currency_code: string
  }
  
  export interface AmountInfo {
    amount_commission: string
    amount_gross: string
    amount_net: string
  }
  
  export interface HotelData {
    id: string
    order_id: any
  }
  
  export interface MetaData {
    voucher_order_comment: any
  }
  
  export interface PartnerData {
    order_comment: any
    order_id: string
  }
  
  export interface PaymentData {
    invoice_id: any
    invoice_id_v2: any
    paid_at: any
    payment_by: any
    payment_due: string
    payment_pending: string
    payment_type: string
  }
  
  export interface RoomsData {
    bedding_name: string[]
    guest_data: GuestData
    meal_name: string
    room_idx: number
    room_name: string
  }
  
  export interface GuestData {
    adults_number: number
    children_number: number
    guests: Guest[]
  }
  
  export interface Guest {
    age: any
    first_name: string
    first_name_original: string
    is_child: boolean
    last_name: string
    last_name_original: string
  }
  
  export interface SupplierData {
    confirmation_id: string
    name: any
    order_id: string
  }
  
  export interface Tax {
    amount_tax: AmountTax
    is_included: boolean
    name: string
  }
  
  export interface AmountTax {
    amount: string
    currency_code: string
  }
  
  export interface TotalVat {
    amount: string
    currency_code: string
    included: boolean
  }
  
  export interface UserData {
    arrival_datetime: any
    email: string
    user_comment: any
  }
  