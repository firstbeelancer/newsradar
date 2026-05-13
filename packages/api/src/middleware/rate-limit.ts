import rateLimit from "express-rate-limit";

export const generalRateLimit = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.ip ?? "unknown"),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" },
    });
  },
});

export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.ip ?? "unknown"),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { code: "AUTH_RATE_LIMITED", message: "Too many auth attempts, please try again later" },
    });
  },
  skipSuccessfulRequests: false,
});
