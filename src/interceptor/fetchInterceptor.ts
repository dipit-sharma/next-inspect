import { WebSocket } from "ws";
import type { GlobalAxiosInterceptorOptions, NetworkRequestConfigMessage, NetworkRequestConfigPayload } from "../shared/types";

const DEFAULT_MAX_BUFFERED_NETWORK_LOGS = 200;

let isInstalled = false;
let originalFetch: typeof globalThis.fetch | null = null;
let websocketClient: WebSocket | null = null;
let websocketMessageQueue: string[] = [];
let requestSequence = 0;

export type FetchLike = typeof globalThis.fetch;

function buildProducerWebSocketUrl(websocketUrl: string): string {
    if (websocketUrl.includes("role=")) {
        return websocketUrl;
    }

    const separator = websocketUrl.includes("?") ? "&" : "?";
    return `${websocketUrl}${separator}role=producer`;
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string | number | boolean> {
    if (!headers) {
        return {};
    }

    const normalized: Record<string, string | number | boolean> = {};

    if (headers instanceof Headers) {
        headers.forEach((value, key) => {
            normalized[key] = value;
        });
        return normalized;
    }

    if (Array.isArray(headers)) {
        for (const [key, value] of headers) {
            normalized[key] = value;
        }
        return normalized;
    }

    for (const [key, value] of Object.entries(headers)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            normalized[key] = value;
        }
    }

    return normalized;
}

function normalizeRequestUrl(input: string | URL | Request): string {
    if (typeof input === "string") {
        return input;
    }

    if (input instanceof URL) {
        return input.toString();
    }

    return input.url;
}

function normalizeRequestMethod(input: string | URL | Request, init: RequestInit | undefined): string {
    if (init?.method) {
        return init.method.toUpperCase();
    }

    if (input instanceof Request) {
        return input.method.toUpperCase();
    }

    return "GET";
}

function normalizeRequestBody(input: string | URL | Request, init: RequestInit | undefined): unknown {
    if (typeof init?.body === "string") {
        return init.body;
    }

    if (input instanceof Request && typeof input.bodyUsed === "boolean" && !input.bodyUsed) {
        return undefined;
    }

    return undefined;
}

function createNetworkRequestPayload(
    input: string | URL | Request,
    init: RequestInit | undefined
): NetworkRequestConfigPayload {
    requestSequence += 1;

    const headers = normalizeHeaders(init?.headers ?? (input instanceof Request ? input.headers : undefined));

    return {
        id: `${Date.now()}-${requestSequence}`,
        timestamp: Date.now(),
        method: normalizeRequestMethod(input, init),
        url: normalizeRequestUrl(input),
        headers,
        data: normalizeRequestBody(input, init)
    };
}

function flushWebSocketQueue(): void {
    if (!websocketClient || websocketClient.readyState !== WebSocket.OPEN || websocketMessageQueue.length === 0) {
        return;
    }

    for (const serializedMessage of websocketMessageQueue) {
        websocketClient.send(serializedMessage);
    }

    websocketMessageQueue = [];
}

function queueOrSendNetworkMessage(
    message: NetworkRequestConfigMessage,
    websocketUrl: string,
    maxBufferedNetworkLogs: number
): void {
    if (typeof window !== 'undefined' && window.document) return;

    const serializedMessage = JSON.stringify(message);

    if (!websocketClient || websocketClient.readyState === WebSocket.CLOSED) {
        websocketClient = new WebSocket(buildProducerWebSocketUrl(websocketUrl));
        websocketClient.on("open", () => {
            flushWebSocketQueue();
        });
        websocketClient.on("close", () => {
            websocketClient = null;
        });
        websocketClient.on("error", () => {
            websocketClient = null;
        });
    }

    if (websocketClient.readyState === WebSocket.OPEN) {
        websocketClient.send(serializedMessage);
        return;
    }

    websocketMessageQueue.push(serializedMessage);
    if (websocketMessageQueue.length > maxBufferedNetworkLogs) {
        websocketMessageQueue.shift();
    }
}

export function createFetchInterceptor(
    fetchImpl: FetchLike,
    options: GlobalAxiosInterceptorOptions = {}
): FetchLike {
    if (typeof fetchImpl !== "function" || !options.websocketUrl) {
        return fetchImpl;
    }

    return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const payload = createNetworkRequestPayload(input, init);
        const message: NetworkRequestConfigMessage = {
            type: "network.request.config",
            payload
        };

        queueOrSendNetworkMessage(message, options.websocketUrl!, options.maxBufferedNetworkLogs ?? DEFAULT_MAX_BUFFERED_NETWORK_LOGS);

        return fetchImpl(input, init);
    }) as FetchLike;
}

function closeWebSocketClient(): void {
    if (websocketClient && websocketClient.readyState === WebSocket.OPEN) {
        websocketClient.close();
    }

    websocketClient = null;
    websocketMessageQueue = [];
}

export function setupGlobalFetchInterceptor(options: GlobalAxiosInterceptorOptions = {}): void {
    if (isInstalled || typeof globalThis.fetch !== "function" || !options.websocketUrl) {
        return;
    }

    originalFetch = globalThis.fetch.bind(globalThis);

    globalThis.fetch = createFetchInterceptor(originalFetch, options);

    isInstalled = true;
}

export function ejectGlobalFetchInterceptor(): void {
    if (!isInstalled) {
        return;
    }

    if (originalFetch) {
        globalThis.fetch = originalFetch;
    }

    originalFetch = null;
    isInstalled = false;
    closeWebSocketClient();
}

export function isGlobalFetchInterceptorInstalled(): boolean {
    return isInstalled;
}
