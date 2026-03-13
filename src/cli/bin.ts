#!/usr/bin/env node

import { runInterceptor } from "./interceptor";

function printHelp(): void {
    process.stdout.write("next-inspect CLI\n\n");
    process.stdout.write("Usage:\n");
    process.stdout.write("  next-inspect intercept\n");
    process.stdout.write("  next-inspect --help\n");
}

async function main(): Promise<void> {
    const command = process.argv[2];

    if (!command || command === "--help" || command === "-h" || command === "help") {
        printHelp();
        return;
    }

    if (command === "intercept") {
        await runInterceptor();
        return;
    }

    process.stderr.write(`Unknown command: ${command}\n\n`);
    printHelp();
    process.exit(1);
}

void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`next-inspect failed: ${message}\n`);
    process.exit(1);
});
