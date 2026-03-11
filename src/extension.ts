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
				return;
			}

			if (message?.type === 'copyCurl' && message?.log) {
				void copyCurlCommand(message.log as InspectorLog);
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
				:root {
					--bg: #0b1020;
					--surface: #11172a;
					--surface-alt: #1a2238;
					--text: #e7edf9;
					--muted: #a5b2cc;
					--accent: #14b8a6;
					--accent-soft: #11383a;
					--danger: #ef4444;
					--border: #2a3653;
					--shadow: 0 20px 36px rgba(0, 0, 0, 0.35);
				}

				* { box-sizing: border-box; }

				body {
					margin: 0;
					font-family: "Space Grotesk", "Segoe UI", sans-serif;
					background:
						radial-gradient(circle at 5% 10%, #133a5c 0%, transparent 45%),
						radial-gradient(circle at 90% 5%, #1d2d5b 0%, transparent 45%),
						var(--bg);
					color: var(--text);
					padding: 18px;
				}

				.page {
					max-width: 1200px;
					margin: 0 auto;
					display: grid;
					gap: 14px;
				}

				.panel {
					background: var(--surface);
					border: 1px solid var(--border);
					border-radius: 16px;
					padding: 14px;
					box-shadow: var(--shadow);
				}

				h1 {
					margin: 0;
					font-size: 1.5rem;
					letter-spacing: 0.03em;
				}

				.subtitle {
					margin-top: 4px;
					color: var(--muted);
					font-size: 0.95rem;
				}

				button, select, input {
					font-family: inherit;
				}

				.toolbar {
					display: flex;
					flex-wrap: wrap;
					gap: 8px;
					align-items: center;
				}

				.toolbar input, .toolbar select {
					background: var(--surface-alt);
					border: 1px solid var(--border);
					border-radius: 10px;
					padding: 9px 10px;
					color: var(--text);
				}

				.toolbar input {
					min-width: 240px;
					flex: 1;
				}

				.button {
					border: 1px solid transparent;
					border-radius: 10px;
					padding: 9px 12px;
					cursor: pointer;
					transition: transform 120ms ease, box-shadow 120ms ease;
				}

				.button:hover {
					transform: translateY(-1px);
					box-shadow: 0 8px 18px rgba(16, 42, 67, 0.1);
				}

				.button.primary {
					background: var(--accent);
					color: #ffffff;
				}

				.button.ghost {
					background: var(--surface-alt);
					border-color: var(--border);
					color: var(--text);
				}

				.kpis {
					display: flex;
					gap: 8px;
					flex-wrap: wrap;
				}

				.kpi {
					padding: 8px 10px;
					border-radius: 999px;
					background: var(--surface-alt);
					border: 1px solid var(--border);
					font-size: 0.82rem;
					color: var(--muted);
				}

				#network-log {
					display: grid;
					gap: 10px;
				}

				.log-entry {
					border: 1px solid var(--border);
					border-radius: 14px;
					padding: 12px;
					background: linear-gradient(180deg, #141d34 0%, #11172a 100%);
					animation: slideIn 180ms ease;
				}

				.entry-head {
					display: flex;
					justify-content: space-between;
					gap: 12px;
					align-items: flex-start;
				}

				.entry-main {
					display: flex;
					gap: 8px;
					align-items: center;
					flex-wrap: wrap;
				}

				.badge {
					font-size: 0.74rem;
					font-weight: 700;
					padding: 4px 8px;
					border-radius: 999px;
					background: var(--accent-soft);
					color: var(--accent);
				}

				.badge.error {
					background: #3b1b20;
					color: #fda4af;
				}

				.url {
					font-weight: 600;
					word-break: break-all;
				}

				.meta {
					margin-top: 6px;
					font-size: 0.82rem;
					color: var(--muted);
				}

				.details {
					display: grid;
					gap: 6px;
					margin-top: 10px;
				}

				pre {
					margin: 0;
					padding: 10px;
					background: #0a1225;
					color: #d7e3fb;
					border-radius: 10px;
					border: 1px solid #243453;
					white-space: pre-wrap;
					word-break: break-word;
					font-size: 0.78rem;
				}

				.empty {
					text-align: center;
					padding: 34px 12px;
					color: var(--muted);
					border: 1px dashed var(--border);
					border-radius: 12px;
				}

				@keyframes slideIn {
					from { opacity: 0; transform: translateY(4px); }
					to { opacity: 1; transform: translateY(0); }
				}

				@media (max-width: 720px) {
					body { padding: 12px; }
					.toolbar input { min-width: 100%; }
					.entry-head { flex-direction: column; }
				}
			</style>
		</head>
		<body>
			<div class="page">
				<section class="panel">
					<h1>Next.js Network Inspector</h1>
					<div class="subtitle">Live server request capture for Next.js with export and replay.</div>
					<div class="toolbar" style="margin-top:10px;">
						<button class="button primary" id="copySnippet">Copy Instrumentation Snippet</button>
					</div>
				</section>

				<section class="panel">
					<div class="toolbar">
						<input type="text" id="search" placeholder="Search by URL or method" />
						<select id="methodFilter">
							<option value="">All Methods</option>
							<option value="GET">GET</option>
							<option value="POST">POST</option>
							<option value="PUT">PUT</option>
							<option value="PATCH">PATCH</option>
							<option value="DELETE">DELETE</option>
						</select>
						<button class="button ghost" id="clear">Clear</button>
						<button class="button ghost" id="export">Export JSON</button>
					</div>
					<div class="kpis" style="margin-top:10px;">
						<span class="kpi" id="kpiTotal">Total: 0</span>
						<span class="kpi" id="kpiVisible">Visible: 0</span>
					</div>
				</section>

				<section class="panel">
					<div id="network-log"><div class="empty">No captured requests yet.</div></div>
				</section>
			</div>
			<script>
				const logDiv = document.getElementById('network-log');
				const searchInput = document.getElementById('search');
				const methodFilter = document.getElementById('methodFilter');
				const clearBtn = document.getElementById('clear');
				const exportBtn = document.getElementById('export');
				const copySnippetBtn = document.getElementById('copySnippet');
				const kpiTotal = document.getElementById('kpiTotal');
				const kpiVisible = document.getElementById('kpiVisible');
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

					kpiTotal.textContent = 'Total: ' + logs.length;
					kpiVisible.textContent = 'Visible: ' + filtered.length;

					logDiv.innerHTML = '';
					if (filtered.length === 0) {
						logDiv.innerHTML = '<div class="empty">No matching requests.</div>';
						return;
					}

					filtered.slice().reverse().forEach((log, idx) => {
						const entry = document.createElement('div');
						entry.className = 'log-entry';
						entry.dataset.index = String(idx);
						entry.dataset.log = JSON.stringify(log);
						const statusText = typeof log.statusCode === 'number' ? 'Status: ' + log.statusCode : '';
						const durationText = typeof log.durationMs === 'number' ? 'Duration: ' + log.durationMs + 'ms' : '';
						const sourceText = log.source ? 'Source: ' + log.source : '';
						const methodBadgeClass = (log.statusCode && log.statusCode >= 400) ? 'badge error' : 'badge';
						const bodyText = typeof log.body === 'string' ? log.body : '';
						entry.innerHTML =
							'<div class="entry-head">' +
								'<div>' +
									'<div class="entry-main">' +
										'<span class="' + methodBadgeClass + '">' + escapeHtml(log.method) + '</span>' +
										'<span class="url">' + escapeHtml(log.url) + '</span>' +
									'</div>' +
									'<div class="meta">' + escapeHtml(new Date(log.timestamp).toLocaleString()) + ' | ' + escapeHtml([statusText, durationText, sourceText].filter(Boolean).join(' | ')) + '</div>' +
								'</div>' +
								'<div>' +
									'<button class="button ghost copy-curl-btn">copy cURL</button>' +
								'</div>' +
							'</div>' +
							'<div class="details">' +
								'<div>Headers</div>' +
								'<pre>' + escapeHtml(JSON.stringify(log.headers, null, 2)) + '</pre>' +
								'<div>Body</div>' +
								'<pre>' + escapeHtml(bodyText) + '</pre>' +
							'</div>';
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

				logDiv.addEventListener('click', event => {
					const target = event.target;
					if (!(target instanceof HTMLElement)) {
						return;
					}

					if (!target.classList.contains('copy-curl-btn')) {
						return;
					}

					const entry = target.closest('.log-entry');
					if (!entry || !entry.dataset.log) {
						return;
					}

					try {
						const log = JSON.parse(entry.dataset.log);
						vscodeApi.postMessage({ type: 'copyCurl', log });
					} catch {
						// Ignore malformed log payload in UI state.
					}
				});
			</script>
		</body>
		</html>
	`;
}

interface InspectorLog {
	method?: unknown;
	url?: unknown;
	headers?: unknown;
	body?: unknown;
}

function escapeForSingleQuoteShell(value: string): string {
	return value.replace(/'/g, `'"'"'`);
}

function normalizeHeaders(headers: unknown): Record<string, string | string[]> {
	if (!headers || typeof headers !== 'object') {
		return {};
	}

	return headers as Record<string, string | string[]>;
}

function buildCurlCommand(log: InspectorLog): string {
	const method = (typeof log.method === 'string' && log.method.trim()) ? log.method.toUpperCase() : 'GET';
	const rawUrl = (typeof log.url === 'string' && log.url.trim()) ? log.url : '/';
	const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `http://localhost${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
	const headers = normalizeHeaders(log.headers);
	const body = typeof log.body === 'string' ? log.body : '';

	const segments: string[] = [`curl --location --request ${method} '${escapeForSingleQuoteShell(url)}'`];

	for (const [key, value] of Object.entries(headers)) {
		if (typeof value === 'string') {
			segments.push(`--header '${escapeForSingleQuoteShell(`${key}: ${value}`)}'`);
		} else if (Array.isArray(value)) {
			for (const item of value) {
				segments.push(`--header '${escapeForSingleQuoteShell(`${key}: ${String(item)}`)}'`);
			}
		}
	}

	if (body) {
		segments.push(`--data-raw '${escapeForSingleQuoteShell(body)}'`);
	}

	return segments.join(' \\\n  ');
}

async function copyCurlCommand(log: InspectorLog): Promise<void> {
	const curl = buildCurlCommand(log);
	await vscode.env.clipboard.writeText(curl);
	void vscode.window.showInformationMessage('Request cURL copied to clipboard. Paste it into Postman Import > Raw text.');
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
