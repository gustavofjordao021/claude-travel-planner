#!/usr/bin/env node
import * as http from "http";
interface CallbackServerOptions {
    port: number;
    defaultRedirectUrl?: string;
    onAuthSuccess?: (code: string) => void;
    onAuthError?: (error: string) => void;
}
/**
 * Creates and starts a server to handle OAuth callback with a custom UI
 */
export declare function startCallbackServer(options: CallbackServerOptions): http.Server;
export {};
