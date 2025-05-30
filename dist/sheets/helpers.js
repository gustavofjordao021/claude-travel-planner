import { google } from "googleapis";
import { handleAuthError } from "../auth/google-auth.js";
const sheets = google.sheets("v4");
/**
 * Helper function to get sheet title
 */
export async function getSheetTitle(spreadsheetId, sheetName) {
    if (sheetName)
        return sheetName;
    try {
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
        });
        if (!spreadsheet.data.sheets || !spreadsheet.data.sheets.length) {
            throw new Error("Spreadsheet has no sheets");
        }
        return spreadsheet.data.sheets[0].properties?.title || "";
    }
    catch (error) {
        if (await handleAuthError(error)) {
            // Retry after auth refresh
            return getSheetTitle(spreadsheetId, sheetName);
        }
        throw error;
    }
}
/**
 * Helper function to get sheet ID
 */
export async function getSheetId(spreadsheetId, sheetName) {
    try {
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
        });
        if (!spreadsheet.data.sheets || !spreadsheet.data.sheets.length) {
            throw new Error("Spreadsheet has no sheets");
        }
        if (sheetName) {
            const sheet = spreadsheet.data.sheets.find((s) => s.properties?.title === sheetName);
            if (!sheet) {
                throw new Error(`Sheet "${sheetName}" not found`);
            }
            return sheet.properties?.sheetId || 0;
        }
        return spreadsheet.data.sheets[0].properties?.sheetId || 0;
    }
    catch (error) {
        if (await handleAuthError(error)) {
            // Retry after auth refresh
            return getSheetId(spreadsheetId, sheetName);
        }
        throw error;
    }
}
/**
 * Helper function to convert column letter to index (A=0, B=1, etc.)
 */
export function columnLetterToIndex(column) {
    let result = 0;
    for (let i = 0; i < column.length; i++) {
        result = result * 26 + (column.charCodeAt(i) - "A".charCodeAt(0) + 1);
    }
    return result - 1; // 0-based index
}
/**
 * Helper function to safely parse arguments and validate required properties
 */
export function validateArgs(args, requiredProps) {
    if (!args) {
        throw new Error("Missing arguments");
    }
    for (const prop of requiredProps) {
        if (args[prop] === undefined) {
            throw new Error(`Missing required parameter: ${prop}`);
        }
    }
    return args;
}
