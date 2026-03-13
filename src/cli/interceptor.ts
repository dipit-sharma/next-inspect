import { setupGlobalAxiosInterceptor } from "../interceptor/axiosInterceptor";
import { createWebSocketHub } from "../ws-hub/websocket";

const port = Number(process.env.NEXT_INSPECT_PORT ?? "8757");
const host = process.env.NEXT_INSPECT_HOST ?? "127.0.0.1";
const path = process.env.NEXT_INSPECT_WS_PATH ?? "/ws";

async function main(): Promise<void> {
    const hub = createWebSocketHub({ port, host, path });
    await hub.start();
    setupGlobalAxiosInterceptor();

    process.stdout.write(`next-inspect interceptor is running on ws://${host}:${port}${path}\n`);

    const shutdown = async () => {
        process.stdout.write("Shutting down next-inspect interceptor...\n");
        await hub.stop();
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
