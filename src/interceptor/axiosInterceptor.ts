import axios, {
    type AxiosInstance,
    type AxiosRequestConfig,
    type InternalAxiosRequestConfig,
    AxiosError
} from "axios";
import { WebSocket } from "ws";
import type {
    GlobalAxiosInterceptorOptions,
    InterceptorHandles,
    NetworkRequestConfigMessage,
    NetworkRequestConfigPayload,
    RequestErrorInterceptor,
    RequestInterceptor,
    ResponseInterceptor,
    ResponseErrorInterceptor
} from "../shared/types";

const DEFAULT_MAX_BUFFERED_NETWORK_LOGS = 200;

interface NormalizedGlobalAxiosInterceptorOptions {
    onRequest: RequestInterceptor;
    onRequestError: RequestErrorInterceptor;
    onResponse: ResponseInterceptor;
    onResponseError: ResponseErrorInterceptor;
    websocketUrl?: string;
    maxBufferedNetworkLogs: number;
}

let isInstalled = false;
let originalCreate: typeof axios.create | null = null;
const attachedInstances = new WeakMap<AxiosInstance, InterceptorHandles>();
const trackedInstances = new Set<AxiosInstance>();
let websocketClient: WebSocket | null = null;
let websocketMessageQueue: string[] = [];
let requestSequence = 0;

const defaultOnRequest: RequestInterceptor = (config) => {
    const startedAt = Date.now();
    const currentMeta = (config as InternalAxiosRequestConfig & { metadata?: Record<string, unknown> }).metadata ?? {};

    (config as InternalAxiosRequestConfig & { metadata?: Record<string, unknown> }).metadata = {
        ...currentMeta,
        startedAt
    };

    return config;
};

const defaultOnResponse: ResponseInterceptor = (response) => {
    return response;
};

const defaultOnResponseError: ResponseErrorInterceptor = (error) => {
    throw error;
};

function buildProducerWebSocketUrl(websocketUrl: string): string {
    if (websocketUrl.includes("role=")) {
        return websocketUrl;
    }

    const separator = websocketUrl.includes("?") ? "&" : "?";
    return `${websocketUrl}${separator}role=producer`;
}

function normalizeUrl(config: AxiosRequestConfig): string {
    const rawUrl = config.url ?? "";
    if (!rawUrl) {
        return "";
    }

    if (/^https?:\/\//i.test(rawUrl)) {
        return rawUrl;
    }

    if (!config.baseURL) {
        return rawUrl;
    }

    const base = config.baseURL.endsWith("/") ? config.baseURL.slice(0, -1) : config.baseURL;
    const path = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
    return `${base}${path}`;
}

function normalizeHeaders(headers: InternalAxiosRequestConfig["headers"]): Record<string, string | number | boolean> {
    const asJson = headers?.toJSON();
    const entries = Object.entries(asJson ?? {});
    const normalized: Record<string, string | number | boolean> = {};

    for (const [key, value] of entries) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            normalized[key] = value;
        }
    }

    return normalized;
}

function createNetworkRequestPayload(config: InternalAxiosRequestConfig): NetworkRequestConfigPayload {
    requestSequence += 1;

    return {
        id: `${Date.now()}-${requestSequence}`,
        timestamp: Date.now(),
        method: (config.method ?? "GET").toUpperCase(),
        url: normalizeUrl(config),
        baseURL: config.baseURL,
        headers: normalizeHeaders(config.headers),
        params: config.params,
        data: config.data
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

function closeWebSocketClient(): void {
    if (websocketClient && websocketClient.readyState === WebSocket.OPEN) {
        websocketClient.close();
    }

    websocketClient = null;
    websocketMessageQueue = [];
}

function attachToInstance(instance: AxiosInstance, options: NormalizedGlobalAxiosInterceptorOptions): void {
    if (attachedInstances.has(instance)) {
        return;
    }

    const requestId = instance.interceptors.request.use(options.onRequest, options.onRequestError);
    const responseId = instance.interceptors.response.use(options.onResponse, options.onResponseError);

    attachedInstances.set(instance, { requestId, responseId });
    trackedInstances.add(instance);
}

export function setupGlobalAxiosInterceptor(options: GlobalAxiosInterceptorOptions = {}): void {
    if (isInstalled) {
        return;
    }

    const requestHandler = options.onRequest ?? defaultOnRequest;

    const normalizedOptions: NormalizedGlobalAxiosInterceptorOptions = {
        onRequest: async (config) => {
            const nextConfig = await requestHandler(config);

            if (options.websocketUrl) {
                const payload = createNetworkRequestPayload(nextConfig);
                const message: NetworkRequestConfigMessage = {
                    type: "network.request.config",
                    payload
                };

                queueOrSendNetworkMessage(message, options.websocketUrl, options.maxBufferedNetworkLogs ?? DEFAULT_MAX_BUFFERED_NETWORK_LOGS);
            }

            return nextConfig;
        },
        onRequestError: options.onRequestError ?? ((error) => {
            throw error;
        }),
        onResponse: options.onResponse ?? defaultOnResponse,
        onResponseError: options.onResponseError ?? defaultOnResponseError,
        websocketUrl: options.websocketUrl,
        maxBufferedNetworkLogs: options.maxBufferedNetworkLogs ?? DEFAULT_MAX_BUFFERED_NETWORK_LOGS
    };

    attachToInstance(axios, normalizedOptions);

    originalCreate = axios.create.bind(axios);
    axios.create = ((config?: AxiosRequestConfig) => {
        const instance = originalCreate!(config);
        attachToInstance(instance, normalizedOptions);
        return instance;
    }) as typeof axios.create;

    isInstalled = true;
}

export function ejectGlobalAxiosInterceptor(): void {
    if (!isInstalled) {
        return;
    }

    for (const instance of trackedInstances) {
        const handles = attachedInstances.get(instance);
        if (handles) {
            instance.interceptors.request.eject(handles.requestId);
            instance.interceptors.response.eject(handles.responseId);
        }
    }
    trackedInstances.clear();

    if (originalCreate) {
        axios.create = originalCreate;
    }

    originalCreate = null;
    isInstalled = false;
    closeWebSocketClient();
}

export function isGlobalAxiosInterceptorInstalled(): boolean {
    return isInstalled;
}

export function isAxiosError(value: unknown): value is AxiosError {
    return axios.isAxiosError(value);
}
