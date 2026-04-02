import { Router } from "express";
import { z } from "zod";
import { authService } from "../../services/authService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/http.js";
import { usersRepository } from "../users/repository.js";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().min(7),
  zipCode: z.string().min(3),
  userTag: z.enum(["employee", "employer", "customer"]),
  tradeType: z.string().optional(),
  businessName: z.string().min(2).max(120).optional()
});

export const authRouter = Router();

authRouter.post("/signup", asyncHandler(async (req, res) => {
  const payload = signupSchema.parse(req.body);
  const existingUser = await usersRepository.findByEmail(payload.email);

  if (existingUser) {
    throw new HttpError(409, "An account with that email already exists.");
  }

  const passwordHash = await authService.hashPassword(payload.password);
  const created = await usersRepository.create({
    email: payload.email,
    passwordHash,
    fullName: payload.fullName,
    phone: payload.phone,
    zipCode: payload.zipCode,
    userTag: payload.userTag,
    tradeType: payload.tradeType,
    businessName: payload.businessName
  });
  const accessToken = authService.createAccessToken(created.user.id);
  const refreshToken = authService.createRefreshToken(created.user.id);

  res.status(201).json({
    user: created.user,
    credentials: {
      accessToken,
      refreshToken
    }
  });
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = z.object({
    email: z.string().email(),
    password: z.string().min(8)
  }).parse(req.body);

  const existingUser = await usersRepository.findByEmail(email);

  if (!existingUser) {
    throw new HttpError(401, "Invalid credentials.");
  }

  const passwordValid = await authService.comparePassword(password, existingUser.passwordHash);

  if (!passwordValid) {
    throw new HttpError(401, "Invalid credentials.");
  }

  res.json({
    user: existingUser.user,
    credentials: {
      accessToken: authService.createAccessToken(existingUser.user.id),
      refreshToken: authService.createRefreshToken(existingUser.user.id)
    }
  });
}));
