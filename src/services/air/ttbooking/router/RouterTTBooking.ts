import express, { Response } from "express";
import { webHookService } from "./WedHookService.js";

export const routerTTBooking = express.Router();

routerTTBooking.use("/load-service",webHookService)