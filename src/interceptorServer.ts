import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';

interface NetworkLog {
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
  body: string;
  timestamp: number;
}

const logs: NetworkLog[] = [];

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });
  req.on('end', () => {
    const log: NetworkLog = {
      method: req.method || '',
      url: req.url || '',
      headers: req.headers as Record<string, string | string[]>,
      body,
      timestamp: Date.now(),
    };
    logs.push(log);
    broadcast(log);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  });
});

const wss = new WebSocketServer({ port: 8765 });

function broadcast(log: NetworkLog) {
  wss.clients.forEach(client => {
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
