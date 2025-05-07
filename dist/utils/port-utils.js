import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "./logger.js";
const execAsync = promisify(exec);
/**
 * Check if a port is available
 */
export async function isPortAvailable(port) {
    try {
        // Check if port is in use using 'lsof' on Mac/Linux or 'netstat' on Windows
        const isWindows = process.platform === "win32";
        const command = isWindows
            ? `netstat -an | findstr :${port}`
            : `lsof -i :${port}`;
        const { stdout } = await execAsync(command);
        // If the command returns output, the port is in use
        return !stdout.trim();
    }
    catch (error) {
        // Command failed or returned non-zero exit code (port not in use)
        return true;
    }
}
/**
 * Find an available port starting from a base port
 */
export async function findAvailablePort(basePort, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const port = basePort + i;
        const available = await isPortAvailable(port);
        if (available) {
            logger.info(`Found available port: ${port}`);
            return port;
        }
        logger.info(`Port ${port} is in use, trying next...`);
    }
    logger.error(`No available ports found after ${maxAttempts} attempts`);
    return null;
}
