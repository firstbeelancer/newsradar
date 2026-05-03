import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, refreshTokens } from "../../db/schema.js";
import { hashToken } from "../../lib/encryption.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/error-handler.js";
import type { RegisterInput, LoginInput } from "./schemas.js";

const SALT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(input: RegisterInput): Promise<{ userId: string; tokens: AuthTokens }> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });
  if (existing) {
    throw new AppError(409, "Email already registered", "EMAIL_EXISTS");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      name: input.name,
    })
    .returning();

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken(user.id);
  const tokenHash = hashToken(refreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return {
    userId: user.id,
    tokens: { accessToken, refreshToken },
  };
}

export async function loginUser(input: LoginInput): Promise<{ userId: string; tokens: AuthTokens }> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });
  if (!user || !user.passwordHash) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken(user.id);
  const tokenHash = hashToken(refreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return {
    userId: user.id,
    tokens: { accessToken, refreshToken },
  };
}

export async function rotateRefreshToken(refreshToken: string): Promise<AuthTokens> {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const tokenHash = hashToken(refreshToken);

  const stored = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, tokenHash),
  });

  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError(401, "Refresh token expired or revoked", "INVALID_REFRESH_TOKEN");
  }

  await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
  });
  if (!user) {
    throw new AppError(401, "User not found", "INVALID_REFRESH_TOKEN");
  }

  const newAccessToken = signAccessToken({ sub: user.id, email: user.email });
  const newRefreshToken = signRefreshToken(user.id);
  const newTokenHash = hashToken(newRefreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: newTokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    const tokenHash = hashToken(refreshToken);
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  } catch {
    // Best-effort: ignore errors on logout
  }
}

export async function findOrCreateOAuthUser(params: {
  email: string;
  name?: string;
  googleId?: string;
  yandexId?: string;
}): Promise<{ userId: string; tokens: AuthTokens }> {
  let user = params.googleId
    ? await db.query.users.findFirst({ where: eq(users.googleId, params.googleId) })
    : params.yandexId
      ? await db.query.users.findFirst({ where: eq(users.yandexId, params.yandexId) })
      : null;

  if (!user && params.email) {
    user = await db.query.users.findFirst({ where: eq(users.email, params.email) });
    if (user) {
      if (params.googleId) {
        await db.update(users).set({ googleId: params.googleId }).where(eq(users.id, user.id));
      } else if (params.yandexId) {
        await db.update(users).set({ yandexId: params.yandexId }).where(eq(users.id, user.id));
      }
    }
  }

  if (!user) {
    const [newUser] = await db
      .insert(users)
      .values({
        email: params.email,
        name: params.name ?? null,
        googleId: params.googleId ?? null,
        yandexId: params.yandexId ?? null,
      })
      .returning();
    user = newUser;
  }

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken(user.id);
  const tokenHash = hashToken(refreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return {
    userId: user.id,
    tokens: { accessToken, refreshToken },
  };
}
