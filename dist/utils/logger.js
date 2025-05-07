/**
 * Create a logger that uses stderr to avoid interfering with JSON-RPC
 */
export const createLogger = () => {
    return {
        info: (message, ...args) => console.error(`[INFO] ${message}`, ...args),
        error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
        warn: (message, ...args) => console.error(`[WARN] ${message}`, ...args),
    };
};
// Export a default logger instance
export const logger = createLogger();
