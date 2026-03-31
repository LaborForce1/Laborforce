import type { NextFunction, Request, Response } from "express";

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 120;

export function simpleRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const current = requestCounts.get(key);

  if (!current || current.resetAt <= now) {
    requestCounts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (current.count >= LIMIT) {
    return res.status(429).json({ error: "Rate limit exceeded." });
  }

  current.count += 1;
  requestCounts.set(key, current);
  return next();
}

