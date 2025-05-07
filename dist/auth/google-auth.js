import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { authenticate } from "@google-cloud/local-auth";
import { fileURLToPath } from "url";
import { URL } from "url";
import { isPortAvailable } from "../utils/port-utils.js";
import { logger } from "../utils/logger.js";
import { startCallbackServer } from "./callback-server.js";
// Constants
export const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
// Determine paths for credentials and keys
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credentialsPath = process.env.GSHEETS_CREDENTIALS_PATH ||
    path.join(__dirname, "../../.gsheets-server-credentials.json");
const gcpKeysPath = process.env.GSHEETS_OAUTH_PATH ||
    path.join(__dirname, "../../gcp-oauth.keys.json");
/**
 * Helper function to get OAuth client credentials from the keys file
 */
export function getOAuthClientCredentials() {
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
 * Helper function to handle authentication errors and refresh token when needed
 */
export async function handleAuthError(error) {
    if (error.message?.includes("invalid_grant") ||
        error.message?.includes("token expired") ||
        error.message?.includes("unauthorized") ||
        error.message?.includes("invalid_token") ||
        error.code === 401) {
        logger.error("Authentication error detected, refreshing token...");
        try {
            const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
            const { client_id, client_secret, redirect_uri } = getOAuthClientCredentials();
            if (credentials.refresh_token) {
                try {
                    logger.info("Attempting to refresh token using refresh_token...");
                    const authClient = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
                    authClient.setCredentials({
                        refresh_token: credentials.refresh_token,
                    });
                    const result = await authClient.getAccessToken();
                    const newToken = result.token;
                    const newExpiry = new Date().getTime() + 3600 * 1000; // Default 1 hour
                    if (newToken) {
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
                }
                catch (refreshError) {
                    logger.info("Token refresh failed, falling back to full re-auth:", refreshError instanceof Error
                        ? refreshError.message
                        : String(refreshError));
                }
            }
            const auth = await authenticateAndSaveCredentials();
            google.options({ auth });
            logger.info("Authentication refreshed successfully via full re-auth flow");
            return true;
        }
        catch (refreshError) {
            logger.error("Failed to refresh authentication:", refreshError instanceof Error
                ? refreshError.message
                : String(refreshError));
            return false;
        }
    }
    return false;
}
/**
 * Try authentication with alternative ports if the default one is not available
 */
export async function tryAuthWithAlternativePorts() {
    // Try a range of alternative ports
    const alternativePorts = [3001, 3002, 3003, 3004, 3005];
    for (const port of alternativePorts) {
        // Create a temporary credentials file with the alternative port
        const tempKeysPath = path.join(__dirname, `../../.temp-gcp-oauth-${port}.json`);
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
 * Authenticate and save credentials with custom callback page
 */
export async function authenticateAndSaveCredentials() {
    if (!fs.existsSync(gcpKeysPath)) {
        logger.error("GCP keys not found. Please create your credentials in Google Cloud then copy `gcp-oauth.keys.json` into your project directory.");
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
        // Start the custom auth callback server
        let callbackServer = null;
        let authPromiseResolve;
        let authPromiseReject;
        const authPromise = new Promise((resolve, reject) => {
            authPromiseResolve = resolve;
            authPromiseReject = reject;
        });
        const startAuthCallbackServer = (port) => {
            logger.info(`Starting auth callback server on port ${port}`);
            callbackServer = startCallbackServer({
                port,
                defaultRedirectUrl: "https://claude.ai",
                onAuthSuccess: (code) => {
                    logger.info("Auth code received, completing OAuth flow");
                    // We don't actually need to do anything here as the callback is handled by the Google Auth library
                },
                onAuthError: (error) => {
                    logger.error(`Authentication error from callback: ${error}`);
                    if (authPromiseReject) {
                        authPromiseReject(new Error(`OAuth error: ${error}`));
                    }
                },
            });
        };
        if (isRegisteredPortAvailable) {
            // If the registered port is available, use it directly
            logger.info(`Using registered port ${registeredPort} for authentication...`);
            startAuthCallbackServer(registeredPort);
            const auth = await authenticate({
                keyfilePath: gcpKeysPath,
                scopes: SCOPES,
            });
            // Close the callback server
            if (callbackServer) {
                callbackServer.close();
            }
            fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials));
            logger.info("Credentials saved successfully.");
            return auth;
        }
        else {
            // Try alternative ports instead of failing immediately
            logger.info(`Registered port ${registeredPort} is already in use.`);
            logger.info("Trying alternative ports...");
            // Try a range of alternative ports
            const alternativePorts = [3001, 3002, 3003, 3004, 3005];
            for (const port of alternativePorts) {
                // Create a temporary credentials file with the alternative port
                const tempKeysPath = path.join(__dirname, `../../.temp-gcp-oauth-${port}.json`);
                try {
                    // Read the original OAuth key file
                    const keyFile = JSON.parse(fs.readFileSync(gcpKeysPath, "utf-8"));
                    // Update the redirect URIs to use the alternative port
                    if (keyFile.installed && keyFile.installed.redirect_uris) {
                        keyFile.installed.redirect_uris =
                            keyFile.installed.redirect_uris.map((uri) => uri.replace(/:[0-9]+\//, `:${port}/`));
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
                    // Start the custom callback server on the alternative port
                    startAuthCallbackServer(port);
                    // Attempt authentication with the alternative port
                    const auth = await authenticate({
                        keyfilePath: tempKeysPath,
                        scopes: SCOPES,
                    });
                    // Close the callback server
                    if (callbackServer) {
                        callbackServer.close();
                    }
                    // Save the credentials
                    fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials));
                    logger.info(`Authentication successful using port ${port}.`);
                    return auth;
                }
                catch (error) {
                    logger.info(`Failed to authenticate with port ${port}: ${error.message}`);
                    // Close the callback server if it was started
                    if (callbackServer) {
                        callbackServer.close();
                        callbackServer = null;
                    }
                    // Continue to the next port
                }
            }
            // If all alternative ports failed, throw an error
            throw new Error("Authentication failed with all alternative ports. Please update your OAuth credentials in Google Cloud Console.");
        }
    }
    catch (error) {
        logger.error("Authentication failed:", error.message);
        throw error;
    }
}
/**
 * Initialize authentication on startup
 */
export async function initializeAuth() {
    try {
        logger.info("Initializing authentication...");
        if (!fs.existsSync(credentialsPath)) {
            logger.info("No credentials found. Starting authentication flow...");
            return await authenticateAndSaveCredentials();
        }
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
        const { client_id, client_secret, redirect_uri } = getOAuthClientCredentials();
        const authClient = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
        authClient.setCredentials(credentials);
        // Check if token is expired or about to expire
        const expiryDate = credentials.expiry_date;
        const isExpired = !expiryDate || new Date().getTime() > expiryDate - 5 * 60 * 1000;
        if (isExpired && credentials.refresh_token) {
            logger.info("Token is expired or about to expire. Refreshing...");
            try {
                const result = await authClient.getAccessToken();
                if (result.token) {
                    const refreshedCredentials = {
                        ...credentials,
                        access_token: result.token,
                        expiry_date: new Date().getTime() + 3600 * 1000,
                    };
                    fs.writeFileSync(credentialsPath, JSON.stringify(refreshedCredentials));
                    authClient.setCredentials(refreshedCredentials);
                    logger.info("Token refreshed successfully");
                    return authClient;
                }
            }
            catch (error) {
                logger.warn("Token refresh failed, starting fresh authentication", error);
                return await authenticateAndSaveCredentials();
            }
        }
        logger.info("Using existing credentials");
        return authClient;
    }
    catch (error) {
        logger.error("Error initializing authentication:", error);
        return await authenticateAndSaveCredentials();
    }
}
