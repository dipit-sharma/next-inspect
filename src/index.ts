export interface HealthCheck {
    name: string;
    version: string;
    status: "ok";
}

export {
    setupGlobalAxiosInterceptor,
    ejectGlobalAxiosInterceptor,
    isGlobalAxiosInterceptorInstalled,
    isAxiosError
} from "./interceptor/axiosInterceptor";

export function getHealthCheck(name: string, version: string): HealthCheck {
    return {
        name,
        version,
        status: "ok"
    };
}
