import express, { Response } from "express";
import { webHookService } from "./WedHookService.mjs";

export const routerUfs = express.Router();

routerUfs.use("/load-service",webHookService)