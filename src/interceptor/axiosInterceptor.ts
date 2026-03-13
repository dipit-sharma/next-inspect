import axios, {
    type AxiosInstance,
    type AxiosRequestConfig,
    type InternalAxiosRequestConfig,
    AxiosError
} from "axios";
import type {
    GlobalAxiosInterceptorOptions,
    InterceptorHandles,
    RequestInterceptor,
    ResponseInterceptor,
    ResponseErrorInterceptor
} from "../shared/types";

let isInstalled = false;
let originalCreate: typeof axios.create | null = null;
const attachedInstances = new WeakMap<AxiosInstance, InterceptorHandles>();
const trackedInstances = new Set<AxiosInstance>();

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

function attachToInstance(instance: AxiosInstance, options: Required<GlobalAxiosInterceptorOptions>): void {
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

    const normalizedOptions: Required<GlobalAxiosInterceptorOptions> = {
        onRequest: options.onRequest ?? defaultOnRequest,
        onRequestError: options.onRequestError ?? ((error) => {
            throw error;
        }),
        onResponse: options.onResponse ?? defaultOnResponse,
        onResponseError: options.onResponseError ?? defaultOnResponseError
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
}

export function isGlobalAxiosInterceptorInstalled(): boolean {
    return isInstalled;
}

export function isAxiosError(value: unknown): value is AxiosError {
    return axios.isAxiosError(value);
}
