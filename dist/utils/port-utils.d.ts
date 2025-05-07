/**
 * Check if a port is available
 */
export declare function isPortAvailable(port: number): Promise<boolean>;
/**
 * Find an available port starting from a base port
 */
export declare function findAvailablePort(basePort: number, maxAttempts?: number): Promise<number | null>;
