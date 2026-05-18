import Joi, { object } from "joi";
const {date} = Joi.types()

export const nemoOrder = Joi.object({
    method:Joi.string(),
    apiVersion: Joi.string(),
    params:Joi.object(),
    data:Joi.object().keys({
        system:Joi.string(),
        orderType:Joi.string(),
        id:Joi.number().required(),
        lastModifiedDate:date.iso().required(),
        currentServerDate:date.iso().required(),
        customer:Joi.object(),
        passengers:Joi.object(),
        products:Joi.object(),
        price:Joi.object(),
        linkedOrders:Joi.object(),
        payments:Joi.array(),
        documents:Joi.alternatives().try(
            Joi.object(),
            Joi.array().min(1)
        ),
        currencyRates:Joi.array()
    }).required(),
    multiOrderEnvelope:Joi.number(),
    exchangeClaims:Joi.object(),
    returnClaims:Joi.object(),
    taxes:Joi.object()
}) 