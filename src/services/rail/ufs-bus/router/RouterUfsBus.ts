import express, { Response } from "express";
import { webHookService } from "./WedHookService.js";

export const routerUfsBus = express.Router();

routerUfsBus.use("/load-service",webHookService)