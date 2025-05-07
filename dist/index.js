#!/usr/bin/env node
// Redirect all console output to stderr to keep stdout clean for JSON-RPC
const originalConsoleLog = console.log;
console.log = function (...args) {
    console.error("[LOG]", ...args);
};
import dotenv from "dotenv";
// Initialize dotenv
dotenv.config();
import { authenticate } from "@google-cloud/local-auth";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, ListResourcesRequestSchema, ListPromptsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import { URL } from "url";
import { registerBrowserbaseTools, getBrowserbaseTools, } from "./integrations/browserbase/index.js";
import { registerGoogleMapsTools, getGoogleMapsTools, } from "./integrations/google-maps/index.js";
// Create a logger that uses stderr instead of stdout to avoid interfering with JSON-RPC
const logger = {
    info: (message, ...args) => console.error(`[INFO] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
    warn: (message, ...args) => console.error(`[WARN] ${message}`, ...args),
};
// Constants
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const sheets = google.sheets("v4");
// Determine paths for credentials and keys
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credentialsPath = process.env.GSHEETS_CREDENTIALS_PATH ||
    path.join(__dirname, ".gsheets-server-credentials.json");
const gcpKeysPath = process.env.GSHEETS_OAUTH_PATH || path.join(__dirname, "gcp-oauth.keys.json");
const server = new Server({
    name: "TravelPlanner",
    version: "0.0.1",
}, {
    capabilities: {
        resources: {
            supported: true,
        },
        tools: {
            supported: true,
        },
        prompts: {
            supported: true,
        },
    },
});
// Register Browserbase tools first if API key is available
if (process.env.BROWSERBASE_API_KEY) {
    logger.info("Registering Browserbase tools...");
    registerBrowserbaseTools(server);
}
// Register Google Maps tools if API key is available
if (process.env.GOOGLE_MAPS_API_KEY) {
    logger.info("Registering Google Maps tools...");
    registerGoogleMapsTools(server);
}
const execAsync = promisify(exec);
/**
 * Helper function to handle authentication errors and refresh token when needed
 */
async function handleAuthError(error) {
    if (error.message?.includes("invalid_grant") ||
        error.message?.includes("token expired") ||
        error.message?.includes("unauthorized") ||
        error.message?.includes("invalid_token") ||
        error.code === 401) {
        logger.error("Authentication error detected, refreshing token...");
        try {
            // Try refreshing the token first instead of immediately triggering full re-auth
            const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
            const { client_id, client_secret, redirect_uri } = getOAuthClientCredentials();
            // Try to refresh the token if we have a refresh_token
            if (credentials.refresh_token) {
                try {
                    logger.info("Attempting to refresh token using refresh_token...");
                    // Create a new OAuth client for token refresh
                    const authClient = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
                    // Set credentials with the refresh token
                    authClient.setCredentials({
                        refresh_token: credentials.refresh_token,
                    });
                    // Force token refresh by using a method that's not protected
                    const result = await authClient.getAccessToken();
                    const newToken = result.token;
                    const newExpiry = new Date().getTime() + 3600 * 1000; // Default 1 hour
                    if (newToken) {
                        // Save the refreshed credentials
                        const refreshedCredentials = {
                            ...credentials,
                            access_token: newToken,
                            expiry_date: newExpiry,
                        };
                        fs.writeFileSync(credentialsPath, JSON.stringify(refreshedCredentials));
                        authClient.setCredentials(refreshedCredentials);
                        google.options({ auth: authClient });
                        logger.info("Token refreshed successfully without requiring re-authentication");
                        return true;
                    }
                    else {
                        logger.info("Token refresh returned empty token, falling back to full re-auth");
                    }
                }
                catch (refreshError) {
                    logger.info("Token refresh failed, falling back to full re-auth:", refreshError.message);
                    // Fall back to full re-auth
                }
            }
            // If token refresh failed or no refresh token, fall back to full re-auth
            const auth = await authenticateAndSaveCredentials();
            google.options({ auth });
            logger.info("Authentication refreshed successfully via full re-auth flow");
            return true;
        }
        catch (refreshError) {
            logger.error("Failed to refresh authentication:", refreshError.message);
            return false;
        }
    }
    return false;
}
/**
 * Helper function to get OAuth client credentials from the keys file
 */
function getOAuthClientCredentials() {
    try {
        const keyFileContent = fs.readFileSync(gcpKeysPath, "utf-8");
        const keyFile = JSON.parse(keyFileContent);
        // Get client ID and client secret
        let clientId = "";
        let clientSecret = "";
        let redirectUri = "";
        if (keyFile.installed) {
            clientId = keyFile.installed.client_id;
            clientSecret = keyFile.installed.client_secret;
            redirectUri = keyFile.installed.redirect_uris?.[0] || "";
        }
        else if (keyFile.web) {
            clientId = keyFile.web.client_id;
            clientSecret = keyFile.web.client_secret;
            redirectUri = keyFile.web.redirect_uris?.[0] || "";
        }
        return {
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
        };
    }
    catch (error) {
        logger.error("Error reading OAuth credentials:", error);
        return { client_id: "", client_secret: "", redirect_uri: "" };
    }
}
/**
 * Helper function to get sheet title
 */
async function getSheetTitle(spreadsheetId, sheetName) {
    if (sheetName)
        return sheetName;
    try {
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
        });
        if (!spreadsheet.data.sheets || !spreadsheet.data.sheets.length) {
            throw new Error("Spreadsheet has no sheets");
        }
        return spreadsheet.data.sheets[0].properties?.title || "";
    }
    catch (error) {
        if (await handleAuthError(error)) {
            // Retry after auth refresh
            return getSheetTitle(spreadsheetId, sheetName);
        }
        throw error;
    }
}
/**
 * Helper function to get sheet ID
 */
async function getSheetId(spreadsheetId, sheetName) {
    try {
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
        });
        if (!spreadsheet.data.sheets || !spreadsheet.data.sheets.length) {
            throw new Error("Spreadsheet has no sheets");
        }
        if (sheetName) {
            const sheet = spreadsheet.data.sheets.find((s) => s.properties?.title === sheetName);
            if (!sheet) {
                throw new Error(`Sheet "${sheetName}" not found`);
            }
            return sheet.properties?.sheetId || 0;
        }
        return spreadsheet.data.sheets[0].properties?.sheetId || 0;
    }
    catch (error) {
        if (await handleAuthError(error)) {
            // Retry after auth refresh
            return getSheetId(spreadsheetId, sheetName);
        }
        throw error;
    }
}
/**
 * Helper function to convert column letter to index (A=0, B=1, etc.)
 */
function columnLetterToIndex(column) {
    let result = 0;
    for (let i = 0; i < column.length; i++) {
        result = result * 26 + (column.charCodeAt(i) - "A".charCodeAt(0) + 1);
    }
    return result - 1; // 0-based index
}
server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
    const fileId = request.params.uri.replace("gsheets:///", "");
    try {
        // Get spreadsheet information
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: fileId,
        });
        // Get first sheet data as CSV
        if (spreadsheet.data.sheets && spreadsheet.data.sheets.length > 0) {
            const sheetTitle = spreadsheet.data.sheets[0].properties?.title;
            const range = `${sheetTitle}`;
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: fileId,
                range,
            });
            // Convert values to CSV
            const values = res.data.values || [];
            const csv = values.map((row) => row.join(",")).join("\n");
            return {
                contents: [
                    {
                        uri: request.params.uri,
                        mimeType: "text/csv",
                        text: csv,
                    },
                ],
            };
        }
        return {
            contents: [
                {
                    uri: request.params.uri,
                    mimeType: "text/plain",
                    text: "Empty spreadsheet",
                },
            ],
        };
    }
    catch (error) {
        if (await handleAuthError(error)) {
            // After refreshing auth, try the operation again
            try {
                // Get spreadsheet information with refreshed auth
                const spreadsheet = await sheets.spreadsheets.get({
                    spreadsheetId: fileId,
                });
                // Get first sheet data as CSV
                if (spreadsheet.data.sheets && spreadsheet.data.sheets.length > 0) {
                    const sheetTitle = spreadsheet.data.sheets[0].properties?.title;
                    const range = `${sheetTitle}`;
                    const res = await sheets.spreadsheets.values.get({
                        spreadsheetId: fileId,
                        range,
                    });
                    // Convert values to CSV
                    const values = res.data.values || [];
                    const csv = values.map((row) => row.join(",")).join("\n");
                    return {
                        contents: [
                            {
                                uri: request.params.uri,
                                mimeType: "text/csv",
                                text: csv,
                            },
                        ],
                    };
                }
                return {
                    contents: [
                        {
                            uri: request.params.uri,
                            mimeType: "text/plain",
                            text: "Empty spreadsheet",
                        },
                    ],
                };
            }
            catch (retryError) {
                return {
                    contents: [
                        {
                            uri: request.params.uri,
                            mimeType: "text/plain",
                            text: `Error after authentication refresh: ${retryError.message}`,
                        },
                    ],
                };
            }
        }
        return {
            contents: [
                {
                    uri: request.params.uri,
                    mimeType: "text/plain",
                    text: `Error reading spreadsheet: ${error.message}`,
                },
            ],
        };
    }
});
server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Google Sheets tools
    const sheetsTools = [
        {
            name: "refresh_auth",
            description: "Refresh Google Sheets authentication when credentials expire",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            name: "create_spreadsheet",
            description: "Create a new Google Spreadsheet",
            inputSchema: {
                type: "object",
                properties: {
                    title: {
                        type: "string",
                        description: "The title for the new spreadsheet",
                    },
                    initialSheetName: {
                        type: "string",
                        description: "The name for the initial sheet (optional)",
                    },
                },
                required: ["title"],
            },
        },
        {
            name: "list_sheets",
            description: "List all sheets/tabs in a Google Spreadsheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                },
                required: ["spreadsheetId"],
            },
        },
        {
            name: "create_sheet",
            description: "Create a new sheet/tab in a Google Spreadsheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    sheetName: {
                        type: "string",
                        description: "The name for the new sheet",
                    },
                },
                required: ["spreadsheetId", "sheetName"],
            },
        },
        {
            name: "read_all_from_sheet",
            description: "Read all data from a specified sheet in a Google Spreadsheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    sheetName: {
                        type: "string",
                        description: "The name of the sheet (optional, defaults to first sheet)",
                    },
                },
                required: ["spreadsheetId"],
            },
        },
        {
            name: "read_headings",
            description: "Read the column headings from a Google Sheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    sheetName: {
                        type: "string",
                        description: "The name of the sheet (optional, defaults to first sheet)",
                    },
                },
                required: ["spreadsheetId"],
            },
        },
        {
            name: "read_rows",
            description: "Read rows from a Google Sheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    sheetName: {
                        type: "string",
                        description: "The name of the sheet (optional, defaults to first sheet)",
                    },
                    startRow: {
                        type: "integer",
                        description: "The starting row index (0-based, inclusive)",
                    },
                    endRow: {
                        type: "integer",
                        description: "The ending row index (0-based, inclusive)",
                    },
                },
                required: ["spreadsheetId", "startRow", "endRow"],
            },
        },
        {
            name: "read_columns",
            description: "Read columns from a Google Sheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    sheetName: {
                        type: "string",
                        description: "The name of the sheet (optional, defaults to first sheet)",
                    },
                    columns: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                        description: "Array of column letters (e.g. ['A', 'C'])",
                    },
                },
                required: ["spreadsheetId", "columns"],
            },
        },
        {
            name: "edit_cell",
            description: "Edit a cell in a Google Sheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    sheetName: {
                        type: "string",
                        description: "The name of the sheet (optional, defaults to first sheet)",
                    },
                    cellAddress: {
                        type: "string",
                        description: "The cell address in A1 notation (e.g., 'B2')",
                    },
                    value: {
                        type: "string",
                        description: "The new value for the cell",
                    },
                },
                required: ["spreadsheetId", "cellAddress", "value"],
            },
        },
        {
            name: "edit_row",
            description: "Edit an entire row in a Google Sheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    sheetName: {
                        type: "string",
                        description: "The name of the sheet (optional, defaults to first sheet)",
                    },
                    rowIndex: {
                        type: "integer",
                        description: "The row index (1-based)",
                    },
                    values: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                        description: "Array of values for the row",
                    },
                },
                required: ["spreadsheetId", "rowIndex", "values"],
            },
        },
        {
            name: "edit_column",
            description: "Edit an entire column in a Google Sheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    sheetName: {
                        type: "string",
                        description: "The name of the sheet (optional, defaults to first sheet)",
                    },
                    columnLetter: {
                        type: "string",
                        description: "The column letter (e.g., 'A')",
                    },
                    values: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                        description: "Array of values for the column",
                    },
                },
                required: ["spreadsheetId", "columnLetter", "values"],
            },
        },
        {
            name: "insert_row",
            description: "Insert a new row at specified position in a Google Sheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    sheetName: {
                        type: "string",
                        description: "The name of the sheet (optional, defaults to first sheet)",
                    },
                    rowIndex: {
                        type: "integer",
                        description: "The row index where to insert (1-based)",
                    },
                    values: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                        description: "Array of values for the new row (optional)",
                    },
                },
                required: ["spreadsheetId", "rowIndex"],
            },
        },
        {
            name: "insert_column",
            description: "Insert a new column at specified position in a Google Sheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    sheetName: {
                        type: "string",
                        description: "The name of the sheet (optional, defaults to first sheet)",
                    },
                    columnLetter: {
                        type: "string",
                        description: "The column letter where to insert (e.g., 'B')",
                    },
                    values: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                        description: "Array of values for the new column (optional)",
                    },
                },
                required: ["spreadsheetId", "columnLetter"],
            },
        },
        {
            name: "rename_sheet",
            description: "Rename a sheet/tab in a Google Spreadsheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    sheetName: {
                        type: "string",
                        description: "The current name of the sheet",
                    },
                    newName: {
                        type: "string",
                        description: "The new name for the sheet",
                    },
                },
                required: ["spreadsheetId", "sheetName", "newName"],
            },
        },
        {
            name: "rename_doc",
            description: "Rename the Google Spreadsheet",
            inputSchema: {
                type: "object",
                properties: {
                    spreadsheetId: {
                        type: "string",
                        description: "The ID of the spreadsheet",
                    },
                    newName: {
                        type: "string",
                        description: "The new name for the spreadsheet",
                    },
                },
                required: ["spreadsheetId", "newName"],
            },
        },
    ];
    // Add Browserbase tools if available
    let allTools = [...sheetsTools];
    if (typeof getBrowserbaseTools === "function") {
        try {
            const browserbaseTools = getBrowserbaseTools();
            if (Array.isArray(browserbaseTools)) {
                allTools = allTools.concat(browserbaseTools);
            }
        }
        catch (error) {
            logger.error("Error getting Browserbase tools:", error);
        }
    }
    // Add Google Maps tools if available
    if (typeof getGoogleMapsTools === "function") {
        try {
            const googleMapsTools = getGoogleMapsTools();
            if (Array.isArray(googleMapsTools)) {
                allTools = allTools.concat(googleMapsTools);
            }
        }
        catch (error) {
            logger.error("Error getting Google Maps tools:", error);
        }
    }
    return {
        tools: allTools,
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "refresh_auth": {
                try {
                    await authenticateAndSaveCredentials();
                    // Reload credentials
                    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
                    const auth = new google.auth.OAuth2();
                    auth.setCredentials(credentials);
                    google.options({ auth });
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Authentication refreshed successfully. You can now continue using Google Sheets.",
                            },
                        ],
                        isError: false,
                    };
                }
                catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Failed to refresh authentication: ${error.message}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }
            case "create_spreadsheet": {
                // Fix the type casting for args
                const typedArgs = args;
                const { title, initialSheetName = "Sheet1" } = typedArgs;
                const resource = {
                    properties: {
                        title: title,
                    },
                    sheets: [
                        {
                            properties: {
                                title: initialSheetName,
                            },
                        },
                    ],
                };
                const response = await sheets.spreadsheets.create({
                    requestBody: resource,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                message: `Spreadsheet "${title}" created successfully.`,
                                spreadsheetId: response.data.spreadsheetId,
                                spreadsheetUrl: response.data.spreadsheetUrl,
                            }, null, 2),
                        },
                    ],
                    isError: false,
                };
            }
            case "list_sheets": {
                const { spreadsheetId } = args;
                const spreadsheet = await sheets.spreadsheets.get({
                    spreadsheetId,
                });
                if (!spreadsheet.data.sheets || !spreadsheet.data.sheets.length) {
                    throw new Error("Spreadsheet has no sheets");
                }
                const sheetsList = spreadsheet.data.sheets.map((sheet) => ({
                    title: sheet.properties?.title,
                    sheetId: sheet.properties?.sheetId,
                    index: sheet.properties?.index,
                }));
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(sheetsList, null, 2),
                        },
                    ],
                    isError: false,
                };
            }
            case "create_sheet": {
                const { spreadsheetId, sheetName } = args;
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                addSheet: {
                                    properties: {
                                        title: sheetName,
                                    },
                                },
                            },
                        ],
                    },
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Sheet "${sheetName}" created successfully.`,
                        },
                    ],
                    isError: false,
                };
            }
            case "read_all_from_sheet": {
                const { spreadsheetId, sheetName } = args;
                const title = await getSheetTitle(spreadsheetId, sheetName);
                const res = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: title,
                });
                const data = res.data.values || [];
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(data, null, 2),
                        },
                    ],
                    isError: false,
                };
            }
            case "read_headings": {
                const { spreadsheetId, sheetName } = args;
                const title = await getSheetTitle(spreadsheetId, sheetName);
                const res = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: `${title}!1:1`,
                });
                const headings = res.data.values?.[0] || [];
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(headings, null, 2),
                        },
                    ],
                    isError: false,
                };
            }
            case "read_rows": {
                const { spreadsheetId, sheetName, startRow, endRow } = args;
                const title = await getSheetTitle(spreadsheetId, sheetName);
                // Convert to 1-based for Sheets API
                const adjustedStartRow = startRow + 1;
                const adjustedEndRow = endRow + 1;
                const res = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: `${title}!${adjustedStartRow}:${adjustedEndRow}`,
                });
                const rows = res.data.values || [];
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(rows, null, 2),
                        },
                    ],
                    isError: false,
                };
            }
            case "read_columns": {
                const { spreadsheetId, sheetName, columns } = args;
                const title = await getSheetTitle(spreadsheetId, sheetName);
                const result = {};
                for (const column of columns) {
                    const res = await sheets.spreadsheets.values.get({
                        spreadsheetId,
                        range: `${title}!${column}:${column}`,
                    });
                    result[column] = (res.data.values || []).map((row) => row[0]);
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                    isError: false,
                };
            }
            case "edit_cell": {
                const { spreadsheetId, sheetName, cellAddress, value } = args;
                const title = await getSheetTitle(spreadsheetId, sheetName);
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${title}!${cellAddress}`,
                    valueInputOption: "USER_ENTERED",
                    requestBody: {
                        values: [[value]],
                    },
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Cell ${cellAddress} updated successfully to "${value}".`,
                        },
                    ],
                    isError: false,
                };
            }
            case "edit_row": {
                const { spreadsheetId, sheetName, rowIndex, values } = args;
                const title = await getSheetTitle(spreadsheetId, sheetName);
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${title}!${rowIndex}:${rowIndex}`,
                    valueInputOption: "USER_ENTERED",
                    requestBody: {
                        values: [values],
                    },
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Row ${rowIndex} updated successfully.`,
                        },
                    ],
                    isError: false,
                };
            }
            case "edit_column": {
                const { spreadsheetId, sheetName, columnLetter, values } = args;
                const title = await getSheetTitle(spreadsheetId, sheetName);
                // Convert array of values to array of arrays for the API
                const formattedValues = values.map((value) => [value]);
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${title}!${columnLetter}:${columnLetter}`,
                    valueInputOption: "USER_ENTERED",
                    requestBody: {
                        values: formattedValues,
                    },
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Column ${columnLetter} updated successfully.`,
                        },
                    ],
                    isError: false,
                };
            }
            case "insert_row": {
                const { spreadsheetId, sheetName, rowIndex, values = [] } = args;
                const sheetId = await getSheetId(spreadsheetId, sheetName);
                const title = await getSheetTitle(spreadsheetId, sheetName);
                // First, insert the row
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                insertDimension: {
                                    range: {
                                        sheetId: sheetId,
                                        dimension: "ROWS",
                                        startIndex: rowIndex - 1, // Convert to 0-based index
                                        endIndex: rowIndex, // non-inclusive end index
                                    },
                                },
                            },
                        ],
                    },
                });
                // Then, if values were provided, update the row with the values
                if (values.length > 0) {
                    await sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range: `${title}!${rowIndex}:${rowIndex}`,
                        valueInputOption: "USER_ENTERED",
                        requestBody: {
                            values: [values],
                        },
                    });
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: `Row inserted successfully at position ${rowIndex}.`,
                        },
                    ],
                    isError: false,
                };
            }
            case "insert_column": {
                const { spreadsheetId, sheetName, columnLetter, values = [], } = args;
                const sheetId = await getSheetId(spreadsheetId, sheetName);
                const title = await getSheetTitle(spreadsheetId, sheetName);
                // Convert column letter to index
                const columnIndex = columnLetterToIndex(columnLetter);
                // First, insert the column
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                insertDimension: {
                                    range: {
                                        sheetId: sheetId,
                                        dimension: "COLUMNS",
                                        startIndex: columnIndex,
                                        endIndex: columnIndex + 1, // non-inclusive end index
                                    },
                                },
                            },
                        ],
                    },
                });
                // Then, if values were provided, update the column with the values
                if (values.length > 0) {
                    // Format values for API
                    const formattedValues = values.map((value) => [value]);
                    await sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range: `${title}!${columnLetter}:${columnLetter}`,
                        valueInputOption: "USER_ENTERED",
                        requestBody: {
                            values: formattedValues,
                        },
                    });
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: `Column inserted successfully at position ${columnLetter}.`,
                        },
                    ],
                    isError: false,
                };
            }
            case "rename_sheet": {
                const { spreadsheetId, sheetName, newName } = args;
                const sheetId = await getSheetId(spreadsheetId, sheetName);
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                updateSheetProperties: {
                                    properties: {
                                        sheetId: sheetId,
                                        title: newName,
                                    },
                                    fields: "title",
                                },
                            },
                        ],
                    },
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Sheet renamed from "${sheetName}" to "${newName}" successfully.`,
                        },
                    ],
                    isError: false,
                };
            }
            case "rename_doc": {
                const { spreadsheetId, newName } = args;
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                updateSpreadsheetProperties: {
                                    properties: {
                                        title: newName,
                                    },
                                    fields: "title",
                                },
                            },
                        ],
                    },
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `Spreadsheet renamed to "${newName}" successfully.`,
                        },
                    ],
                    isError: false,
                };
            }
            default:
                throw new Error(`Tool '${name}' not found`);
        }
    }
    catch (error) {
        // Try to refresh auth if it's an authentication error
        if (await handleAuthError(error)) {
            // After refreshing auth, we just try the operation again with the same params
            try {
                // This is a simplified retry approach that avoids using handleRequest
                switch (name) {
                    case "create_spreadsheet": {
                        const typedArgs = args;
                        const { title, initialSheetName = "Sheet1" } = typedArgs;
                        const resource = {
                            properties: {
                                title: title,
                            },
                            sheets: [
                                {
                                    properties: {
                                        title: initialSheetName,
                                    },
                                },
                            ],
                        };
                        const response = await sheets.spreadsheets.create({
                            requestBody: resource,
                        });
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify({
                                        message: `Spreadsheet "${title}" created successfully.`,
                                        spreadsheetId: response.data.spreadsheetId,
                                        spreadsheetUrl: response.data.spreadsheetUrl,
                                    }, null, 2),
                                },
                            ],
                            isError: false,
                        };
                    }
                    // Add cases for other operations as needed
                    default:
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Authentication refreshed. Please try your operation again.",
                                },
                            ],
                            isError: false,
                        };
                }
            }
            catch (retryError) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error after authentication refresh: ${retryError.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
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
// Add handler for resources/list
server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    // Return an empty list as we don't have specific resources to list
    return {
        resources: [],
        nextPageToken: null,
    };
});
// Add handler for prompts/list
server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
    // Return an empty list as we don't have any prompts
    return {
        prompts: [],
        nextPageToken: null,
    };
});
/**
 * Check if a port is available
 */
async function isPortAvailable(port) {
    try {
        // Check if port is in use using 'lsof' on Mac/Linux or 'netstat' on Windows
        const isWindows = process.platform === "win32";
        const command = isWindows
            ? `netstat -an | findstr :${port}`
            : `lsof -i :${port}`;
        const { stdout } = await execAsync(command);
        // If the command returns output, the port is in use
        return !stdout.trim();
    }
    catch (error) {
        // Command failed or returned non-zero exit code (port not in use)
        return true;
    }
}
/**
 * Try authentication with alternative ports if the default one is not available
 */
async function tryAuthWithAlternativePorts() {
    // Try a range of alternative ports
    const alternativePorts = [3001, 3002, 3003, 3004, 3005];
    for (const port of alternativePorts) {
        // Create a temporary credentials file with the alternative port
        const tempKeysPath = path.join(__dirname, `.temp-gcp-oauth-${port}.json`);
        try {
            // Read the original OAuth key file
            const keyFileContent = fs.readFileSync(gcpKeysPath, "utf-8");
            const keyFile = JSON.parse(keyFileContent);
            // Update the redirect URIs to use the alternative port
            if (keyFile.installed && keyFile.installed.redirect_uris) {
                keyFile.installed.redirect_uris = keyFile.installed.redirect_uris.map((uri) => uri.replace(/:[0-9]+\//, `:${port}/`));
            }
            else if (keyFile.web && keyFile.web.redirect_uris) {
                keyFile.web.redirect_uris = keyFile.web.redirect_uris.map((uri) => uri.replace(/:[0-9]+\//, `:${port}/`));
            }
            // Write the modified credentials to a temporary file
            fs.writeFileSync(tempKeysPath, JSON.stringify(keyFile));
            // Check if the port is available
            const portAvailable = await isPortAvailable(port);
            if (!portAvailable) {
                logger.info(`Alternative port ${port} is also in use, trying next...`);
                continue;
            }
            logger.info(`Trying authentication with port ${port}...`);
            // Attempt authentication with the alternative port
            const auth = await authenticate({
                keyfilePath: tempKeysPath,
                scopes: SCOPES,
            });
            // Save the credentials
            fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials));
            logger.info(`Authentication successful using port ${port}.`);
            return auth;
        }
        catch (error) {
            logger.info(`Failed to authenticate with port ${port}: ${error.message}`);
            // Continue to the next port
        }
    }
    // If all alternative ports failed, throw an error
    throw new Error("Authentication failed with all alternative ports. Please update your OAuth credentials in Google Cloud Console.");
}
/**
 * Authenticate and save credentials
 */
async function authenticateAndSaveCredentials() {
    if (!fs.existsSync(gcpKeysPath)) {
        logger.error("GCP keys not found. Please create your credentials in Google Cloud then copy `gcp-oauth.keys.json` into your ./dist directory.");
        process.exit(1);
    }
    logger.info("Launching auth flow...");
    try {
        // Read the original OAuth key file to get the registered redirect URI
        const keyFileContent = fs.readFileSync(gcpKeysPath, "utf-8");
        const keyFile = JSON.parse(keyFileContent);
        // Get the registered redirect URI
        let redirectUri = null;
        if (keyFile.installed &&
            keyFile.installed.redirect_uris &&
            keyFile.installed.redirect_uris.length > 0) {
            redirectUri = keyFile.installed.redirect_uris[0];
        }
        else if (keyFile.web &&
            keyFile.web.redirect_uris &&
            keyFile.web.redirect_uris.length > 0) {
            redirectUri = keyFile.web.redirect_uris[0];
        }
        if (!redirectUri) {
            throw new Error("No redirect URI found in the credentials file");
        }
        // Parse the redirect URI to get the registered port
        const parsedUri = new URL(redirectUri);
        const registeredPort = parseInt(parsedUri.port || "3000", 10);
        // Check if the registered port is available
        const isRegisteredPortAvailable = await isPortAvailable(registeredPort);
        if (isRegisteredPortAvailable) {
            // If the registered port is available, use it directly
            logger.info(`Using registered port ${registeredPort} for authentication...`);
            const auth = await authenticate({
                keyfilePath: gcpKeysPath,
                scopes: SCOPES,
            });
            fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials));
            logger.info("Credentials saved successfully.");
            return auth;
        }
        else {
            // Try alternative ports instead of failing immediately
            logger.info(`Registered port ${registeredPort} is already in use.`);
            logger.info("Trying alternative ports...");
            return await tryAuthWithAlternativePorts();
        }
    }
    catch (error) {
        logger.error("Authentication failed:", error.message);
        throw error;
    }
}
/**
 * Load credentials and start the server
 */
async function loadCredentialsAndRunServer() {
    let auth;
    let authRetries = 0;
    const MAX_AUTH_RETRIES = 3;
    async function setupAuth() {
        if (!fs.existsSync(credentialsPath)) {
            logger.info("Credentials not found. Starting authentication flow...");
            return await authenticateAndSaveCredentials();
        }
        try {
            const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
            const { client_id, client_secret, redirect_uri } = getOAuthClientCredentials();
            // Create OAuth client
            const authClient = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
            authClient.setCredentials(credentials);
            // Check if token is expired or about to expire (within 5 minutes)
            const expiryDate = credentials.expiry_date;
            const isExpired = !expiryDate || new Date().getTime() > expiryDate - 5 * 60 * 1000;
            if (isExpired && credentials.refresh_token) {
                logger.info("Token is expired or about to expire. Attempting to refresh...");
                try {
                    // Set credentials with the refresh token
                    authClient.setCredentials({
                        refresh_token: credentials.refresh_token,
                    });
                    // Force token refresh
                    const result = await authClient.getAccessToken();
                    const newToken = result.token;
                    const newExpiry = new Date().getTime() + 3600 * 1000; // Default 1 hour
                    if (newToken) {
                        // Update credentials with new token
                        const refreshedCredentials = {
                            ...credentials,
                            access_token: newToken,
                            expiry_date: newExpiry,
                        };
                        fs.writeFileSync(credentialsPath, JSON.stringify(refreshedCredentials));
                        authClient.setCredentials(refreshedCredentials);
                        logger.info("Token refreshed successfully at startup");
                        return authClient;
                    }
                }
                catch (refreshError) {
                    logger.info("Token refresh failed at startup:", refreshError.message);
                    // Fall through to token validation
                }
            }
            // Verify token validity only if not already refreshed
            try {
                // Only validate if we have an access token
                if (credentials.access_token) {
                    logger.info("Validating existing token...");
                    const tokenInfo = await authClient.getTokenInfo(credentials.access_token);
                    logger.info("Auth token validated successfully");
                    return authClient;
                }
                else {
                    logger.info("No access token found, initiating authentication flow...");
                    return await authenticateAndSaveCredentials();
                }
            }
            catch (tokenError) {
                logger.info("Token validation failed, refreshing...");
                return await authenticateAndSaveCredentials();
            }
        }
        catch (error) {
            logger.error("Error loading credentials, initiating new authentication flow:", error.message);
            return await authenticateAndSaveCredentials();
        }
    }
    try {
        auth = await setupAuth();
        google.options({ auth });
        logger.info("Starting server...");
        const transport = new StdioServerTransport();
        await server.connect(transport);
    }
    catch (error) {
        logger.error("Server initialization error:", error);
        if (authRetries < MAX_AUTH_RETRIES &&
            (error.message?.includes("auth") || error.message?.includes("token"))) {
            authRetries++;
            logger.info(`Retrying authentication (attempt ${authRetries}/${MAX_AUTH_RETRIES})...`);
            await loadCredentialsAndRunServer();
        }
        else {
            logger.error("Failed to initialize server after retries");
            process.exit(1);
        }
    }
}
// Handle auth internally and start server
loadCredentialsAndRunServer().catch((error) => {
    logger.error("Fatal error:", error);
    process.exit(1);
});
