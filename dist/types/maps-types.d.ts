/**
 * Type definitions for Google Maps operations
 */
export interface GeocodeArgs {
    address: string;
}
export interface PlacesNearbyArgs {
    location: string;
    radius: number;
    type: string;
    keyword?: string;
}
export interface DistanceMatrixArgs {
    origins: string[];
    destinations: string[];
    mode?: string;
}
export interface DirectionsArgs {
    origin: string;
    destination: string;
    waypoints?: string[];
    mode?: string;
}
export interface TimezoneArgs {
    location: string;
    timestamp?: number;
}
export interface ConvertCurrencyArgs {
    amount: number;
    from: string;
    to: string;
}
