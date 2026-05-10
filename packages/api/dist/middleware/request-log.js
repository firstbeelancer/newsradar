import pinoHttp from "pino-http";
import { sanitizeSecrets } from "../lib/sanitizer.js";
export const requestLogger = pinoHttp({
    name: "api",
    serializers: {
        req: (req) => sanitizeSecrets({
            id: req.id,
            method: req.method,
            url: req.url,
            headers: req.headers,
            remoteAddress: req.remoteAddress,
        }),
        res: (res) => sanitizeSecrets({
            statusCode: res.statusCode,
            headers: res.headers,
        }),
    },
});
//# sourceMappingURL=request-log.js.map