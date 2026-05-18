import express, { Response } from "express";
import { loadService } from "./LoadService.js";

export const routerYandex = express.Router();

routerYandex.use("/load-service",loadService)