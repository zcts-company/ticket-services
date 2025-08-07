import express, { Response } from "express";
import { loadService } from "./LoadServicce.mjs";

export const routerPanda = express.Router();

routerPanda.use("/load-service",loadService)