export declare const TravelMode: {
    DRIVING: string;
    WALKING: string;
    BICYCLING: string;
    TRANSIT: string;
};
/**
 * Geocode an address to get coordinates
 */
export declare function geocode(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Search for places near a location
 */
export declare function placesNearby(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Get distance and duration between origins and destinations
 */
export declare function distanceMatrix(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Get directions between two locations
 */
export declare function directions(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Get timezone for a location
 */
export declare function timezone(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Convert currency
 */
export declare function convertCurrency(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
