import * as vscode from 'vscode';
import { startInterceptorServer, stopInterceptorServer } from './interceptorServer';

const HTTP_PORT = 8764;
const WS_PORT = 8765;

export function activate(context: vscode.ExtensionContext) {
	// Start the interceptor server when extension activates
	startInterceptorServer();

	const openPanelDisposable = vscode.commands.registerCommand('next-inspect.openPanel', () => {
		const panel = vscode.window.createWebviewPanel(
			'nextInspect',
			'Next.js Network Inspector',
			vscode.ViewColumn.One,
			{
				enableScripts: true
			}
		);

		panel.webview.html = getWebviewContent();

		panel.webview.onDidReceiveMessage(message => {
			if (message?.type === 'copyInstrumentationSnippet') {
				copyInstrumentationSnippet().catch(error => {
					void vscode.window.showErrorMessage(`Failed to copy snippet: ${String(error)}`);
				});
			}
		});
	});

	const copySnippetDisposable = vscode.commands.registerCommand('next-inspect.copyInstrumentationSnippet', () => {
		void copyInstrumentationSnippet();
	});

	context.subscriptions.push(openPanelDisposable, copySnippetDisposable);
}

function getWebviewContent(): string {
	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Next.js Network Inspector</title>
			<style>
				body { font-family: Segoe UI, sans-serif; }
				#controls { margin-top: 1em; }
				#setup { margin-top: 1em; }
				#setup button { margin-left: 0.5em; }
				#network-log { margin-top: 1em; }
				.log-entry { border-bottom: 1px solid #eee; padding: 0.5em 0; }
				.log-entry:last-child { border-bottom: none; }
				.url { font-weight: bold; }
				.method { color: #007acc; }
				.timestamp { color: #888; font-size: 0.9em; }
				.meta { color: #555; font-size: 0.9em; }
				.hidden { display: none; }
				.search-box { width: 200px; }
				pre { white-space: pre-wrap; word-break: break-word; }
			</style>
		</head>
		<body>
			<h1>Next.js Network Inspector</h1>
			<div id="setup">
				<div>For reliable Next.js server request capture, install instrumentation in your app.</div>
				<button id="copySnippet">Copy Next.js Instrumentation Snippet</button>
			</div>
			<div id="controls">
				<input type="text" id="search" class="search-box" placeholder="Search URL or method..." />
				<select id="methodFilter">
					<option value="">All Methods</option>
					<option value="GET">GET</option>
					<option value="POST">POST</option>
					<option value="PUT">PUT</option>
					<option value="DELETE">DELETE</option>
				</select>
				<button id="clear">Clear</button>
				<button id="export">Export</button>
			</div>
			<div id="network-log">No data yet.</div>
			<script>
				const logDiv = document.getElementById('network-log');
				const searchInput = document.getElementById('search');
				const methodFilter = document.getElementById('methodFilter');
				const clearBtn = document.getElementById('clear');
				const exportBtn = document.getElementById('export');
				const copySnippetBtn = document.getElementById('copySnippet');
				const vscodeApi = acquireVsCodeApi();
				let ws;
				let logs = [];

				function escapeHtml(value) {
					return String(value)
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;')
						.replace(/"/g, '&quot;')
						.replace(/'/g, '&#39;');
				}

				function renderLogs() {
					const search = searchInput.value.toLowerCase();
					const method = methodFilter.value;
					const filtered = logs.filter(log => {
						const matchesSearch =
							log.url.toLowerCase().includes(search) ||
							log.method.toLowerCase().includes(search);
						const matchesMethod = !method || log.method === method;
						return matchesSearch && matchesMethod;
					});
					logDiv.innerHTML = filtered.length === 0 ? 'No data yet.' : '';
					filtered.slice().reverse().forEach(log => {
						const entry = document.createElement('div');
						entry.className = 'log-entry';
						const statusText = typeof log.statusCode === 'number' ? 'Status: ' + log.statusCode : '';
						const durationText = typeof log.durationMs === 'number' ? 'Duration: ' + log.durationMs + 'ms' : '';
						const sourceText = log.source ? 'Source: ' + log.source : '';
						entry.innerHTML =
							'<span class="timestamp">' + escapeHtml(new Date(log.timestamp).toLocaleTimeString()) + '</span> ' +
							'<span class="method">' + escapeHtml(log.method) + '</span> ' +
							'<span class="url">' + escapeHtml(log.url) + '</span><br>' +
							'<span class="meta">' + escapeHtml([statusText, durationText, sourceText].filter(Boolean).join(' | ')) + '</span><br>' +
							'<span>Headers: <pre>' + escapeHtml(JSON.stringify(log.headers, null, 2)) + '</pre></span>' +
							'<span>Body: <pre>' + escapeHtml(log.body || '') + '</pre></span>';
						logDiv.appendChild(entry);
					});
				}

				function connect() {
					ws = new WebSocket('ws://localhost:${WS_PORT}');
					ws.onmessage = (event) => {
						const log = JSON.parse(event.data);
						logs.push(log);
						renderLogs();
					};
					ws.onclose = () => {
						setTimeout(connect, 2000);
					};
				}
				connect();

				searchInput.addEventListener('input', renderLogs);
				methodFilter.addEventListener('change', renderLogs);
				clearBtn.addEventListener('click', () => {
					logs = [];
					renderLogs();
				});
				exportBtn.addEventListener('click', () => {
					const data = JSON.stringify(logs, null, 2);
					const blob = new Blob([data], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = 'network-logs.json';
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
				});

				copySnippetBtn.addEventListener('click', () => {
					vscodeApi.postMessage({ type: 'copyInstrumentationSnippet' });
				});
			</script>
		</body>
		</html>
	`;
}

function getInstrumentationSnippet(): string {
	return `/**
 * Place this file at the root of your Next.js app as instrumentation.ts.
 * Next.js calls register() once per server process in Node runtime.
 */
export async function register() {
	if (process.env.NEXT_RUNTIME !== 'nodejs') {
		return;
	}

	const g = globalThis as typeof globalThis & {
		__nextInspectPatched?: boolean;
		__nextInspectOriginalFetch?: typeof fetch;
	};

	if (g.__nextInspectPatched) {
		return;
	}

	g.__nextInspectPatched = true;
	g.__nextInspectOriginalFetch = globalThis.fetch;

	globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const start = Date.now();
		const method = init?.method ?? 'GET';
		const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

		const headers: Record<string, string> = {};
		if (init?.headers) {
			new Headers(init.headers).forEach((value, key) => {
				headers[key] = value;
			});
		}

		let response: Response;
		try {
			response = await g.__nextInspectOriginalFetch!(input, init);
		} catch (error) {
			void g.__nextInspectOriginalFetch!('http://localhost:${HTTP_PORT}/__next-inspect/ingest', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					method,
					url,
					headers,
					body: typeof init?.body === 'string' ? init.body : '',
					timestamp: start,
					statusCode: 0,
					durationMs: Date.now() - start,
				})
			});
			throw error;
		}

		void g.__nextInspectOriginalFetch!('http://localhost:${HTTP_PORT}/__next-inspect/ingest', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				method,
				url,
				headers,
				body: typeof init?.body === 'string' ? init.body : '',
				timestamp: start,
				statusCode: response.status,
				durationMs: Date.now() - start,
			})
		});

		return response;
	};
}
`;
}

async function copyInstrumentationSnippet(): Promise<void> {
	await vscode.env.clipboard.writeText(getInstrumentationSnippet());
	void vscode.window.showInformationMessage('Next.js instrumentation snippet copied to clipboard. Paste it into instrumentation.ts in your Next.js app.');
}

export function deactivate() {
	stopInterceptorServer();
}
