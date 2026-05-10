import type { RegisterInput, LoginInput } from "./schemas.js";
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: "user";
}
export interface AuthResult {
    user: AuthUser;
    userId: string;
    workspaceId: string;
    tokens: AuthTokens;
}
export declare function registerUser(input: RegisterInput): Promise<AuthResult>;
export declare function loginUser(input: LoginInput): Promise<AuthResult>;
export declare function rotateRefreshToken(refreshToken: string): Promise<AuthTokens>;
export declare function revokeRefreshToken(refreshToken: string): Promise<void>;
export declare function findOrCreateOAuthUser(params: {
    email: string;
    name?: string;
    googleId?: string;
    yandexId?: string;
}): Promise<AuthResult>;
//# sourceMappingURL=service.d.ts.map