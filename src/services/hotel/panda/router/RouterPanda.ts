import express, { Response } from "express";
import { loadService } from "./LoadServicce.js";

export const routerPanda = express.Router();

routerPanda.use("/load-service",loadService)