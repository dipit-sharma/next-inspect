import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';

interface NetworkLog {
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
  body: string;
  timestamp: number;
  statusCode?: number;
  durationMs?: number;
  source: 'proxy' | 'next-fetch';
}

const logs: NetworkLog[] = [];
const INGEST_PATH = '/__next-inspect/ingest';

interface ForwardedNetworkLog {
  method?: unknown;
  url?: unknown;
  headers?: unknown;
  body?: unknown;
  timestamp?: unknown;
  statusCode?: unknown;
  durationMs?: unknown;
}

function getPathname(rawUrl: string | undefined): string {
  if (!rawUrl) {
    return '/';
  }

  try {
    return new URL(rawUrl, 'http://localhost').pathname;
  } catch {
    return rawUrl;
  }
}

function toRecordHeaders(headers: unknown): Record<string, string | string[]> {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  return headers as Record<string, string | string[]>;
}

function parseForwardedLog(payload: string): NetworkLog | null {
  try {
    const parsed = JSON.parse(payload) as ForwardedNetworkLog;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      method: typeof parsed.method === 'string' ? parsed.method : 'GET',
      url: typeof parsed.url === 'string' ? parsed.url : '',
      headers: toRecordHeaders(parsed.headers),
      body: typeof parsed.body === 'string' ? parsed.body : '',
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
      statusCode: typeof parsed.statusCode === 'number' ? parsed.statusCode : undefined,
      durationMs: typeof parsed.durationMs === 'number' ? parsed.durationMs : undefined,
      source: 'next-fetch',
    };
  } catch {
    return null;
  }
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });
  req.on('end', () => {
    const pathname = getPathname(req.url);

    if (req.method === 'POST' && pathname === INGEST_PATH) {
      const forwardedLog = parseForwardedLog(body);
      if (!forwardedLog) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Invalid payload' }));
        return;
      }

      logs.push(forwardedLog);
      broadcast(forwardedLog);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    const log: NetworkLog = {
      method: req.method || '',
      url: req.url || '',
      headers: req.headers as Record<string, string | string[]>,
      body,
      timestamp: Date.now(),
      source: 'proxy',
    };
    console.log(`Logged request: ${log.method} ${log.url}`);
    logs.push(log);
    broadcast(log);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  });
});

const wss = new WebSocketServer({ port: 8765 });

function broadcast(log: NetworkLog) {
  wss.clients.forEach((client: any) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(log));
    }
  });
}

export function startInterceptorServer(port = 8764) {
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Interceptor server listening on port ${port}`);
  });
}

export function stopInterceptorServer() {
  server.close();
  wss.close();
}
