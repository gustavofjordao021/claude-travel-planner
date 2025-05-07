import { Logger } from "../types/common.js";
/**
 * Create a logger that uses stderr to avoid interfering with JSON-RPC
 */
export declare const createLogger: () => Logger;
export declare const logger: Logger;
