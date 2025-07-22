import express, { Response } from "express";
import { loadService } from "./LoadService.mjs";

export const routerTravelline = express.Router();

routerTravelline.use("/load-service",loadService)