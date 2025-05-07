import { OAuth2Client } from "google-auth-library";
export declare const SCOPES: string[];
/**
 * Helper function to get OAuth client credentials from the keys file
 */
export declare function getOAuthClientCredentials(): {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
};
/**
 * Helper function to handle authentication errors and refresh token when needed
 */
export declare function handleAuthError(error: any): Promise<boolean>;
/**
 * Try authentication with alternative ports if the default one is not available
 */
export declare function tryAuthWithAlternativePorts(): Promise<OAuth2Client>;
/**
 * Authenticate and save credentials with custom callback page
 */
export declare function authenticateAndSaveCredentials(): Promise<OAuth2Client>;
/**
 * Initialize authentication on startup
 */
export declare function initializeAuth(): Promise<OAuth2Client>;
