import { Router } from "express";
import { demoSocial } from "../../utils/demoData.js";

export const socialRouter = Router();

socialRouter.get("/feed", (_req, res) => {
  res.json({
    audience: "local",
    reactions: ["Respect", "Impressed", "Helpful"],
    items: demoSocial
  });
});

