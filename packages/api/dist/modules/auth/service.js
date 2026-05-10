import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, refreshTokens, workspaces } from "../../db/schema.js";
import { hashToken } from "../../lib/encryption.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/error-handler.js";
const SALT_ROUNDS = 12;
function toAuthUser(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name ?? user.email.split("@")[0],
        role: "user",
    };
}
async function ensureWorkspace(userId, fallbackName) {
    const existing = await db.query.workspaces.findFirst({
        where: eq(workspaces.userId, userId),
    });
    if (existing)
        return existing;
    const [workspace] = await db
        .insert(workspaces)
        .values({
        userId,
        name: `${fallbackName || "Newsradar"} workspace`,
        plan: "free",
    })
        .returning();
    return workspace;
}
async function issueTokens(user) {
    const accessToken = signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = signRefreshToken(user.id);
    const tokenHash = hashToken(refreshToken);
    await db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return { accessToken, refreshToken };
}
export async function registerUser(input) {
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
    const workspace = await ensureWorkspace(user.id, input.name);
    const tokens = await issueTokens(user);
    return {
        user: toAuthUser(user),
        userId: user.id,
        workspaceId: workspace.id,
        tokens,
    };
}
export async function loginUser(input) {
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
    const authUser = toAuthUser(user);
    const workspace = await ensureWorkspace(user.id, authUser.name);
    const tokens = await issueTokens(user);
    return {
        user: authUser,
        userId: user.id,
        workspaceId: workspace.id,
        tokens,
    };
}
export async function rotateRefreshToken(refreshToken) {
    let payload;
    try {
        payload = verifyRefreshToken(refreshToken);
    }
    catch {
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
    return issueTokens(user);
}
export async function revokeRefreshToken(refreshToken) {
    try {
        const tokenHash = hashToken(refreshToken);
        await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
    }
    catch {
        // Best-effort: ignore errors on logout
    }
}
export async function findOrCreateOAuthUser(params) {
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
            }
            else if (params.yandexId) {
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
    const authUser = toAuthUser(user);
    const workspace = await ensureWorkspace(user.id, authUser.name);
    const tokens = await issueTokens(user);
    return {
        user: authUser,
        userId: user.id,
        workspaceId: workspace.id,
        tokens,
    };
}
//# sourceMappingURL=service.js.map