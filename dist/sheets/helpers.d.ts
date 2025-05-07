/**
 * Helper function to get sheet title
 */
export declare function getSheetTitle(spreadsheetId: string, sheetName?: string): Promise<string>;
/**
 * Helper function to get sheet ID
 */
export declare function getSheetId(spreadsheetId: string, sheetName?: string): Promise<number>;
/**
 * Helper function to convert column letter to index (A=0, B=1, etc.)
 */
export declare function columnLetterToIndex(column: string): number;
/**
 * Helper function to safely parse arguments and validate required properties
 */
export declare function validateArgs<T>(args: Record<string, unknown> | undefined, requiredProps: string[]): T;
