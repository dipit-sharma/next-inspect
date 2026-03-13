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

- Captures server-side Axios calls from the Next.js Node process.
- Does not capture Edge runtime traffic.
- Does not automatically capture `fetch` or browser-side network calls.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the package:
   ```bash
   npm run build
   ```
