import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { usersRepository } from "./repository.js";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await usersRepository.findById(req.userId ?? "");
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  res.json(user);
}));

usersRouter.get("/", asyncHandler(async (_req, res) => {
  res.json(await usersRepository.list());
}));
