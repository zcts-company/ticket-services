import express, { Response } from "express";
import { routerTravelline } from "../services/hotel/travelline/router/RouterTravelline.js";
import { routerTraveltech } from "../services/hotel/traveltech/router/RouterTraveltech.js";
import { routerUfs } from "../services/rail/ufs/router/RouterUfs.js";
import { routerNemo } from "../services/air/nemo-travel/router/RouterNemo.js";
import { routerPanda } from "../services/hotel/panda/router/RouterPanda.js";
import { routerTTBooking } from "../services/air/ttbooking/router/RouterTTBooking.js";
import { routerUfsBus } from "../services/rail/ufs-bus/router/RouterUfsBus.js";
import { routerYandex } from "../services/taxi/yandex/router/RouterYandex.js";

export const mainRouter = express.Router();

mainRouter.use("/travelline",routerTravelline)
mainRouter.use("/yandex",routerYandex)
mainRouter.use("/traveltech",routerTraveltech)
mainRouter.use("/panda",routerPanda)
mainRouter.use('/nemo',routerNemo)
mainRouter.use('/ufs',routerUfs)
mainRouter.use('/ufs-bus',routerUfsBus)
mainRouter.use('/ttbooking',routerTTBooking)