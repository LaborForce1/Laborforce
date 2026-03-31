import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/authService.js";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token." });
  }

  try {
    const payload = authService.verifyAccessToken(token);
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

