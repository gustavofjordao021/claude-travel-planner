#!/usr/bin/env node

import fs from "fs";
import path from "path";
import * as http from "http";
import { fileURLToPath } from "url";
import { URL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CallbackServerOptions {
	port: number;
	defaultRedirectUrl?: string;
	onAuthSuccess?: (code: string) => void;
	onAuthError?: (error: string) => void;
}

/**
 * Creates and starts a server to handle OAuth callback with a custom UI
 */
export function startCallbackServer(
	options: CallbackServerOptions
): http.Server {
	const {
		port,
		defaultRedirectUrl = "https://claude.ai",
		onAuthSuccess,
		onAuthError,
	} = options;

	// Read the HTML template file
	const templatePath = path.join(__dirname, "auth-callback.html");
	let htmlTemplate: string;

	try {
		htmlTemplate = fs.readFileSync(templatePath, "utf-8");
	} catch (error) {
		console.error("Failed to read auth callback HTML template:", error);
		// Fallback to a simple HTML if the template doesn't exist
		htmlTemplate = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Google Sheets Authentication</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
                </style>
            </head>
            <body>
                <h1 id="title">Authentication Complete</h1>
                <p id="message"></p>
                <a href="${defaultRedirectUrl}">Return to Claude</a>
                <script>
                    const urlParams = new URLSearchParams(window.location.search);
                    const error = urlParams.get('error');
                    if (error) {
                        document.getElementById('title').textContent = 'Authentication Failed';
                        document.getElementById('message').textContent = 'There was an error during the authentication process: ' + error;
                    } else {
                        document.getElementById('message').textContent = 'You have been successfully authenticated. You can now return to Claude.';
                    }
                    setTimeout(() => { window.location.href = '${defaultRedirectUrl}'; }, 5000);
                </script>
            </body>
            </html>
        `;
	}

	// Create HTTP server to handle the callback
	const server: http.Server = http.createServer((req, res) => {
		const requestUrl = new URL(req.url || "/", `http://localhost:${port}`);

		// Check if this is the OAuth callback path
		if (
			requestUrl.pathname === "/auth/callback" ||
			requestUrl.pathname === "/oauth2callback"
		) {
			// Get the code or error parameter from the query string
			const code = requestUrl.searchParams.get("code");
			const error = requestUrl.searchParams.get("error");
			const state = requestUrl.searchParams.get("state"); // State parameter can be used to store redirect URL

			// Handle success or error callbacks if provided
			if (code && onAuthSuccess) {
				onAuthSuccess(code);
			} else if (error && onAuthError) {
				onAuthError(error);
			}

			// Serve the HTML page
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(htmlTemplate);
		} else {
			// Handle unknown paths
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("Not Found");
		}
	});

	// Start the server
	server.listen(port, () => {
		console.log(`Auth callback server running on http://localhost:${port}`);
	});

	// Return the server instance so it can be closed when needed
	return server;
}

// If this script is executed directly, start the server on port 3000
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const port = parseInt(process.env.AUTH_CALLBACK_PORT || "3000", 10);
	const server = startCallbackServer({ port });

	console.log(`Started standalone auth callback server on port ${port}`);
	console.log("Press Ctrl+C to stop");
}
