/**
 * Type definitions for Google Sheets operations
 */

export interface AuthArgs {}

export interface CreateSpreadsheetArgs {
	title: string;
	initialSheetName?: string;
}

export interface SpreadsheetArgs {
	spreadsheetId: string;
}

export interface SheetArgs extends SpreadsheetArgs {
	sheetName?: string;
}

export interface CreateSheetArgs extends SpreadsheetArgs {
	sheetName: string;
}

export interface RenameSheetArgs extends SpreadsheetArgs {
	sheetName: string;
	newName: string;
}

export interface RenameDocArgs extends SpreadsheetArgs {
	newName: string;
}

export interface ReadRowsArgs extends SheetArgs {
	startRow: number;
	endRow: number;
}

export interface ReadColumnsArgs extends SheetArgs {
	columns: string[];
}

export interface EditCellArgs extends SheetArgs {
	cellAddress: string;
	value: string;
}

export interface EditRowArgs extends SheetArgs {
	rowIndex: number;
	values: string[];
}

export interface EditColumnArgs extends SheetArgs {
	columnLetter: string;
	values: string[];
}

export interface InsertRowArgs extends SheetArgs {
	rowIndex: number;
	values?: string[];
}

export interface InsertColumnArgs extends SheetArgs {
	columnLetter: string;
	values?: string[];
}
