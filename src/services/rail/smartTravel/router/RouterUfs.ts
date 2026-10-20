import express, { Response } from "express";
import { webHookService } from "./WedHookService.js";

export const routerSmartTravel = express.Router();

routerSmartTravel.use("/load-service",webHookService)