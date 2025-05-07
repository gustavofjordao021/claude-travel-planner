import { Logger } from "../types/common.js";

/**
 * Create a logger that uses stderr to avoid interfering with JSON-RPC
 */
export const createLogger = (): Logger => {
	return {
		info: (message: string, ...args: any[]) =>
			console.error(`[INFO] ${message}`, ...args),
		error: (message: string, ...args: any[]) =>
			console.error(`[ERROR] ${message}`, ...args),
		warn: (message: string, ...args: any[]) =>
			console.error(`[WARN] ${message}`, ...args),
	};
};

// Export a default logger instance
export const logger = createLogger();
