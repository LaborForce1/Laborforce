import { Router } from "express";

export const alertsRouter = Router();

alertsRouter.get("/summary", (_req, res) => {
  res.json({
    applicationResponseWarningHours: 48,
    autoReviewRequestHours: 24,
    overdueCrmInactivityDays: 30
  });
});

