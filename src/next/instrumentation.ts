import { setupGlobalAxiosInterceptor } from "../interceptor/axiosInterceptor";

const DEFAULT_NEXT_INSPECT_WEBSOCKET_URL = "ws://localhost:8757/ws?role=producer";

export interface NextInspectIntegrationOptions {
    enabled?: boolean;
    websocketUrl?: string;
    maxBufferedNetworkLogs?: number;
}

export function registerNextInspect(options: NextInspectIntegrationOptions = {}): boolean {
    const enabledFromEnv = process.env.NEXT_INSPECT_ENABLED !== "false";
    const isEnabled = options.enabled ?? enabledFromEnv;

    if (!isEnabled) {
        return false;
    }

    if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
        return false;
    }

    const websocketUrl =
        options.websocketUrl ??
        process.env.NEXT_INSPECT_COLLECTOR_URL ??
        DEFAULT_NEXT_INSPECT_WEBSOCKET_URL;

    setupGlobalAxiosInterceptor({
        websocketUrl,
        maxBufferedNetworkLogs: options.maxBufferedNetworkLogs
    });

    return true;
}
