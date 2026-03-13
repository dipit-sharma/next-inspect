import { readFile } from "fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { extname, resolve } from "path";
import { setupGlobalAxiosInterceptor } from "../interceptor/axiosInterceptor";
import { createWebSocketHub } from "../ws-hub/websocket";

const port = Number(process.env.NEXT_INSPECT_PORT ?? "8757");
const host = process.env.NEXT_INSPECT_HOST ?? "127.0.0.1";
const path = process.env.NEXT_INSPECT_WS_PATH ?? "/ws";
const dashboardDir = resolve(process.cwd(), "dashboard");

const CONTENT_TYPE: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
};

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

async function main(): Promise<void> {
    const server = createServer((req, res) => {
        void handleDashboardRequest(req, res);
    });

    await new Promise<void>((resolvePromise, rejectPromise) => {
        server.once("error", rejectPromise);
        server.listen(port, host, () => {
            resolvePromise();
        });
    });

    const hub = createWebSocketHub({ server, path });
    await hub.start();

    const webSocketHost = host === "0.0.0.0" ? "127.0.0.1" : host;
    const websocketUrl = `ws://${webSocketHost}:${port}${path}`;
    setupGlobalAxiosInterceptor({ websocketUrl });

    process.stdout.write(`next-inspect dashboard is running at http://${host}:${port}\n`);
    process.stdout.write(`next-inspect websocket is running at ws://${webSocketHost}:${port}${path}\n`);

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

void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`Failed to start next-inspect interceptor: ${message}\n`);
    process.exit(1);
});
