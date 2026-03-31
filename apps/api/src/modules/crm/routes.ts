import { Router } from "express";
import { demoCRM } from "../../utils/demoData.js";
import { pipelineStages } from "@laborforce/shared";

export const crmRouter = Router();

crmRouter.get("/pipeline", (_req, res) => {
  res.json({
    stages: pipelineStages.map((stage) => ({
      stage,
      items: demoCRM.filter((contact) => contact.pipelineStage === stage)
    }))
  });
});

