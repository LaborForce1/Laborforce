import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  const message = err instanceof Error ? err.message : "Unexpected server error.";
  return res.status(500).json({ error: message });
}
