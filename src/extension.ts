// ...existing code...

import * as vscode from 'vscode';
import { startInterceptorServer, stopInterceptorServer } from './interceptorServer';

	// Start the interceptor server when extension activates
	startInterceptorServer();

	let disposable = vscode.commands.registerCommand('next-inspect.openPanel', () => {
		const panel = vscode.window.createWebviewPanel(
			'nextInspect',
			'Next.js Network Inspector',
			vscode.ViewColumn.One,
			{
				enableScripts: true
			}
		);

		panel.webview.html = getWebviewContent();

		// Connect to the WebSocket server and forward logs to the webview
		panel.webview.onDidReceiveMessage(message => {
			// For future: handle messages from webview
		});

		// Use a script in the webview to connect to the WebSocket
		// (see getWebviewContent)
	});

	context.subscriptions.push(disposable);
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
				body { font-family: sans-serif; }
				#network-log { margin-top: 1em; }
				.log-entry { border-bottom: 1px solid #eee; padding: 0.5em 0; }
				.log-entry:last-child { border-bottom: none; }
				.url { font-weight: bold; }
				.method { color: #007acc; }
				.timestamp { color: #888; font-size: 0.9em; }
			</style>
		</head>
		<body>
			<h1>Next.js Network Inspector</h1>
			<div id="network-log">No data yet.</div>
			<script>
				const logDiv = document.getElementById('network-log');
				let ws;
				function connect() {
					ws = new WebSocket('ws://localhost:8765');
					ws.onmessage = (event) => {
						const log = JSON.parse(event.data);
						const entry = document.createElement('div');
						entry.className = 'log-entry';
						entry.innerHTML = `
							<span class="timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
							<span class="method">${log.method}</span>
							<span class="url">${log.url}</span><br>
							<span>Headers: <pre>${JSON.stringify(log.headers, null, 2)}</pre></span>
							<span>Body: <pre>${log.body}</pre></span>
						`;
						if (logDiv.innerText === 'No data yet.') logDiv.innerText = '';
						logDiv.prepend(entry);
					};
					ws.onclose = () => {
						setTimeout(connect, 2000);
					};
				}
				connect();
			</script>
		</body>
		</html>
	`;
}

export function deactivate() {
	stopInterceptorServer();
}
