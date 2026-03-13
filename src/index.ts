export interface HealthCheck {
    name: string;
    version: string;
    status: "ok";
}

export function getHealthCheck(name: string, version: string): HealthCheck {
    return {
        name,
        version,
        status: "ok"
    };
}
