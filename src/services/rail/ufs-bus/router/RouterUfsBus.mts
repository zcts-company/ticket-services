import express, { Response } from "express";
import { webHookService } from "./WedHookService.mjs";

export const routerUfsBus = express.Router();

routerUfsBus.use("/load-service",webHookService)