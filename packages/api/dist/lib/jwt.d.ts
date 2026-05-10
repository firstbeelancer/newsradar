export interface TokenPayload {
    sub: string;
    email: string;
}
export declare function signAccessToken(payload: TokenPayload): string;
export declare function verifyAccessToken(token: string): TokenPayload;
export declare function signRefreshToken(userId: string): string;
export declare function verifyRefreshToken(token: string): {
    sub: string;
};
//# sourceMappingURL=jwt.d.ts.map