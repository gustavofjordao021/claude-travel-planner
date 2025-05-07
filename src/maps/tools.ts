import axios from "axios";
import { logger } from "../utils/logger.js";
import { validateArgs } from "../sheets/helpers.js";
import {
	GeocodeArgs,
	PlacesNearbyArgs,
	DistanceMatrixArgs,
	DirectionsArgs,
	TimezoneArgs,
	ConvertCurrencyArgs,
} from "../types/maps-types.js";

// Google Maps API key from env
const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

// Constants
export const TravelMode = {
	DRIVING: "driving",
	WALKING: "walking",
	BICYCLING: "bicycling",
	TRANSIT: "transit",
};

// Endpoint URLs
const PLACES_API_URL =
	"https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const GEOCODE_API_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const DISTANCE_MATRIX_API_URL =
	"https://maps.googleapis.com/maps/api/distancematrix/json";
const DIRECTIONS_API_URL =
	"https://maps.googleapis.com/maps/api/directions/json";
const TIMEZONE_API_URL = "https://maps.googleapis.com/maps/api/timezone/json";

/**
 * Helper function to ensure MAPS_API_KEY is available
 */
function checkApiKey() {
	if (!MAPS_API_KEY) {
		throw new Error(
			"Google Maps API key not found. Please set GOOGLE_MAPS_API_KEY environment variable."
		);
	}
}

/**
 * Geocode an address to get coordinates
 */
export async function geocode(args: Record<string, unknown>) {
	try {
		checkApiKey();
		const validArgs = validateArgs<GeocodeArgs>(args, ["address"]);
		const { address } = validArgs;

		const response = await axios.get(GEOCODE_API_URL, {
			params: {
				address,
				key: MAPS_API_KEY,
			},
		});

		if (response.data.status !== "OK") {
			throw new Error(`Geocoding failed: ${response.data.status}`);
		}

		if (!response.data.results || response.data.results.length === 0) {
			throw new Error("No results found for this address");
		}

		const result = response.data.results[0];

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(
						{
							formatted_address: result.formatted_address,
							location: result.geometry.location,
							place_id: result.place_id,
						},
						null,
						2
					),
				},
			],
			isError: false,
		};
	} catch (error: any) {
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

/**
 * Search for places near a location
 */
export async function placesNearby(args: Record<string, unknown>) {
	try {
		checkApiKey();
		const validArgs = validateArgs<PlacesNearbyArgs>(args, [
			"location",
			"radius",
			"type",
		]);
		const { location, radius, type, keyword } = validArgs;

		let coords;
		if (typeof location === "string" && !location.includes(",")) {
			// If location is a string without comma, assume it's an address and geocode it
			const geocodeResponse = await axios.get(GEOCODE_API_URL, {
				params: {
					address: location,
					key: MAPS_API_KEY,
				},
			});

			if (
				geocodeResponse.data.status !== "OK" ||
				!geocodeResponse.data.results.length
			) {
				throw new Error(`Could not geocode location: ${location}`);
			}

			const geocodeResult = geocodeResponse.data.results[0];
			coords = `${geocodeResult.geometry.location.lat},${geocodeResult.geometry.location.lng}`;
		} else {
			coords = location;
		}

		const params: Record<string, string | number> = {
			location: coords,
			radius,
			type,
			key: MAPS_API_KEY,
		};

		if (keyword) {
			params.keyword = keyword;
		}

		const response = await axios.get(PLACES_API_URL, { params });

		if (
			response.data.status !== "OK" &&
			response.data.status !== "ZERO_RESULTS"
		) {
			throw new Error(`Places API error: ${response.data.status}`);
		}

		const places = response.data.results.map((place: any) => ({
			name: place.name,
			address: place.vicinity,
			location: place.geometry?.location,
			place_id: place.place_id,
			rating: place.rating,
			user_ratings_total: place.user_ratings_total,
			types: place.types,
		}));

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(places, null, 2),
				},
			],
			isError: false,
		};
	} catch (error: any) {
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

/**
 * Get distance and duration between origins and destinations
 */
export async function distanceMatrix(args: Record<string, unknown>) {
	try {
		checkApiKey();
		const validArgs = validateArgs<DistanceMatrixArgs>(args, [
			"origins",
			"destinations",
		]);
		const { origins, destinations, mode = TravelMode.DRIVING } = validArgs;

		const response = await axios.get(DISTANCE_MATRIX_API_URL, {
			params: {
				origins: origins.join("|"),
				destinations: destinations.join("|"),
				mode,
				key: MAPS_API_KEY,
			},
		});

		if (response.data.status !== "OK") {
			throw new Error(`Distance Matrix API error: ${response.data.status}`);
		}

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(
						{
							origin_addresses: response.data.origin_addresses,
							destination_addresses: response.data.destination_addresses,
							rows: response.data.rows,
						},
						null,
						2
					),
				},
			],
			isError: false,
		};
	} catch (error: any) {
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

/**
 * Get directions between two locations
 */
export async function directions(args: Record<string, unknown>) {
	try {
		checkApiKey();
		const validArgs = validateArgs<DirectionsArgs>(args, [
			"origin",
			"destination",
		]);
		const {
			origin,
			destination,
			waypoints = [],
			mode = TravelMode.DRIVING,
		} = validArgs;

		const params: Record<string, string | string[]> = {
			origin,
			destination,
			mode,
			key: MAPS_API_KEY,
		};

		if (waypoints.length > 0) {
			params.waypoints = waypoints.join("|");
		}

		const response = await axios.get(DIRECTIONS_API_URL, { params });

		if (response.data.status !== "OK") {
			throw new Error(`Directions API error: ${response.data.status}`);
		}

		const routes = response.data.routes.map((route: any) => {
			const legs = route.legs.map((leg: any) => ({
				distance: leg.distance,
				duration: leg.duration,
				start_address: leg.start_address,
				end_address: leg.end_address,
				steps: leg.steps.map((step: any) => ({
					distance: step.distance,
					duration: step.duration,
					instructions: step.html_instructions,
					travel_mode: step.travel_mode,
				})),
			}));

			return {
				summary: route.summary,
				legs,
				distance: route.legs.reduce(
					(total: number, leg: any) => total + leg.distance.value,
					0
				),
				duration: route.legs.reduce(
					(total: number, leg: any) => total + leg.duration.value,
					0
				),
			};
		});

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(routes, null, 2),
				},
			],
			isError: false,
		};
	} catch (error: any) {
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

/**
 * Get timezone for a location
 */
export async function timezone(args: Record<string, unknown>) {
	try {
		checkApiKey();
		const validArgs = validateArgs<TimezoneArgs>(args, ["location"]);
		const { location, timestamp = Math.floor(Date.now() / 1000) } = validArgs;

		// Check if location is coordinates or an address
		let coords;
		if (
			typeof location === "string" &&
			!location.match(/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/)
		) {
			// It's an address, geocode it first
			const geocodeResponse = await axios.get(GEOCODE_API_URL, {
				params: {
					address: location,
					key: MAPS_API_KEY,
				},
			});

			if (
				geocodeResponse.data.status !== "OK" ||
				!geocodeResponse.data.results.length
			) {
				throw new Error(`Could not geocode location: ${location}`);
			}

			const geocodeResult = geocodeResponse.data.results[0];
			coords = `${geocodeResult.geometry.location.lat},${geocodeResult.geometry.location.lng}`;
		} else {
			coords = location;
		}

		const response = await axios.get(TIMEZONE_API_URL, {
			params: {
				location: coords,
				timestamp,
				key: MAPS_API_KEY,
			},
		});

		if (response.data.status !== "OK") {
			throw new Error(`Timezone API error: ${response.data.status}`);
		}

		// Format the response
		const result = {
			timezone_id: response.data.timeZoneId,
			timezone_name: response.data.timeZoneName,
			dst_offset: response.data.dstOffset,
			raw_offset: response.data.rawOffset,
			// Add the formatted time
			local_time: new Date(
				(timestamp + response.data.dstOffset + response.data.rawOffset) * 1000
			).toISOString(),
		};

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
			isError: false,
		};
	} catch (error: any) {
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

/**
 * Convert currency
 */
export async function convertCurrency(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<ConvertCurrencyArgs>(args, [
			"amount",
			"from",
			"to",
		]);
		const { amount, from, to } = validArgs;

		// Using a free currency conversion API
		const response = await axios.get("https://api.exchangerate.host/convert", {
			params: {
				from,
				to,
				amount,
			},
		});

		if (!response.data.success) {
			throw new Error("Currency conversion failed");
		}

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(
						{
							from: from,
							to: to,
							amount: amount,
							result: response.data.result,
							rate: response.data.info.rate,
							date: response.data.date,
						},
						null,
						2
					),
				},
			],
			isError: false,
		};
	} catch (error: any) {
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
