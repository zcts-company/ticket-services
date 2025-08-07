import express, { Response } from "express";
import { routerTravelline } from "../services/hotel/travelline/router/RouterTravelline.mjs";
import { routerTraveltech } from "../services/hotel/traveltech/router/RouterTraveltech.mjs";
import { routerUfs } from "../services/rail/ufs/router/RouterUfs.mjs";
import { routerNemo } from "../services/air/nemo-travel/router/RouterNemo.mjs";
import { routerPanda } from "../services/hotel/panda/router/RouterPanda.mjs";

export const mainRouter = express.Router();

mainRouter.use("/travelline",routerTravelline)
mainRouter.use("/traveltech",routerTraveltech)
mainRouter.use("/panda",routerPanda)
mainRouter.use('/nemo',routerNemo)
mainRouter.use('/ufs',routerUfs)