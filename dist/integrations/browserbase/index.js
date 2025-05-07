import axios from "axios";
import { ListToolsRequestSchema, CallToolRequestSchema, ReadResourceRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// Store for resources and original handlers
const resources = new Map();
let originalListToolsHandler = null;
let originalCallToolHandler = null;
let originalReadResourceHandler = null;
// Browserbase API configuration
const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY || "";
const BROWSERBASE_API_URL = "https://api.browserbase.com/v1";
// Helper function to make authenticated requests to Browserbase
async function browserbaseRequest(endpoint, method, data) {
    try {
        const response = await axios({
            method,
            url: `${BROWSERBASE_API_URL}/${endpoint}`,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${BROWSERBASE_API_KEY}`,
            },
            data,
        });
        return response.data;
    }
    catch (error) {
        console.error(`Browserbase API error: ${error.message}`);
        throw error;
    }
}
// Browserbase session state
let currentSession = null;
/**
 * Register Browserbase tools with an MCP server
 */
export function registerBrowserbaseTools(server) {
    // Create list tools handler with Browserbase tools
    const listToolsHandler = async (request, extra) => {
        // Define Browserbase tools
        const browserbaseTools = [
            {
                name: "browserbase_create_session",
                description: "Create a new cloud browser session using Browserbase",
                inputSchema: {
                    type: "object",
                    properties: {
                        random_string: {
                            type: "string",
                            description: "Dummy parameter for no-parameter tools",
                        },
                    },
                    required: ["random_string"],
                },
            },
            {
                name: "browserbase_close_session",
                description: "Close a browser session on Browserbase",
                inputSchema: {
                    type: "object",
                    properties: {
                        sessionId: { type: "string" },
                    },
                    required: ["sessionId"],
                },
            },
            {
                name: "browserbase_navigate",
                description: "Navigate to a URL",
                inputSchema: {
                    type: "object",
                    properties: {
                        url: { type: "string" },
                    },
                    required: ["url"],
                },
            },
            {
                name: "browserbase_screenshot",
                description: "Take a screenshot of the current page or a specific element",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Name for the screenshot" },
                        selector: {
                            type: "string",
                            description: "CSS selector for element to screenshot",
                        },
                        width: {
                            type: "number",
                            description: "Width in pixels (default: 800)",
                        },
                        height: {
                            type: "number",
                            description: "Height in pixels (default: 600)",
                        },
                    },
                    required: ["name"],
                },
            },
            {
                name: "browserbase_click",
                description: "Click an element on the page",
                inputSchema: {
                    type: "object",
                    properties: {
                        selector: {
                            type: "string",
                            description: "CSS selector for element to click",
                        },
                    },
                    required: ["selector"],
                },
            },
            {
                name: "browserbase_fill",
                description: "Fill out an input field",
                inputSchema: {
                    type: "object",
                    properties: {
                        selector: {
                            type: "string",
                            description: "CSS selector for input field",
                        },
                        value: { type: "string", description: "Value to fill" },
                    },
                    required: ["selector", "value"],
                },
            },
            {
                name: "browserbase_evaluate",
                description: "Execute JavaScript in the browser console",
                inputSchema: {
                    type: "object",
                    properties: {
                        script: {
                            type: "string",
                            description: "JavaScript code to execute",
                        },
                    },
                    required: ["script"],
                },
            },
            {
                name: "browserbase_get_content",
                description: "Extract all content from the current page",
                inputSchema: {
                    type: "object",
                    properties: {
                        selector: {
                            type: "string",
                            description: "Optional CSS selector to get content from specific elements (default: returns whole page)",
                        },
                    },
                    required: [],
                },
            },
        ];
        return {
            tools: browserbaseTools,
        };
    };
    // Override the ListTools handler
    server.setRequestHandler(ListToolsRequestSchema, listToolsHandler);
    // Store and override CallTool handler
    const callToolHandler = async (request, extra) => {
        const { name, arguments: args } = request.params;
        // Handle Browserbase tools
        if (name.startsWith("browserbase_")) {
            try {
                switch (name) {
                    case "browserbase_create_session": {
                        try {
                            if (!BROWSERBASE_API_KEY) {
                                return {
                                    content: [
                                        {
                                            type: "text",
                                            text: "BROWSERBASE_API_KEY environment variable is not set.",
                                        },
                                    ],
                                    isError: true,
                                };
                            }
                            const session = await browserbaseRequest("sessions", "POST", {
                                browser: "chrome",
                                options: {
                                    width: 1280,
                                    height: 800,
                                },
                            });
                            currentSession = session.id;
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: JSON.stringify({
                                            message: "Browser session created successfully",
                                            sessionId: session.id,
                                        }, null, 2),
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
                                        text: `Failed to create browser session: ${error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                    }
                    case "browserbase_close_session": {
                        try {
                            const { sessionId } = args;
                            await browserbaseRequest(`sessions/${sessionId}`, "DELETE");
                            if (currentSession === sessionId) {
                                currentSession = null;
                            }
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: "Browser session closed successfully",
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
                                        text: `Failed to close browser session: ${error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                    }
                    case "browserbase_navigate": {
                        try {
                            if (!currentSession) {
                                return {
                                    content: [
                                        {
                                            type: "text",
                                            text: "No active browser session. Create one first with browserbase_create_session",
                                        },
                                    ],
                                    isError: true,
                                };
                            }
                            const { url } = args;
                            await browserbaseRequest(`sessions/${currentSession}/navigate`, "POST", { url });
                            return {
                                content: [{ type: "text", text: `Navigated to ${url}` }],
                                isError: false,
                            };
                        }
                        catch (error) {
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `Failed to navigate: ${error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                    }
                    case "browserbase_screenshot": {
                        try {
                            if (!currentSession) {
                                return {
                                    content: [
                                        {
                                            type: "text",
                                            text: "No active browser session. Create one first with browserbase_create_session",
                                        },
                                    ],
                                    isError: true,
                                };
                            }
                            const { name, selector, width = 800, height = 600 } = args;
                            const options = { width, height };
                            if (selector) {
                                options.selector = selector;
                            }
                            const screenshot = await browserbaseRequest(`sessions/${currentSession}/screenshot`, "POST", options);
                            // Store the screenshot as a resource
                            const resourceUri = `screenshot://${name}`;
                            resources.set(resourceUri, {
                                uri: resourceUri,
                                mimeType: "image/png",
                                data: Buffer.from(screenshot.data, "base64"),
                            });
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `Screenshot taken successfully. Access it via screenshot://${name}`,
                                    },
                                    {
                                        type: "image",
                                        mimeType: "image/png",
                                        url: `screenshot://${name}`,
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
                                        text: `Failed to take screenshot: ${error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                    }
                    case "browserbase_click": {
                        try {
                            if (!currentSession) {
                                return {
                                    content: [
                                        {
                                            type: "text",
                                            text: "No active browser session. Create one first with browserbase_create_session",
                                        },
                                    ],
                                    isError: true,
                                };
                            }
                            const { selector } = args;
                            await browserbaseRequest(`sessions/${currentSession}/click`, "POST", { selector });
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `Clicked element with selector: ${selector}`,
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
                                        text: `Failed to click element: ${error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                    }
                    case "browserbase_fill": {
                        try {
                            if (!currentSession) {
                                return {
                                    content: [
                                        {
                                            type: "text",
                                            text: "No active browser session. Create one first with browserbase_create_session",
                                        },
                                    ],
                                    isError: true,
                                };
                            }
                            const { selector, value } = args;
                            await browserbaseRequest(`sessions/${currentSession}/fill`, "POST", { selector, value });
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `Filled input field with selector: ${selector}`,
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
                                        text: `Failed to fill input field: ${error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                    }
                    case "browserbase_evaluate": {
                        try {
                            if (!currentSession) {
                                return {
                                    content: [
                                        {
                                            type: "text",
                                            text: "No active browser session. Create one first with browserbase_create_session",
                                        },
                                    ],
                                    isError: true,
                                };
                            }
                            const { script } = args;
                            const result = await browserbaseRequest(`sessions/${currentSession}/evaluate`, "POST", { script });
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `JavaScript executed successfully. Result: ${JSON.stringify(result.result, null, 2)}`,
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
                                        text: `Failed to execute JavaScript: ${error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                    }
                    case "browserbase_get_content": {
                        try {
                            if (!currentSession) {
                                return {
                                    content: [
                                        {
                                            type: "text",
                                            text: "No active browser session. Create one first with browserbase_create_session",
                                        },
                                    ],
                                    isError: true,
                                };
                            }
                            const { selector } = args;
                            const requestData = {};
                            if (selector) {
                                requestData.selector = selector;
                            }
                            const content = await browserbaseRequest(`sessions/${currentSession}/content`, "POST", requestData);
                            return {
                                content: [
                                    { type: "text", text: content.html || "No content found" },
                                ],
                                isError: false,
                            };
                        }
                        catch (error) {
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `Failed to get page content: ${error.message}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                    }
                    default:
                        // Pass to original handler for non-Browserbase tools or unknown tools
                        return originalCallToolHandler(request, extra);
                }
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error in Browserbase tool: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
        // Pass non-Browserbase tools to the original handler
        return originalCallToolHandler(request, extra);
    };
    // Store the original CallTool handler
    server.setRequestHandler(CallToolRequestSchema, callToolHandler);
    originalCallToolHandler = callToolHandler;
    // Handle ReadResource for screenshots
    const readResourceHandler = async (request, extra) => {
        const uri = request.params.uri;
        if (uri.startsWith("screenshot://")) {
            // Handle screenshot resources
            try {
                const resourceName = uri.replace("screenshot://", "");
                const resource = resources.get(uri);
                if (!resource) {
                    return {
                        contents: [
                            {
                                uri,
                                mimeType: "text/plain",
                                text: `Screenshot ${resourceName} not found`,
                            },
                        ],
                    };
                }
                return {
                    contents: [
                        {
                            uri,
                            mimeType: "image/png",
                            data: resource.data,
                        },
                    ],
                };
            }
            catch (error) {
                return {
                    contents: [
                        {
                            uri,
                            mimeType: "text/plain",
                            text: `Error retrieving screenshot: ${error.message}`,
                        },
                    ],
                };
            }
        }
        // Pass non-screenshot resources to the original handler
        return originalReadResourceHandler(request, extra);
    };
    // Store the original ReadResource handler
    server.setRequestHandler(ReadResourceRequestSchema, readResourceHandler);
    originalReadResourceHandler = readResourceHandler;
}
/**
 * Get list of Browserbase tools without registering them
 */
export function getBrowserbaseTools() {
    return [
        {
            name: "browserbase_create_session",
            description: "Create a new cloud browser session using Browserbase",
            inputSchema: {
                type: "object",
                properties: {
                    random_string: {
                        type: "string",
                        description: "Dummy parameter for no-parameter tools",
                    },
                },
                required: ["random_string"],
            },
        },
        {
            name: "browserbase_close_session",
            description: "Close a browser session on Browserbase",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: { type: "string" },
                },
                required: ["sessionId"],
            },
        },
        {
            name: "browserbase_navigate",
            description: "Navigate to a URL",
            inputSchema: {
                type: "object",
                properties: {
                    url: { type: "string" },
                },
                required: ["url"],
            },
        },
        {
            name: "browserbase_screenshot",
            description: "Take a screenshot of the current page or a specific element",
            inputSchema: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Name for the screenshot" },
                    selector: {
                        type: "string",
                        description: "CSS selector for element to screenshot",
                    },
                    width: {
                        type: "number",
                        description: "Width in pixels (default: 800)",
                    },
                    height: {
                        type: "number",
                        description: "Height in pixels (default: 600)",
                    },
                },
                required: ["name"],
            },
        },
        {
            name: "browserbase_click",
            description: "Click an element on the page",
            inputSchema: {
                type: "object",
                properties: {
                    selector: {
                        type: "string",
                        description: "CSS selector for element to click",
                    },
                },
                required: ["selector"],
            },
        },
        {
            name: "browserbase_fill",
            description: "Fill out an input field",
            inputSchema: {
                type: "object",
                properties: {
                    selector: {
                        type: "string",
                        description: "CSS selector for input field",
                    },
                    value: { type: "string", description: "Value to fill" },
                },
                required: ["selector", "value"],
            },
        },
        {
            name: "browserbase_evaluate",
            description: "Execute JavaScript in the browser console",
            inputSchema: {
                type: "object",
                properties: {
                    script: {
                        type: "string",
                        description: "JavaScript code to execute",
                    },
                },
                required: ["script"],
            },
        },
        {
            name: "browserbase_get_content",
            description: "Extract all content from the current page",
            inputSchema: {
                type: "object",
                properties: {
                    selector: {
                        type: "string",
                        description: "Optional CSS selector to get content from specific elements (default: returns whole page)",
                    },
                },
                required: [],
            },
        },
    ];
}
