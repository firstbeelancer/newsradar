import { Router, type Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as YandexStrategy } from "passport-yandex";

import { env } from "../../config/env.js";
import { AppError } from "../../middleware/error-handler.js";
import { authRateLimit } from "../../middleware/rate-limit.js";

import {
  registerUser,
  loginUser,
  rotateRefreshToken,
  revokeRefreshToken,
  findOrCreateOAuthUser,
} from "./service.js";
import { registerSchema, loginSchema } from "./schemas.js";

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("refresh_token", refreshToken, COOKIE_OPTIONS);
  res.cookie("access_token", accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000,
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie("refresh_token");
  res.clearCookie("access_token");
}

function makeAuthPayload(result: Awaited<ReturnType<typeof registerUser>>) {
  return {
    user: result.user,
    userId: result.userId,
    workspaceId: result.workspaceId,
    accessToken: result.tokens.accessToken,
    access_token: result.tokens.accessToken,
  };
}

// Passport OAuth setup
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/v1/auth/google/callback",
      },
      (_accessToken, _refreshToken, profile, done) => {
        done(null, {
          email: profile.emails?.[0]?.value ?? "",
          name: profile.displayName,
          googleId: profile.id,
        });
      }
    )
  );
}

if (env.YANDEX_CLIENT_ID && env.YANDEX_CLIENT_SECRET) {
  passport.use(
    new YandexStrategy(
      {
        clientID: env.YANDEX_CLIENT_ID,
        clientSecret: env.YANDEX_CLIENT_SECRET,
        callbackURL: "/api/v1/auth/yandex/callback",
      },
      (_accessToken, _refreshToken, profile, done) => {
        done(null, {
          email: profile.emails?.[0]?.value ?? "",
          name: profile.displayName,
          yandexId: profile.id,
        });
      }
    )
  );
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj as Express.User));

// Register
router.post("/register", authRateLimit, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);
    setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    res.status(201).json({
      success: true,
      data: makeAuthPayload(result),
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);
    setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    res.status(200).json({
      success: true,
      data: makeAuthPayload(result),
    });
  } catch (err) {
    next(err);
  }
});

// Refresh
router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token ?? req.body?.refreshToken;
    if (!refreshToken || typeof refreshToken !== "string") {
      throw new AppError(401, "Refresh token required", "INVALID_REFRESH_TOKEN");
    }
    const tokens = await rotateRefreshToken(refreshToken);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.status(200).json({
      success: true,
      data: { accessToken: tokens.accessToken, access_token: tokens.accessToken },
    });
  } catch (err) {
    clearAuthCookies(res);
    next(err);
  }
});

// Logout
router.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    clearAuthCookies(res);
    res.status(200).json({ success: true, data: { message: "Logged out" } });
  } catch (err) {
    next(err);
  }
});

// Google OAuth
router.get("/google", authRateLimit, (req, res, next) => {
  if (!env.GOOGLE_CLIENT_ID) {
    return next(new AppError(501, "Google OAuth not configured", "OAUTH_NOT_CONFIGURED"));
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

router.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", { session: false, failureRedirect: "/login" })(req, res, next);
  },
  async (req, res, next) => {
    try {
      const profile = req.user as { email: string; name?: string; googleId?: string; yandexId?: string };
      const result = await findOrCreateOAuthUser({
        email: profile.email,
        name: profile.name,
        googleId: profile.googleId,
      });
      setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
      res.redirect(`${req.protocol}://${req.get("host")}/`);
    } catch (err) {
      next(err);
    }
  }
);

// Yandex OAuth
router.get("/yandex", authRateLimit, (req, res, next) => {
  if (!env.YANDEX_CLIENT_ID) {
    return next(new AppError(501, "Yandex OAuth not configured", "OAUTH_NOT_CONFIGURED"));
  }
  passport.authenticate("yandex", { scope: [] })(req, res, next);
});

router.get(
  "/yandex/callback",
  (req, res, next) => {
    passport.authenticate("yandex", { session: false, failureRedirect: "/login" })(req, res, next);
  },
  async (req, res, next) => {
    try {
      const profile = req.user as { email: string; name?: string; googleId?: string; yandexId?: string };
      const result = await findOrCreateOAuthUser({
        email: profile.email,
        name: profile.name,
        yandexId: profile.yandexId,
      });
      setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
      res.redirect(`${req.protocol}://${req.get("host")}/`);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
