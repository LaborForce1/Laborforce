import { Router } from "express";
import { demoQuickCash } from "../../utils/demoData.js";

export const quickCashRouter = Router();

quickCashRouter.get("/", (_req, res) => {
  res.json({
    radiusMiles: 35,
    items: demoQuickCash
  });
});

