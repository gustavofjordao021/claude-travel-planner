/**
 * Refresh Google Sheets authentication
 */
export declare function refreshAuth(): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Create a new Google Spreadsheet
 */
export declare function createSpreadsheet(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * List all sheets in a Google Spreadsheet
 */
export declare function listSheets(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Create a new sheet in a Google Spreadsheet
 */
export declare function createSheet(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Read all data from a sheet
 */
export declare function readAllFromSheet(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Read headings from a sheet (first row)
 */
export declare function readHeadings(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Read specific rows from a sheet
 */
export declare function readRows(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Read specific columns from a sheet
 */
export declare function readColumns(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Edit a cell in a sheet
 */
export declare function editCell(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Edit an entire row in a sheet
 */
export declare function editRow(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Edit an entire column in a sheet
 */
export declare function editColumn(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Insert a row at a specific position
 */
export declare function insertRow(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Insert a column at a specific position
 */
export declare function insertColumn(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Rename a sheet in a spreadsheet
 */
export declare function renameSheet(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
/**
 * Rename a spreadsheet
 */
export declare function renameDoc(args: Record<string, unknown>): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
