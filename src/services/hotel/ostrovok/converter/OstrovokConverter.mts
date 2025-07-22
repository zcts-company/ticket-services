import { Guests1C, Order1C, Price } from "../../../../model/Order1CTypeHotel";
import { AmountPayable, AmountSellB2b2c, OrderInfoDataRS, OrderProvider, OrdersInfoRS, RoomsData } from "../model/OrdersInfoRS";
import config from "../../../../config/hotel/ostrovok.json" assert {type: 'json'} 
import { HotelInfoRS } from "../model/HotelInfoRS";


export class OstrovokConverter {


    toOrder1C(order:OrderProvider,hotelInfo:HotelInfoRS): Order1C{
        
        const order1C:Order1C = this.getOrder(order,hotelInfo);
        
        return order1C;

    }

    //Order1C
    private getOrder(order: OrderProvider,hotelInfo:HotelInfoRS): any {
        return {
            Number:order.order_id.toString(),
            Checkin: new Date(order.checkin_at),
            Checkout:new Date(order.checkout_at),
            City:"no",
            HotelName:"no",
            HotelId:order.hotel_data.id,
            Commission:{
                Amount:this.getAmountComission(order.amount_sell_b2b2c,order.amount_payable),
                Currency:order.amount_payable.currency_code, // берем валюту комиссии из основного поля по оплате
                VatIncluded:false,
                VatPercent:0
            },
            Guests:this.getGuest(order.rooms_data),
            CreatedDatetime:new Date(order.created_at),
            InvoiceNumber:order.invoice_id,
            ProviderType:config.nameProvider,
            TotalPrice:this.getTotalPrice(order),
            ProviderClientId:config.auth.LTD,
            StatusName:order.status,
            RoomCount: order.rooms_data ? order.rooms_data.length : 0,
            Country:hotelInfo.data.region.country_code // todo сопоставить код и название страны
        
        }
    }
    getTotalPrice(order: OrderProvider): Price {
        return {
            Amount:Number.parseFloat(order.amount_payable.amount),
            Currency:order.amount_payable.currency_code,
            VatIncluded:Number.parseFloat(order.amount_payable_vat.amount) > 0,
            VatAmount:Number.parseFloat(order.amount_payable_vat.amount),
        }
    }



    getGuest(rooms_data: RoomsData[]): Guests1C[] {
        const result:Guests1C[] = []

        rooms_data.forEach(room => {
            room.guest_data.guests.forEach(guest => {
                const res:Guests1C = {
                    string:`${guest.first_name} ${guest.last_name}`
                }
                result.push(res)
            })
        })

        return result;
    }


    private getAmountComission(amount_sell_b2b2c: AmountSellB2b2c, amount_payable: AmountPayable): number {
        

        return Number.parseFloat(amount_sell_b2b2c.amount)  - Number.parseFloat(amount_payable.amount);
    }

}