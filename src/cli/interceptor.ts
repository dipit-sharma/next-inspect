import { readFile } from "fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { extname, resolve } from "path";
import { setupGlobalAxiosInterceptor } from "../interceptor/axiosInterceptor";
import { createWebSocketHub } from "../ws-hub/websocket";

const port = Number(process.env.NEXT_INSPECT_PORT ?? "8757");
const host = process.env.NEXT_INSPECT_HOST ?? "0.0.0.0";
const path = process.env.NEXT_INSPECT_WS_PATH ?? "/ws";
const allowedOriginsRaw = process.env.NEXT_INSPECT_WS_ALLOWED_ORIGINS ?? "*";
const dashboardDir = resolve(__dirname, "../dashboard");

const CONTENT_TYPE: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
};

function parseAllowedOrigins(rawValue: string): "*" | string[] {
    const trimmed = rawValue.trim();
    if (!trimmed || trimmed === "*") {
        return "*";
    }

    const parsedOrigins = trimmed
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

    return parsedOrigins.length > 0 ? parsedOrigins : "*";
}

function resolveDashboardFilePath(rawUrl: string | undefined): string {
    const url = rawUrl ?? "/";
    const pathname = decodeURIComponent(url.split("?")[0] ?? "/");
    const normalizedPath = pathname === "/" ? "/index.html" : pathname;
    return resolve(dashboardDir, `.${normalizedPath}`);
}

async function handleDashboardRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.statusCode = 405;
        res.end("Method Not Allowed");
        return;
    }

    const filePath = resolveDashboardFilePath(req.url);
    if (!filePath.startsWith(dashboardDir)) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
    }

    try {
        const content = await readFile(filePath);
        const extension = extname(filePath).toLowerCase();

        res.statusCode = 200;
        res.setHeader("Content-Type", CONTENT_TYPE[extension] ?? "application/octet-stream");
        if (req.method === "HEAD") {
            res.end();
            return;
        }
        res.end(content);
    } catch {
        res.statusCode = 404;
        res.end("Not Found");
    }
}

export async function runInterceptor(): Promise<void> {
    const allowedOrigins = parseAllowedOrigins(allowedOriginsRaw);

    const server = createServer((req, res) => {
        void handleDashboardRequest(req, res);
    });

    await new Promise<void>((resolvePromise, rejectPromise) => {
        server.once("error", rejectPromise);
        server.listen(port, host, () => {
            resolvePromise();
        });
    });

    const hub = createWebSocketHub({ server, path, allowedOrigins });
    await hub.start();

    const webSocketHost = host === "0.0.0.0" ? "127.0.0.1" : host;
    const websocketUrl = `ws://${webSocketHost}:${port}${path}`;
    setupGlobalAxiosInterceptor({ websocketUrl });

    process.stdout.write(`next-inspect dashboard is running at http://${host}:${port}\n`);
    process.stdout.write(`next-inspect websocket is running at ws://${webSocketHost}:${port}${path}\n`);
    process.stdout.write(
        `next-inspect websocket allowed origins: ${allowedOrigins === "*" ? "*" : allowedOrigins.join(", ")}\n`
    );

    const shutdown = async () => {
        process.stdout.write("Shutting down next-inspect interceptor...\n");
        await hub.stop();
        await new Promise<void>((resolvePromise, rejectPromise) => {
            server.close((error?: Error) => {
                if (error) {
                    rejectPromise(error);
                    return;
                }
                resolvePromise();
            });
        });
        process.exit(0);
    };

    process.on("SIGINT", () => {
        void shutdown();
    });

    process.on("SIGTERM", () => {
        void shutdown();
    });
}

if (require.main === module) {
    void runInterceptor().catch((error: unknown) => {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        process.stderr.write(`Failed to start next-inspect interceptor: ${message}\n`);
        process.exit(1);
    });
}
