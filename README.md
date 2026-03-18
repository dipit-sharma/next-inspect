# next-inspect

TypeScript npm package boilerplate.

## Host App Script

In the consuming Next.js app, add this script:

```json
{
  "scripts": {
    "intercept": "next-inspect intercept"
  }
}
```

## Scripts

- `npm run build` - Build to `dist/`
- `npm run dev` - Watch mode build
- `npm run typecheck` - Type-check project
- `npm run clean` - Remove `dist/`

## Next.js Server Integration

Create `instrumentation.ts` in the root of the Next.js app and register interceptor setup in the Node.js runtime:

```ts
import { registerNextInspect } from "next-inspect";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    registerNextInspect({
      websocketUrl: "ws://localhost:8757/ws?role=producer",
    });
  }
}
```

Then start the collector UI + websocket server:

```bash
npm run intercept
```

Environment options:

- `NEXT_INSPECT_ENABLED=false` to disable registration.
- `NEXT_INSPECT_COLLECTOR_URL=ws://localhost:8757/ws?role=producer` to override websocket URL.
- `NEXT_INSPECT_WS_ALLOWED_ORIGINS=*` to allow all browser origins for websocket upgrades (or a comma-separated allow-list, e.g. `https://app.example.com,https://admin.example.com`).

## Next.js 13.5.9 (Pages Router)

This package works with Next.js 13.5.9 and Pages Router when used in the Node.js runtime.

Requirements:

- Enable instrumentation hook in `next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
```

- Keep `instrumentation.ts` at the app root and call `registerNextInspect` there.
- Start the collector and Next app as separate processes:
  - `npm run intercept`
  - `npm run dev` (or `npm run start`)

Notes:

- Captures server-side Axios and fetch calls from the Next.js Node process.
- Does not capture Edge runtime traffic.
- Does not capture browser-side network calls.

### Using fetch-cross (or other custom fetch clients)

If your app imports a fetch implementation directly (for example `fetch-cross`), patching only `globalThis.fetch` may not intercept those calls. In that case, wrap the imported fetch function:

```ts
import fetchCross from "fetch-cross";
import { createFetchInterceptor } from "next-inspect";

const fetch = createFetchInterceptor(fetchCross as typeof globalThis.fetch, {
  websocketUrl: "ws://localhost:8757/ws?role=producer",
  maxBufferedNetworkLogs: 200,
});

// Use `fetch` instead of `fetchCross`
const response = await fetch("https://example.com/api");
```

If you control one central HTTP client module, apply this wrapper there so all imports share the intercepted fetch.

### Troubleshooting (Next.js 13.5.9)

1. `instrumentation.ts` is not running

- Check `next.config.js` has `experimental.instrumentationHook = true`.
- Ensure `instrumentation.ts` is at the app root (same level as `next.config.js`).
- Restart Next.js dev server after adding instrumentation.

2. Dashboard opens but no logs appear

- Confirm collector is running with `npm run intercept`.
- Confirm Next app process is running separately (`npm run dev` or `npm run start`).
- Confirm API calls happen on the server (Node runtime), not only in the browser.

3. Wrong runtime (Edge)

- This package only captures in Node runtime.
- For routes/pages set to Edge runtime, Axios interception will not run.

4. WebSocket URL mismatch

- Ensure websocket URL is `ws://localhost:8757/ws?role=producer` in `registerNextInspect` or via `NEXT_INSPECT_COLLECTOR_URL`.
- If host/port/path was customized, match the same values in both collector and Next app.

5. Interceptor disabled by env

- Check `NEXT_INSPECT_ENABLED` is not set to `false`.

6. Multiple Axios versions

- If app and package resolve different Axios copies, interceptor may patch only one instance.
- Ensure host app imports Axios consistently and avoids duplicate installations if possible.

7. Common quick check sequence

- Start collector: `npm run intercept`.
- Open dashboard: `http://127.0.0.1:8757`.
- Start Next app: `npm run dev`.
- Trigger a server-side Axios request and verify log appears.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the package:
   ```bash
   npm run build
   ```
