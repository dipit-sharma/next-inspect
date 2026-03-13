import axios from "axios";

const INTERVAL_MS = 5000;
let isRunning = false;

async function runAxiosTestCall(): Promise<void> {
    if (isRunning) {
        return;
    }

    isRunning = true;
    try {
        const response = await axios.get("https://jsonplaceholder.typicode.com/todos/1");

        process.stdout.write(`Status: ${response.status}\n`);
        process.stdout.write(`Response URL: ${response.config.url ?? "n/a"}\n`);
        process.stdout.write(`Body: ${JSON.stringify(response.data)}\n`);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Axios test call failed: ${message}\n`);
        process.exitCode = 1;
    } finally {
        isRunning = false;
    }
}

void runAxiosTestCall();
setInterval(() => {
    void runAxiosTestCall();
}, INTERVAL_MS);
