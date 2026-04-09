import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { usersRepository } from "../users/repository.js";
import { alertsRepository } from "./repository.js";

export const alertsRouter = Router();

alertsRouter.get("/summary", (_req, res) => {
  res.json({
    applicationResponseWarningHours: 48,
    autoReviewRequestHours: 24,
    overdueCrmInactivityDays: 30
  });
});

alertsRouter.get("/", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }
  res.json(await alertsRepository.buildForUser(user));
}));
