import { Client, UnitSystem, } from "@googlemaps/google-maps-services-js";
// Google Maps client instance
let mapsClient = null;
/**
 * Initialize the Google Maps client with the API key
 */
export function initMapsClient(apiKey) {
    if (!mapsClient) {
        const key = apiKey || process.env.GOOGLE_MAPS_API_KEY;
        if (!key) {
            throw new Error("Google Maps API key is required. Set the GOOGLE_MAPS_API_KEY environment variable.");
        }
        mapsClient = new Client({});
    }
    return mapsClient;
}
/**
 * Calculate distance and duration between two points
 */
export async function getDistance(origin, destination, mode = "driving") {
    try {
        const client = initMapsClient();
        const response = await client.distancematrix({
            params: {
                origins: [
                    typeof origin === "string" ? origin : `${origin.lat},${origin.lng}`,
                ],
                destinations: [
                    typeof destination === "string"
                        ? destination
                        : `${destination.lat},${destination.lng}`,
                ],
                mode: mode,
                units: UnitSystem.metric,
                key: process.env.GOOGLE_MAPS_API_KEY,
            },
        });
        const data = response.data;
        if (!data.rows?.[0]?.elements?.[0] ||
            data.rows[0].elements[0].status !== "OK") {
            throw new Error(`Distance calculation failed: ${JSON.stringify(data)}`);
        }
        const element = data.rows[0].elements[0];
        return {
            distanceKm: element.distance.value / 1000,
            distanceText: element.distance.text,
            durationMinutes: element.duration.value / 60,
            durationText: element.duration.text,
        };
    }
    catch (error) {
        console.error("Error calculating distance:", error.message);
        throw new Error(`Failed to calculate distance: ${error.message}`);
    }
}
/**
 * Get detailed route information between waypoints
 */
export async function getRoute(waypoints, mode = "driving") {
    try {
        if (waypoints.length < 2) {
            throw new Error("At least 2 waypoints are required for routing");
        }
        const client = initMapsClient();
        // Format waypoints
        const formattedWaypoints = waypoints.map((wp) => typeof wp === "string" ? wp : `${wp.lat},${wp.lng}`);
        const origin = formattedWaypoints[0];
        const destination = formattedWaypoints[formattedWaypoints.length - 1];
        const intermediateWaypoints = formattedWaypoints.slice(1, formattedWaypoints.length - 1);
        const response = await client.directions({
            params: {
                origin,
                destination,
                waypoints: intermediateWaypoints.length > 0 ? intermediateWaypoints : undefined,
                mode: mode,
                optimize: true,
                units: UnitSystem.metric,
                key: process.env.GOOGLE_MAPS_API_KEY,
            },
        });
        const data = response.data;
        if (!data.routes?.[0]) {
            throw new Error(`Route calculation failed: ${JSON.stringify(data)}`);
        }
        const route = data.routes[0];
        // Extract leg information
        const legs = route.legs.map((leg) => ({
            startAddress: leg.start_address,
            endAddress: leg.end_address,
            distance: { text: leg.distance.text, value: leg.distance.value },
            duration: { text: leg.duration.text, value: leg.duration.value },
        }));
        // Calculate totals
        const totalDistanceKm = legs.reduce((acc, leg) => acc + leg.distance.value, 0) /
            1000;
        const totalDurationMinutes = legs.reduce((acc, leg) => acc + leg.duration.value, 0) / 60;
        // Extract route waypoints
        const routeWaypoints = [];
        route.legs.forEach((leg) => {
            if (leg.steps) {
                leg.steps.forEach((step) => {
                    if (step.start_location) {
                        routeWaypoints.push({
                            lat: step.start_location.lat,
                            lng: step.start_location.lng,
                        });
                    }
                    if (step.end_location) {
                        routeWaypoints.push({
                            lat: step.end_location.lat,
                            lng: step.end_location.lng,
                        });
                    }
                });
            }
        });
        return {
            polyline: route.overview_polyline.points,
            waypoints: routeWaypoints,
            legs,
            totalDistanceKm,
            totalDurationMinutes,
        };
    }
    catch (error) {
        console.error("Error calculating route:", error.message);
        throw new Error(`Failed to calculate route: ${error.message}`);
    }
}
/**
 * Search for places by text query or location
 */
export async function searchPlaces(params) {
    try {
        const client = initMapsClient();
        let response;
        if ("query" in params) {
            // Text search
            response = await client.textSearch({
                params: {
                    query: params.query,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            });
        }
        else {
            // Nearby search
            response = await client.placesNearby({
                params: {
                    location: params.location,
                    radius: params.radius,
                    type: params.type,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
            });
        }
        const data = response.data;
        if (!data.results) {
            throw new Error(`Place search failed: ${JSON.stringify(data)}`);
        }
        // Format results
        return data.results.map((place) => ({
            placeId: place.place_id,
            name: place.name,
            formattedAddress: place.formatted_address || "",
            location: {
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
            },
            types: place.types || [],
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            photos: place.photos?.map((photo) => ({
                photoReference: photo.photo_reference,
            })),
            openingHours: place.opening_hours
                ? {
                    openNow: place.opening_hours.open_now,
                }
                : undefined,
            priceLevel: place.price_level,
        }));
    }
    catch (error) {
        console.error("Error searching places:", error.message);
        throw new Error(`Failed to search places: ${error.message}`);
    }
}
/**
 * Get timezone information for coordinates
 */
export async function getTimezone(location, timestamp = Math.floor(Date.now() / 1000)) {
    try {
        const client = initMapsClient();
        const response = await client.timezone({
            params: {
                location: `${location.lat},${location.lng}`,
                timestamp,
                key: process.env.GOOGLE_MAPS_API_KEY,
            },
        });
        const data = response.data;
        if (data.status !== "OK") {
            throw new Error(`Timezone lookup failed: ${data.status}`);
        }
        return {
            timeZoneId: data.timeZoneId,
            timeZoneName: data.timeZoneName,
            dstOffset: data.dstOffset,
            rawOffset: data.rawOffset,
        };
    }
    catch (error) {
        console.error("Error getting timezone:", error.message);
        throw new Error(`Failed to get timezone: ${error.message}`);
    }
}
/**
 * Helper function to handle Google Maps API errors
 */
export async function handleMapsError(error) {
    if (error.message?.includes("API key") ||
        error.message?.includes("apiKey") ||
        error.response?.data?.error_message?.includes("API key")) {
        console.error("Google Maps API key error:", error.message);
        return false;
    }
    // Add specific error handling based on Google Maps API error patterns
    return false;
}
