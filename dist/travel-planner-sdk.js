#!/usr/bin/env node
import { Server, } from "@modelcontextprotocol/sdk";
import { google } from "googleapis";
import { initializeAuth } from "./auth/google-auth.js";
import { logger } from "./utils/logger.js";
// Import tool handlers
import * as sheetTools from "./sheets/tools.js";
import * as mapsTools from "./maps/tools.js";
// Import the prompts loader
// @ts-ignore - Module without type definitions
import { loadPrompts } from "./prompts/loader.js";
// Define the tools and their handlers
const toolHandlers = {
    // Google Sheets tools
    refresh_auth: sheetTools.refreshAuth,
    create_spreadsheet: sheetTools.createSpreadsheet,
    list_sheets: sheetTools.listSheets,
    create_sheet: sheetTools.createSheet,
    read_all_from_sheet: sheetTools.readAllFromSheet,
    read_headings: sheetTools.readHeadings,
    read_rows: sheetTools.readRows,
    read_columns: sheetTools.readColumns,
    edit_cell: sheetTools.editCell,
    edit_row: sheetTools.editRow,
    edit_column: sheetTools.editColumn,
    insert_row: sheetTools.insertRow,
    insert_column: sheetTools.insertColumn,
    rename_sheet: sheetTools.renameSheet,
    rename_doc: sheetTools.renameDoc,
    // Google Maps tools
    geocode: mapsTools.geocode,
    places_nearby: mapsTools.placesNearby,
    distance_matrix: mapsTools.distanceMatrix,
    directions: mapsTools.directions,
    timezone: mapsTools.timezone,
    convert_currency: mapsTools.convertCurrency,
};
// Tool specifications
const toolSpecifications = [
    {
        name: "refresh_auth",
        description: "Refresh the Google Sheets authentication. Use this if you're experiencing authentication issues.",
        function: {
            name: "refresh_auth",
            description: "Refresh the Google Sheets authentication.",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    },
    {
        name: "create_spreadsheet",
        description: "Create a new Google Spreadsheet for travel planning.",
        function: {
            name: "create_spreadsheet",
            description: "Create a new Google Spreadsheet for travel planning.",
            parameters: {
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
    },
    {
        name: "list_sheets",
        description: "List all sheets in a Google Spreadsheet.",
        function: {
            name: "list_sheets",
            description: "List all sheets in a Google Spreadsheet.",
            parameters: {
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
    },
    {
        name: "create_sheet",
        description: "Create a new sheet in a Google Spreadsheet.",
        function: {
            name: "create_sheet",
            description: "Create a new sheet in a Google Spreadsheet.",
            parameters: {
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
    },
    {
        name: "read_all_from_sheet",
        description: "Read all data from a sheet in a Google Spreadsheet.",
        function: {
            name: "read_all_from_sheet",
            description: "Read all data from a sheet in a Google Spreadsheet.",
            parameters: {
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
    },
    {
        name: "read_headings",
        description: "Read the first row of a sheet (headers/column names).",
        function: {
            name: "read_headings",
            description: "Read the first row of a sheet (headers/column names).",
            parameters: {
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
    },
    {
        name: "read_rows",
        description: "Read rows from a Google Sheet.",
        function: {
            name: "read_rows",
            description: "Read rows from a Google Sheet.",
            parameters: {
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
                        type: "number",
                        description: "The 0-based row index to start reading from. Default is 0.",
                    },
                    endRowIndex: {
                        type: "number",
                        description: "The 0-based row index to end reading at (exclusive). Default is to read to the end.",
                    },
                },
                required: ["spreadsheetId"],
            },
        },
    },
    {
        name: "read_columns",
        description: "Read columns from a Google Sheet.",
        function: {
            name: "read_columns",
            description: "Read columns from a Google Sheet.",
            parameters: {
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
                        type: "number",
                        description: "The 0-based column index to start reading from. Default is 0.",
                    },
                    endColumnIndex: {
                        type: "number",
                        description: "The 0-based column index to end reading at (exclusive). Default is to read to the end.",
                    },
                },
                required: ["spreadsheetId"],
            },
        },
    },
    {
        name: "edit_cell",
        description: "Edit a single cell in a Google Sheet.",
        function: {
            name: "edit_cell",
            description: "Edit a single cell in a Google Sheet.",
            parameters: {
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
                        type: "number",
                        description: "The 0-based row index of the cell to edit.",
                    },
                    columnIndex: {
                        type: "number",
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
    },
    {
        name: "edit_row",
        description: "Edit a row in a Google Sheet.",
        function: {
            name: "edit_row",
            description: "Edit a row in a Google Sheet.",
            parameters: {
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
                        type: "number",
                        description: "The 0-based row index to edit.",
                    },
                    values: {
                        type: "array",
                        description: "The values to set in the row.",
                        items: {
                            type: "string",
                        },
                    },
                },
                required: ["spreadsheetId", "rowIndex", "values"],
            },
        },
    },
    {
        name: "edit_column",
        description: "Edit a column in a Google Sheet.",
        function: {
            name: "edit_column",
            description: "Edit a column in a Google Sheet.",
            parameters: {
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
                        type: "number",
                        description: "The 0-based column index to edit.",
                    },
                    values: {
                        type: "array",
                        description: "The values to set in the column.",
                        items: {
                            type: "string",
                        },
                    },
                },
                required: ["spreadsheetId", "columnIndex", "values"],
            },
        },
    },
    {
        name: "insert_row",
        description: "Insert a new row into a Google Sheet.",
        function: {
            name: "insert_row",
            description: "Insert a new row into a Google Sheet.",
            parameters: {
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
                        type: "number",
                        description: "The 0-based row index where the new row should be inserted. The new row will be inserted before this index.",
                    },
                    values: {
                        type: "array",
                        description: "The values to set in the new row.",
                        items: {
                            type: "string",
                        },
                    },
                },
                required: ["spreadsheetId", "rowIndex", "values"],
            },
        },
    },
    {
        name: "insert_column",
        description: "Insert a new column into a Google Sheet.",
        function: {
            name: "insert_column",
            description: "Insert a new column into a Google Sheet.",
            parameters: {
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
                        type: "number",
                        description: "The 0-based column index where the new column should be inserted. The new column will be inserted before this index.",
                    },
                    values: {
                        type: "array",
                        description: "The values to set in the new column.",
                        items: {
                            type: "string",
                        },
                    },
                },
                required: ["spreadsheetId", "columnIndex", "values"],
            },
        },
    },
    {
        name: "rename_sheet",
        description: "Rename a sheet in a Google Spreadsheet.",
        function: {
            name: "rename_sheet",
            description: "Rename a sheet in a Google Spreadsheet.",
            parameters: {
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
    },
    {
        name: "rename_doc",
        description: "Rename a Google Spreadsheet.",
        function: {
            name: "rename_doc",
            description: "Rename a Google Spreadsheet.",
            parameters: {
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
    },
    {
        name: "geocode",
        description: "Convert addresses to geographic coordinates.",
        function: {
            name: "geocode",
            description: "Convert addresses to geographic coordinates.",
            parameters: {
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
    },
    {
        name: "places_nearby",
        description: "Find places of interest near a location.",
        function: {
            name: "places_nearby",
            description: "Find places of interest near a location.",
            parameters: {
                type: "object",
                properties: {
                    location: {
                        type: "string",
                        description: "Location as 'lat,lng' coordinates or an address string.",
                    },
                    radius: {
                        type: "number",
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
    },
    {
        name: "distance_matrix",
        description: "Calculate travel distance and time between locations.",
        function: {
            name: "distance_matrix",
            description: "Calculate travel distance and time between locations.",
            parameters: {
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
    },
    {
        name: "directions",
        description: "Get detailed directions between locations.",
        function: {
            name: "directions",
            description: "Get detailed directions between locations.",
            parameters: {
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
    },
    {
        name: "timezone",
        description: "Get timezone information for a location.",
        function: {
            name: "timezone",
            description: "Get timezone information for a location.",
            parameters: {
                type: "object",
                properties: {
                    location: {
                        type: "string",
                        description: "Location as 'lat,lng' coordinates or an address string.",
                    },
                    timestamp: {
                        type: "number",
                        description: "Optional timestamp to check timezone information for a specific time (Unix seconds).",
                    },
                },
                required: ["location"],
            },
        },
    },
    {
        name: "convert_currency",
        description: "Convert an amount from one currency to another.",
        function: {
            name: "convert_currency",
            description: "Convert an amount from one currency to another.",
            parameters: {
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
    },
];
class TravelPlannerSDK {
    constructor() {
        this.prompts = [];
        // Initialize the MCP server
        this.server = new Server({
            name: "travel-planner",
            version: "1.0.0",
        }, {
            capabilities: {
                tools: {},
            },
        });
        // Setup request handlers
        this.setupHandlers();
    }
    async setupHandlers() {
        logger.info("Setting up request handlers...");
        // Handle tools/list request
        this.server.setRequestHandler("tools/list", async () => {
            logger.info("Handling tools/list request");
            return {
                tools: toolSpecifications,
            };
        });
        // Handle tools/call request
        this.server.setRequestHandler("tools/call", async (request) => {
            const { name, arguments: args = {} } = request.params;
            logger.info(`Handling tools/call request for tool: ${name}`);
            try {
                if (!toolHandlers[name]) {
                    throw new Error(`Tool '${name}' not found`);
                }
                // Call the tool handler
                const result = await toolHandlers[name](args);
                logger.info(`Tool ${name} executed successfully`);
                // Return the result
                return {
                    result: JSON.stringify(result),
                };
            }
            catch (error) {
                logger.error(`Error executing tool ${name}: ${error.message}`);
                throw {
                    code: "execution_error",
                    message: error.message || "Unknown error during tool execution",
                };
            }
        });
        // Handle prompts/list request
        this.server.setRequestHandler("prompts/list", async () => {
            return {
                prompts: this.prompts,
            };
        });
        // Handle resources/list request (we don't have resources in this implementation)
        this.server.setRequestHandler("resources/list", async () => {
            return {
                resources: [],
            };
        });
    }
    async start() {
        try {
            logger.info("Initializing Travel Planner server...");
            // Initialize Google authentication
            logger.info("Initializing Google authentication...");
            this.authClient = await initializeAuth();
            google.options({ auth: this.authClient });
            logger.info("Google authentication initialized successfully");
            // Load prompts if available
            try {
                this.prompts = loadPrompts();
                logger.info(`Loaded ${this.prompts.length} prompts`);
            }
            catch (error) {
                logger.warn("Failed to load prompts, continuing without them");
            }
            // Start the server (using STDIN/STDOUT transport by default)
            await this.server.start();
            logger.info("Travel Planner MCP server started successfully");
        }
        catch (error) {
            logger.error(`Failed to start server: ${error.message}`);
            process.exit(1);
        }
    }
}
// Start the server
async function startServer() {
    try {
        const server = new TravelPlannerSDK();
        await server.start();
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
