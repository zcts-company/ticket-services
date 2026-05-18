import express, { Response } from "express";
import { callback } from "./Callback.js";

export const routerNemo = express.Router();

routerNemo.use("/service",callback)