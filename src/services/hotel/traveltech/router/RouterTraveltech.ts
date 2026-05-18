import express, { Response } from "express";
import { loadService } from "./LoadService.js";

export const routerTraveltech = express.Router();

routerTraveltech.use("/load-service",loadService)