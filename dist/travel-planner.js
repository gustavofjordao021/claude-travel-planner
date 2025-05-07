#!/usr/bin/env node
import { google } from "googleapis";
// Import the MCP server and transport from the SDK
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListPromptsRequestSchema, ListResourcesRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// Import the prompts loader and custom auth callback server
// @ts-ignore - Module without type definitions
import { loadPrompts } from "./prompts/loader.js";
import { logger } from "./utils/logger.js";
import { initializeAuth } from "./auth/google-auth.js";
// Import sheets and maps tools
import * as sheetTools from "./sheets/tools.js";
import * as mapsTools from "./maps/tools.js";
// Create the MCP server
const server = new Server({
    name: "travel-planner",
    version: "0.1.0",
}, {
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    },
});
// Global flag to detect if auth has been invalidated
let authInvalidated = false;
// List the available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "create_spreadsheet",
                description: "Create a new Google Spreadsheet",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "The title of the spreadsheet.",
                        },
                        initialSheetName: {
                            type: "string",
                            description: "The name of the initial sheet, defaults to 'Itinerary'.",
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
                            description: "The ID of the spreadsheet.",
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
                            description: "The ID of the spreadsheet.",
                        },
                        sheetName: {
                            type: "string",
                            description: "The name of the new sheet.",
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
                            description: "The ID of the spreadsheet.",
                        },
                        sheetName: {
                            type: "string",
                            description: "The name of the sheet to read from. If not provided, reads from the first sheet.",
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
                            description: "The ID of the spreadsheet.",
                        },
                        sheetName: {
                            type: "string",
                            description: "The name of the sheet to read from. If not provided, reads from the first sheet.",
                        },
                    },
                    required: ["spreadsheetId"],
                },
            },
            {
                name: "read_rows",
                description: "Read specific rows from a sheet",
                inputSchema: {
                    type: "object",
                    properties: {
                        spreadsheetId: {
                            type: "string",
                            description: "The ID of the spreadsheet.",
                        },
                        sheetName: {
                            type: "string",
                            description: "The name of the sheet to read from. If not provided, reads from the first sheet.",
                        },
                        startRowIndex: {
                            type: "integer",
                            description: "The 0-based row index to start reading from. Default is 0.",
                        },
                        endRowIndex: {
                            type: "integer",
                            description: "The 0-based row index to end reading at (exclusive). Default is to read to the end.",
                        },
                    },
                    required: ["spreadsheetId"],
                },
            },
            {
                name: "read_columns",
                description: "Read specific columns from a sheet",
                inputSchema: {
                    type: "object",
                    properties: {
                        spreadsheetId: {
                            type: "string",
                            description: "The ID of the spreadsheet.",
                        },
                        sheetName: {
                            type: "string",
                            description: "The name of the sheet to read from. If not provided, reads from the first sheet.",
                        },
                        startColumnIndex: {
                            type: "integer",
                            description: "The 0-based column index to start reading from. Default is 0.",
                        },
                        endColumnIndex: {
                            type: "integer",
                            description: "The 0-based column index to end reading at (exclusive). Default is to read to the end.",
                        },
                    },
                    required: ["spreadsheetId"],
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
                            description: "The ID of the spreadsheet.",
                        },
                        sheetName: {
                            type: "string",
                            description: "The name of the sheet to edit. If not provided, edits the first sheet.",
                        },
                        rowIndex: {
                            type: "integer",
                            description: "The 0-based row index of the cell to edit.",
                        },
                        columnIndex: {
                            type: "integer",
                            description: "The 0-based column index of the cell to edit.",
                        },
                        value: {
                            type: "string",
                            description: "The new value to set in the cell.",
                        },
                    },
                    required: ["spreadsheetId", "rowIndex", "columnIndex", "value"],
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
                            description: "The ID of the spreadsheet.",
                        },
                        sheetName: {
                            type: "string",
                            description: "The name of the sheet to edit. If not provided, edits the first sheet.",
                        },
                        rowIndex: {
                            type: "integer",
                            description: "The 0-based row index to edit.",
                        },
                        values: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            description: "The values to set in the row.",
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
                            description: "The ID of the spreadsheet.",
                        },
                        sheetName: {
                            type: "string",
                            description: "The name of the sheet to edit. If not provided, edits the first sheet.",
                        },
                        columnIndex: {
                            type: "integer",
                            description: "The 0-based column index to edit.",
                        },
                        values: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            description: "The values to set in the column.",
                        },
                    },
                    required: ["spreadsheetId", "columnIndex", "values"],
                },
            },
            {
                name: "insert_row",
                description: "Insert a new row at specified position",
                inputSchema: {
                    type: "object",
                    properties: {
                        spreadsheetId: {
                            type: "string",
                            description: "The ID of the spreadsheet.",
                        },
                        sheetName: {
                            type: "string",
                            description: "The name of the sheet to edit. If not provided, edits the first sheet.",
                        },
                        rowIndex: {
                            type: "integer",
                            description: "The 0-based row index where the new row should be inserted. The new row will be inserted before this index.",
                        },
                        values: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            description: "The values to set in the new row.",
                        },
                    },
                    required: ["spreadsheetId", "rowIndex", "values"],
                },
            },
            {
                name: "insert_column",
                description: "Insert a new column at specified position",
                inputSchema: {
                    type: "object",
                    properties: {
                        spreadsheetId: {
                            type: "string",
                            description: "The ID of the spreadsheet.",
                        },
                        sheetName: {
                            type: "string",
                            description: "The name of the sheet to edit. If not provided, edits the first sheet.",
                        },
                        columnIndex: {
                            type: "integer",
                            description: "The 0-based column index where the new column should be inserted. The new column will be inserted before this index.",
                        },
                        values: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            description: "The values to set in the new column.",
                        },
                    },
                    required: ["spreadsheetId", "columnIndex", "values"],
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
                            description: "The ID of the spreadsheet.",
                        },
                        sheetName: {
                            type: "string",
                            description: "The current name of the sheet to rename.",
                        },
                        newName: {
                            type: "string",
                            description: "The new name for the sheet.",
                        },
                    },
                    required: ["spreadsheetId", "sheetName", "newName"],
                },
            },
            {
                name: "rename_doc",
                description: "Rename a Google Spreadsheet",
                inputSchema: {
                    type: "object",
                    properties: {
                        spreadsheetId: {
                            type: "string",
                            description: "The ID of the spreadsheet.",
                        },
                        newTitle: {
                            type: "string",
                            description: "The new title for the spreadsheet.",
                        },
                    },
                    required: ["spreadsheetId", "newTitle"],
                },
            },
            // Google Maps tools
            {
                name: "geocode",
                description: "Geocode an address to get coordinates",
                inputSchema: {
                    type: "object",
                    properties: {
                        address: {
                            type: "string",
                            description: "The address to geocode.",
                        },
                    },
                    required: ["address"],
                },
            },
            {
                name: "places_nearby",
                description: "Find places near a location",
                inputSchema: {
                    type: "object",
                    properties: {
                        location: {
                            type: "string",
                            description: "Location as 'lat,lng' coordinates or an address string.",
                        },
                        radius: {
                            type: "integer",
                            description: "Search radius in meters (max 50000).",
                        },
                        type: {
                            type: "string",
                            description: "Type of place (e.g., 'restaurant', 'tourist_attraction', 'hotel').",
                        },
                        keyword: {
                            type: "string",
                            description: "Keyword to filter results (optional).",
                        },
                    },
                    required: ["location"],
                },
            },
            {
                name: "distance_matrix",
                description: "Calculate distance and time between locations",
                inputSchema: {
                    type: "object",
                    properties: {
                        origins: {
                            type: "string",
                            description: "Starting location(s) as address or 'lat,lng' coordinates.",
                        },
                        destinations: {
                            type: "string",
                            description: "Destination location(s) as address or 'lat,lng' coordinates.",
                        },
                        mode: {
                            type: "string",
                            description: "Travel mode: 'driving', 'walking', 'bicycling', or 'transit'. Default is 'driving'.",
                        },
                    },
                    required: ["origins", "destinations"],
                },
            },
            {
                name: "directions",
                description: "Get directions between locations",
                inputSchema: {
                    type: "object",
                    properties: {
                        origin: {
                            type: "string",
                            description: "Starting location as address or 'lat,lng' coordinates.",
                        },
                        destination: {
                            type: "string",
                            description: "Destination location as address or 'lat,lng' coordinates.",
                        },
                        mode: {
                            type: "string",
                            description: "Travel mode: 'driving', 'walking', 'bicycling', or 'transit'. Default is 'driving'.",
                        },
                        waypoints: {
                            type: "string",
                            description: "Optional waypoints separated by '|' for multiple stops along the route.",
                        },
                    },
                    required: ["origin", "destination"],
                },
            },
            {
                name: "timezone",
                description: "Get timezone information for a location",
                inputSchema: {
                    type: "object",
                    properties: {
                        location: {
                            type: "string",
                            description: "Location as 'lat,lng' coordinates or an address string.",
                        },
                        timestamp: {
                            type: "integer",
                            description: "Optional timestamp to check timezone information for a specific time (Unix seconds).",
                        },
                    },
                    required: ["location"],
                },
            },
            {
                name: "convert_currency",
                description: "Convert currency from one to another",
                inputSchema: {
                    type: "object",
                    properties: {
                        amount: {
                            type: "number",
                            description: "Amount to convert.",
                        },
                        from: {
                            type: "string",
                            description: "Source currency code (e.g., 'USD', 'EUR').",
                        },
                        to: {
                            type: "string",
                            description: "Target currency code (e.g., 'JPY', 'GBP').",
                        },
                    },
                    required: ["amount", "from", "to"],
                },
            },
        ],
    };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    // If auth was invalidated, return a clear message to restart the server
    if (authInvalidated) {
        return {
            content: [
                {
                    type: "text",
                    text: "Authentication has expired. Please restart the MCP server to re-authenticate.",
                },
            ],
            isError: true,
        };
    }
    try {
        switch (name) {
            case "create_spreadsheet": {
                try {
                    const result = await sheetTools.createSpreadsheet(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    // Check if this is an auth error
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        // Set the global flag to prevent further tool calls
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    // For other errors, pass through normally
                    throw error;
                }
            }
            case "list_sheets": {
                try {
                    const result = await sheetTools.listSheets(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "create_sheet": {
                try {
                    const result = await sheetTools.createSheet(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "read_all_from_sheet": {
                try {
                    const result = await sheetTools.readAllFromSheet(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "read_headings": {
                try {
                    const result = await sheetTools.readHeadings(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "read_rows": {
                try {
                    const result = await sheetTools.readRows(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "read_columns": {
                try {
                    const result = await sheetTools.readColumns(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "edit_cell": {
                try {
                    const result = await sheetTools.editCell(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "edit_row": {
                try {
                    const result = await sheetTools.editRow(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "edit_column": {
                try {
                    const result = await sheetTools.editColumn(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "insert_row": {
                try {
                    const result = await sheetTools.insertRow(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "insert_column": {
                try {
                    const result = await sheetTools.insertColumn(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "rename_sheet": {
                try {
                    const result = await sheetTools.renameSheet(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "rename_doc": {
                try {
                    const result = await sheetTools.renameDoc(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            // Google Maps tools
            case "geocode": {
                try {
                    const result = await mapsTools.geocode(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "places_nearby": {
                try {
                    const result = await mapsTools.placesNearby(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "timezone": {
                try {
                    const result = await mapsTools.timezone(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "distance_matrix": {
                try {
                    const result = await mapsTools.distanceMatrix(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "directions": {
                try {
                    const result = await mapsTools.directions(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            case "convert_currency": {
                try {
                    const result = await mapsTools.convertCurrency(args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: result.content[0].text,
                            },
                        ],
                        isError: result.isError,
                    };
                }
                catch (error) {
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw error;
                }
            }
            default:
                try {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Unknown tool: ${name}`,
                            },
                        ],
                        isError: true,
                    };
                }
                catch (error) {
                    // Check if this is an auth error at the global level
                    if (error.message?.includes("invalid_grant") ||
                        error.message?.includes("token expired") ||
                        error.message?.includes("unauthorized") ||
                        error.message?.includes("invalid_token") ||
                        error.code === 401) {
                        // Set the global flag to prevent further tool calls
                        authInvalidated = true;
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "Google authentication has expired. Please restart the MCP server to re-authenticate.",
                                },
                            ],
                            isError: true,
                        };
                    }
                    // For other errors, return the error message
                    logger.error(`Error handling tool request: ${error.message}`);
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
        }
    }
    catch (error) {
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
// Handle prompts listing
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    try {
        const prompts = loadPrompts();
        return { prompts };
    }
    catch (error) {
        logger.warn("Failed to load prompts");
        return { prompts: [] };
    }
});
// Handle resources listing
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: [] };
});
// Main server initialization
async function startServer() {
    try {
        logger.info("Initializing Travel Planner server...");
        // Initialize Google authentication
        logger.info("Initializing Google authentication...");
        const authClient = await initializeAuth();
        google.options({ auth: authClient });
        logger.info("Google authentication initialized successfully");
        // Connect the server to STDIO transport
        const transport = new StdioServerTransport();
        logger.info("Connecting to transport...");
        await server.connect(transport);
        logger.info("Travel Planner MCP server started successfully");
    }
    catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
}
// Initialize and start the server
startServer().catch((error) => {
    logger.error("Error starting server:", error);
    process.exit(1);
});
