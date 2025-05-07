import { ListToolsRequestSchema, CallToolRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { getDistance, getRoute, searchPlaces, getTimezone, handleMapsError, } from "./maps-api.js";
/**
 * Register Google Maps tools with an MCP server
 */
export function registerGoogleMapsTools(server) {
    // Create list tools handler with Google Maps tools
    const listToolsHandler = async (request, extra) => {
        // Define Google Maps tools
        const googleMapsTools = [
            {
                name: "maps_distance",
                description: "Calculate straight-line & driving distance between 2 coordinates or addresses",
                inputSchema: {
                    type: "object",
                    properties: {
                        origin: {
                            oneOf: [
                                {
                                    type: "string",
                                    description: "Address or place name of origin",
                                },
                                {
                                    type: "object",
                                    properties: {
                                        lat: { type: "number", description: "Latitude coordinate" },
                                        lng: {
                                            type: "number",
                                            description: "Longitude coordinate",
                                        },
                                    },
                                    required: ["lat", "lng"],
                                    description: "Latitude/longitude coordinates of origin",
                                },
                            ],
                            description: "Starting point (address or coordinates)",
                        },
                        destination: {
                            oneOf: [
                                {
                                    type: "string",
                                    description: "Address or place name of destination",
                                },
                                {
                                    type: "object",
                                    properties: {
                                        lat: { type: "number", description: "Latitude coordinate" },
                                        lng: {
                                            type: "number",
                                            description: "Longitude coordinate",
                                        },
                                    },
                                    required: ["lat", "lng"],
                                    description: "Latitude/longitude coordinates of destination",
                                },
                            ],
                            description: "Ending point (address or coordinates)",
                        },
                        mode: {
                            type: "string",
                            enum: ["driving", "walking", "bicycling", "transit"],
                            description: "Transportation mode",
                            default: "driving",
                        },
                    },
                    required: ["origin", "destination"],
                },
            },
            {
                name: "maps_route",
                description: "Calculate optimized driving/transit route between multiple waypoints with polyline",
                inputSchema: {
                    type: "object",
                    properties: {
                        waypoints: {
                            type: "array",
                            items: {
                                oneOf: [
                                    { type: "string", description: "Address or place name" },
                                    {
                                        type: "object",
                                        properties: {
                                            lat: {
                                                type: "number",
                                                description: "Latitude coordinate",
                                            },
                                            lng: {
                                                type: "number",
                                                description: "Longitude coordinate",
                                            },
                                        },
                                        required: ["lat", "lng"],
                                        description: "Latitude/longitude coordinates",
                                    },
                                ],
                            },
                            description: "List of waypoints (origin, intermediate points, destination)",
                            minItems: 2,
                        },
                        mode: {
                            type: "string",
                            enum: ["driving", "walking", "bicycling", "transit"],
                            description: "Transportation mode",
                            default: "driving",
                        },
                    },
                    required: ["waypoints"],
                },
            },
            {
                name: "maps_place_search",
                description: "Find places of interest near coordinates or by text query",
                inputSchema: {
                    type: "object",
                    oneOf: [
                        {
                            properties: {
                                query: {
                                    type: "string",
                                    description: "Text search query (e.g. 'restaurants in Paris')",
                                },
                            },
                            required: ["query"],
                        },
                        {
                            properties: {
                                location: {
                                    type: "object",
                                    properties: {
                                        lat: { type: "number", description: "Latitude coordinate" },
                                        lng: {
                                            type: "number",
                                            description: "Longitude coordinate",
                                        },
                                    },
                                    required: ["lat", "lng"],
                                    description: "Latitude/longitude coordinates to search around",
                                },
                                radius: {
                                    type: "number",
                                    description: "Search radius in meters (max 50000)",
                                    maximum: 50000,
                                },
                                type: {
                                    type: "string",
                                    description: "Place type (e.g. 'restaurant', 'museum', 'hotel')",
                                },
                            },
                            required: ["location", "radius"],
                        },
                    ],
                },
            },
            {
                name: "maps_timezone",
                description: "Get timezone information for a specific location",
                inputSchema: {
                    type: "object",
                    properties: {
                        location: {
                            type: "object",
                            properties: {
                                lat: { type: "number", description: "Latitude coordinate" },
                                lng: { type: "number", description: "Longitude coordinate" },
                            },
                            required: ["lat", "lng"],
                            description: "Latitude/longitude coordinates to look up timezone for",
                        },
                        timestamp: {
                            type: "number",
                            description: "Timestamp (seconds since epoch) to check timezone for. Defaults to current time.",
                        },
                    },
                    required: ["location"],
                },
            },
        ];
        return {
            tools: googleMapsTools,
        };
    };
    // Create call tool handler for Google Maps tools
    const callToolHandler = async (request, extra) => {
        const { name, arguments: args } = request.params;
        // Handle Google Maps tools only
        if (name.startsWith("maps_")) {
            try {
                switch (name) {
                    case "maps_distance": {
                        const { origin, destination, mode = "driving" } = args;
                        const result = await getDistance(origin, destination, mode);
                        return {
                            result: {
                                ...result,
                                message: `The distance is ${result.distanceText} and would take ${result.durationText} by ${mode}.`,
                            },
                        };
                    }
                    case "maps_route": {
                        const { waypoints, mode = "driving" } = args;
                        const result = await getRoute(waypoints, mode);
                        return {
                            result: {
                                ...result,
                                message: `Route calculated with ${result.legs.length} leg(s), total distance of ${result.totalDistanceKm.toFixed(1)} km, and total travel time of ${Math.round(result.totalDurationMinutes)} minutes.`,
                            },
                        };
                    }
                    case "maps_place_search": {
                        let result;
                        if ("query" in args) {
                            result = await searchPlaces({ query: args.query });
                        }
                        else {
                            const { location, radius, type } = args;
                            result = await searchPlaces({ location, radius, type });
                        }
                        return {
                            result: {
                                places: result,
                                count: result.length,
                                message: `Found ${result.length} places.`,
                            },
                        };
                    }
                    case "maps_timezone": {
                        const { location, timestamp } = args;
                        const result = await getTimezone(location, timestamp);
                        return {
                            result: {
                                ...result,
                                message: `The timezone at coordinates (${location.lat}, ${location.lng}) is ${result.timeZoneId} (${result.timeZoneName}).`,
                            },
                        };
                    }
                    default:
                        return {
                            error: {
                                message: `Unknown Google Maps tool: ${name}`,
                                code: "TOOL_NOT_FOUND",
                            },
                        };
                }
            }
            catch (error) {
                await handleMapsError(error);
                return {
                    error: {
                        message: error.message || "An error occurred with the Google Maps tool",
                        code: "MAPS_ERROR",
                    },
                };
            }
        }
        // For non-Google Maps tools, return a fallback error
        // This shouldn't normally be hit because the MCP server will
        // chain handlers and only come here if this tool matches
        return {
            error: {
                message: `Tool not handled by Google Maps integration: ${name}`,
                code: "TOOL_NOT_FOUND",
            },
        };
    };
    // Register the handlers
    server.setRequestHandler(ListToolsRequestSchema, listToolsHandler);
    server.setRequestHandler(CallToolRequestSchema, callToolHandler);
    console.log("Google Maps tools registered successfully.");
}
/**
 * Helper to get Google Maps tools definitions for tools lists
 */
export function getGoogleMapsTools() {
    return [
        {
            name: "maps_distance",
            description: "Calculate straight-line & driving distance between 2 coordinates or addresses",
        },
        {
            name: "maps_route",
            description: "Calculate optimized driving/transit route between multiple waypoints with polyline",
        },
        {
            name: "maps_place_search",
            description: "Find places of interest near coordinates or by text query",
        },
        {
            name: "maps_timezone",
            description: "Get timezone information for a specific location",
        },
    ];
}
