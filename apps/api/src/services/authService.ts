import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const authService = {
  async hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  },
  async comparePassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  },
  createAccessToken(userId: string) {
    return jwt.sign({ sub: userId, type: "access" }, env.JWT_SECRET, { expiresIn: "15m" });
  },
  createRefreshToken(userId: string) {
    return jwt.sign({ sub: userId, type: "refresh" }, env.JWT_REFRESH_SECRET, { expiresIn: "30d" });
  },
  verifyAccessToken(token: string) {
    return jwt.verify(token, env.JWT_SECRET) as { sub: string; type: "access" };
  }
};

