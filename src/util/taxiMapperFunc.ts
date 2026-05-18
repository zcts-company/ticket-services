import { IMappedYandexOrderXml } from "../services/taxi/yandex/types/mapped/IMappedYandexOrderXml.js";
import { YandexTaxiOrder } from "../services/taxi/yandex/types/response/YandexTaxiOrder.js";
import { YandexTaxiOrderInfo } from "../services/taxi/yandex/types/response/YandexTaxiOrderInfo.js";


export function mapOrderToXmlStructure(order: YandexTaxiOrder): IMappedYandexOrderXml {
    // Небольшой хелпер для статусов (например, complete -> finished)
    const mapStatus = (status: string) => {
        if (status === 'complete') return 'finished';
        return status;
    };

    const statusValue = mapStatus(order.status);

    return {
        OrderRsp: {
            // Атрибуты корневого элемента
            $: {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'xmlns': 'http://zcts.yandextaxi.ru/OrderRsp'
            },
            Status: {
                Simple: statusValue,
                Full: order.status // Если логика требует разделения, можно доработать
            },
            DueDate: order.due_date,
            CorpUser: {
                Id: order.userProfile?.id || '',
                OrganizationId: order.userProfile?.department_id || '',
                Name: order.userProfile?.fullname || ''
            },
            CostWithVat: order.cost_with_vat ? order.cost_with_vat.toFixed(2) : '0.00',
            FinishedDate: order.finished_date || '',
            VehiclePickupAddress: {
                Full: order.source?.fullname || ''
            },
            DestinationAddress: {
                Full: order.destination?.fullname || ''
            },
            Id: order.id,
            Cost: order.cost ? order.cost.toFixed(1) : '0.0',
            // Маппинг класса авто. При необходимости можно сделать словарь соответствий
            Tariff: order.class === 'standart_b2b' ? 'standard' : order.class
        }
    };
}