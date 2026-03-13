import type { IncomingMessage, Server as HttpServer } from "http";
import type { Socket } from "net";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import type {
    NetworkRequestConfigMessage,
    WebSocketClientRole,
    WebSocketHubMessage
} from "../shared/types";

export interface WebSocketHubOptions {
    port?: number;
    host?: string;
    path?: string;
    server?: HttpServer;
}

export interface WebSocketHub {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    broadcastToFrontend: (message: WebSocketHubMessage) => number;
}

const DEFAULT_PORT = 8757;
const DEFAULT_PATH = "/ws";

function isNetworkRequestConfigMessage(value: unknown): value is NetworkRequestConfigMessage {
    if (!value || typeof value !== "object") {
        return false;
    }

    const candidate = value as Partial<NetworkRequestConfigMessage>;
    if (candidate.type !== "network.request.config") {
        return false;
    }

    if (!candidate.payload || typeof candidate.payload !== "object") {
        return false;
    }

    const payload = candidate.payload as Partial<NetworkRequestConfigMessage["payload"]>;
    return (
        typeof payload.id === "string" &&
        typeof payload.timestamp === "number" &&
        typeof payload.method === "string" &&
        typeof payload.url === "string"
    );
}

function getClientRoleFromUrl(url: string | undefined): WebSocketClientRole {
    if (!url) {
        return "frontend";
    }

    const queryIndex = url.indexOf("?");
    if (queryIndex === -1) {
        return "frontend";
    }

    const searchParams = new URLSearchParams(url.slice(queryIndex + 1));
    return searchParams.get("role") === "producer" ? "producer" : "frontend";
}

export function createWebSocketHub(options: WebSocketHubOptions = {}): WebSocketHub {
    const port = options.port ?? DEFAULT_PORT;
    const host = options.host ?? "127.0.0.1";
    const path = options.path ?? DEFAULT_PATH;
    const server = options.server;

    const producerClients = new Set<WebSocket>();
    const frontendClients = new Set<WebSocket>();
    let wss: WebSocketServer | null = null;
    let upgradeListener: ((request: IncomingMessage, socket: Socket, head: Buffer) => void) | null = null;

    function removeClient(socket: WebSocket): void {
        producerClients.delete(socket);
        frontendClients.delete(socket);
    }

    function broadcastToFrontend(message: WebSocketHubMessage): number {
        if (!wss) {
            return 0;
        }

        const serialized = JSON.stringify(message);
        let sentCount = 0;

        for (const client of frontendClients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(serialized);
                sentCount += 1;
            }
        }

        return sentCount;
    }

    function onConnection(socket: WebSocket, request: IncomingMessage): void {
        const role = getClientRoleFromUrl(request.url);

        if (role === "producer") {
            producerClients.add(socket);
        } else {
            frontendClients.add(socket);
        }

        socket.on("message", (rawData: RawData) => {
            if (role !== "producer") {
                return;
            }

            const rawText = typeof rawData === "string" ? rawData : rawData.toString();

            let parsed: unknown;
            try {
                parsed = JSON.parse(rawText);
            } catch {
                return;
            }

            if (!isNetworkRequestConfigMessage(parsed)) {
                return;
            }

            broadcastToFrontend(parsed);
        });

        socket.on("close", () => {
            removeClient(socket);
        });

        socket.on("error", () => {
            removeClient(socket);
        });
    }

    return {
        start: async () => {
            if (wss) {
                return;
            }

            if (server) {
                wss = new WebSocketServer({ noServer: true });
                wss.on("connection", onConnection);

                upgradeListener = (request: IncomingMessage, socket: Socket, head: Buffer) => {
                    const rawUrl = request.url ?? "";
                    const pathname = rawUrl.split("?")[0] ?? "";

                    if (pathname !== path) {
                        return;
                    }

                    wss?.handleUpgrade(request, socket, head, (client) => {
                        wss?.emit("connection", client, request);
                    });
                };

                server.on("upgrade", upgradeListener);
                return;
            }

            wss = new WebSocketServer({
                host,
                path,
                port
            });

            wss.on("connection", onConnection);

            await new Promise<void>((resolve, reject) => {
                wss?.once("listening", resolve);
                wss?.once("error", reject);
            });
        },
        stop: async () => {
            if (!wss) {
                return;
            }

            const wsServer = wss;
            wss = null;

            await new Promise<void>((resolve, reject) => {
                wsServer.close((error?: Error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });

            producerClients.clear();
            frontendClients.clear();

            if (server && upgradeListener) {
                server.off("upgrade", upgradeListener);
                upgradeListener = null;
            }
        },
        broadcastToFrontend
    };
}

