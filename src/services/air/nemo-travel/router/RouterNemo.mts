import express, { Response } from "express";
import { callback } from "./Callback.mjs";

export const routerNemo = express.Router();

routerNemo.use("/service",callback)