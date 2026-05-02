import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ACCESS_TTL = "15m";

export interface TokenPayload {
  sub: string;
  email: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TTL,
    issuer: "newsradar",
    audience: "newsradar-api",
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: "newsradar",
    audience: "newsradar-api",
  }) as TokenPayload;
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: "7d",
    issuer: "newsradar",
    audience: "newsradar-refresh",
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: "newsradar",
    audience: "newsradar-refresh",
  }) as { sub: string };
}
