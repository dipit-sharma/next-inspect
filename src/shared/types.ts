import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";

export type RequestInterceptor = (
    config: InternalAxiosRequestConfig
) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;

export type RequestErrorInterceptor = (error: unknown) => unknown;

export type ResponseInterceptor = (
    response: AxiosResponse
) => AxiosResponse | Promise<AxiosResponse>;

export type ResponseErrorInterceptor = (error: unknown) => unknown;

export interface GlobalAxiosInterceptorOptions {
    onRequest?: RequestInterceptor;
    onRequestError?: RequestErrorInterceptor;
    onResponse?: ResponseInterceptor;
    onResponseError?: ResponseErrorInterceptor;
    websocketUrl?: string;
    maxBufferedNetworkLogs?: number;
}

export interface InterceptorHandles {
    requestId: number;
    responseId: number;
}

export interface NetworkRequestConfigPayload {
    id: string;
    timestamp: number;
    method: string;
    url: string;
    baseURL?: string;
    headers?: Record<string, string | number | boolean>;
    params?: unknown;
    data?: unknown;
}

export interface NetworkRequestConfigMessage {
    type: "network.request.config";
    payload: NetworkRequestConfigPayload;
}

export type WebSocketHubMessage = NetworkRequestConfigMessage;

export type WebSocketClientRole = "producer" | "frontend";
