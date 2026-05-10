import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
const ACCESS_TTL = "15m";
export function signAccessToken(payload) {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: ACCESS_TTL,
        issuer: "newsradar",
        audience: "newsradar-api",
    });
}
export function verifyAccessToken(token) {
    return jwt.verify(token, env.JWT_SECRET, {
        issuer: "newsradar",
        audience: "newsradar-api",
    });
}
export function signRefreshToken(userId) {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, {
        expiresIn: "7d",
        issuer: "newsradar",
        audience: "newsradar-refresh",
    });
}
export function verifyRefreshToken(token) {
    return jwt.verify(token, env.JWT_SECRET, {
        issuer: "newsradar",
        audience: "newsradar-refresh",
    });
}
//# sourceMappingURL=jwt.js.map