# next-inspect

next-inspect is a VS Code extension that helps you inspect server-side Next.js network traffic in real time.

It includes:

1. An HTTP ingest server on port 8764.
2. A WebSocket stream on port 8765.
3. A webview panel that filters, searches, and exports captured logs.
4. A command that copies a Next.js instrumentation snippet.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Build the extension:

```bash
npm run compile
```

3. Start the extension in VS Code Extension Development Host.
4. Run the command: Next Inspect: Open Next.js Network Inspector.
5. Run the command: Next Inspect: Copy Next.js Instrumentation Snippet.
6. Paste the snippet into instrumentation.ts in your Next.js app.

## How Capture Works

The extension does not automatically sniff all Node traffic. It captures outgoing Next.js server requests by patching server-side fetch in your Next.js process.

Flow:

1. Next.js server-side fetch is wrapped by instrumentation.
2. Each fetch event is POSTed to http://localhost:8764/\_\_next-inspect/ingest.
3. Extension server stores and broadcasts the event via ws://localhost:8765.
4. The panel renders new logs live.

## Next.js Setup

1. Create instrumentation.ts at your Next.js app root.
2. Paste the snippet copied by the command.
3. Ensure your Next.js app is running in Node runtime for server instrumentation.
4. Trigger server-side fetch calls and open the inspector panel.

## Commands

1. next-inspect.openPanel: Open Next.js Network Inspector.
2. next-inspect.copyInstrumentationSnippet: Copy Next.js instrumentation snippet.

## Data Captured

Each log entry can include:

1. method
2. url
3. headers
4. body
5. timestamp
6. statusCode
7. durationMs
8. source (proxy or next-fetch)

## Troubleshooting

### No logs in panel

1. Verify the extension is running and panel is open.
2. Verify instrumentation.ts is loaded by Next.js.
3. Verify your app can POST to http://localhost:8764/\_\_next-inspect/ingest.
4. Verify requests are server-side fetch calls, not browser-only requests.

### Cannot resolve utf-8-validate during build

This project keeps ws external in webpack config so optional ws native dependencies are not bundled.

### Port conflicts

If ports 8764 or 8765 are used by another process, free those ports or update the server/webview code to use different ports.

## Development Scripts

1. npm run compile: Build extension bundle.
2. npm run watch: Rebuild on file changes.
3. npm run compile-tests: Compile tests.
4. npm run watch-tests: Watch test compilation.
5. npm run lint: Run ESLint.

## Known Limitations

1. Logs are in-memory and are cleared when the extension host restarts.
2. Only traffic sent to the ingest endpoint or interceptor HTTP server is captured.
3. Browser-side requests are not captured unless explicitly forwarded.
