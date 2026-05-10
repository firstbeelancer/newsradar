const SECRET_KEYS = [
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "apiKey",
    "api_secret",
    "apiSecret",
    "secret",
    "secret_key",
    "private_key",
    "authorization",
    "cookie",
];
export function sanitizeSecrets(obj) {
    if (obj === null || obj === undefined)
        return obj;
    if (typeof obj === "string")
        return obj;
    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeSecrets(item));
    }
    if (typeof obj === "object") {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            if (SECRET_KEYS.some((sk) => lowerKey.includes(sk))) {
                result[key] = "***REDACTED***";
            }
            else if (typeof value === "object" && value !== null) {
                result[key] = sanitizeSecrets(value);
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    return obj;
}
//# sourceMappingURL=sanitizer.js.map