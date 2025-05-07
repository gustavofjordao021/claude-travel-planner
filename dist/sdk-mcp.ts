#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	ListResourcesRequestSchema,
	ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { authenticate } from "@google-cloud/local-auth";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Setup the server
const server = new Server(
	{
		name: "travel-planner",
		version: "0.1.0",
	},
	{
		capabilities: {
			resources: {},
			tools: {},
		},
	}
);

// Define a minimal test tool
const toolSpecs = [
	{
		name: "hello_world",
		description: "A simple greeting tool",
		schemaVersion: "v1",
		inputSchema: {
			type: "object",
			properties: {
				name: {
					type: "string",
					description: "Name to greet",
				},
			},
		},
		outputSchema: {
			content: [
				{
					type: "text",
					text: "Hello message",
				},
			],
		},
	},
];

// Simple hello world function
async function helloWorld(args: any) {
	const name = args.name || "world";
	return {
		content: [
			{
				type: "text",
				text: `Hello, ${name}!`,
			},
		],
		isError: false,
	};
}

// Map of tools
const tools: Record<string, Function> = {
	hello_world: helloWorld,
};

// Handle the list_tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
	console.error("Handling list_tools request");
	return {
		tools: toolSpecs,
	};
});

// Handle the list_resources request
server.setRequestHandler(ListResourcesRequestSchema, async () => {
	console.error("Handling list_resources request");
	return {
		resources: [],
	};
});

// Handle the list_prompts request
server.setRequestHandler(ListPromptsRequestSchema, async () => {
	console.error("Handling list_prompts request");
	return {
		prompts: [],
	};
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args = {} } = request.params;
	console.error(`Handling call_tool request for: ${name}`);

	try {
		if (!name) {
			throw new Error("Missing tool name");
		}

		if (!tools[name]) {
			throw new Error(`Tool '${name}' not found`);
		}

		// Call the tool
		return await tools[name](args);
	} catch (error: any) {
		console.error(`Error handling tool call: ${error.message}`);
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
});

// Start the server
async function startServer() {
	try {
		console.error("Starting server...");
		const transport = new StdioServerTransport();
		await server.connect(transport);
		console.error("Server connected successfully.");
	} catch (error: any) {
		console.error(`Failed to start server: ${error.message}`);
		process.exit(1);
	}
}

// Start the server
startServer().catch((error) => {
	console.error("Error starting server:", error);
	process.exit(1);
});
