import fs from "fs";
import { google } from "googleapis";
import { logger } from "../utils/logger.js";
import {
	getSheetTitle,
	getSheetId,
	columnLetterToIndex,
	validateArgs,
} from "./helpers.js";
import { authenticateAndSaveCredentials } from "../auth/google-auth.js";
import {
	CreateSpreadsheetArgs,
	SpreadsheetArgs,
	SheetArgs,
	CreateSheetArgs,
	RenameSheetArgs,
	RenameDocArgs,
	ReadRowsArgs,
	ReadColumnsArgs,
	EditCellArgs,
	EditRowArgs,
	EditColumnArgs,
	InsertRowArgs,
	InsertColumnArgs,
} from "../types/sheets-types.js";

const sheets = google.sheets("v4");

// Define the tools as simple functions to be used by the server

/**
 * Refresh Google Sheets authentication
 */
export async function refreshAuth() {
	try {
		await authenticateAndSaveCredentials();
		const credentials = JSON.parse(
			fs.readFileSync(
				process.env.GSHEETS_CREDENTIALS_PATH ||
					".gsheets-server-credentials.json",
				"utf-8"
			)
		);
		const auth = new google.auth.OAuth2();
		auth.setCredentials(credentials);
		google.options({ auth });
		return {
			content: [
				{
					type: "text",
					text: "Authentication refreshed successfully. You can now continue using Google Sheets.",
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Failed to refresh authentication: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Create a new Google Spreadsheet
 */
export async function createSpreadsheet(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<CreateSpreadsheetArgs>(args, ["title"]);
		const { title, initialSheetName = "Itinerary" } = validArgs;

		const resource = {
			properties: {
				title: title,
			},
			sheets: [
				{
					properties: {
						title: initialSheetName,
					},
				},
			],
		};

		const response = await sheets.spreadsheets.create({
			requestBody: resource,
		});

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(
						{
							message: `Travel spreadsheet "${title}" created successfully.`,
							spreadsheetId: response.data.spreadsheetId,
							spreadsheetUrl: response.data.spreadsheetUrl,
						},
						null,
						2
					),
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * List all sheets in a Google Spreadsheet
 */
export async function listSheets(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<SpreadsheetArgs>(args, ["spreadsheetId"]);
		const { spreadsheetId } = validArgs;

		const spreadsheet = await sheets.spreadsheets.get({
			spreadsheetId,
		});

		if (!spreadsheet.data.sheets || !spreadsheet.data.sheets.length) {
			throw new Error("Spreadsheet has no sheets");
		}

		const sheetsList = spreadsheet.data.sheets.map((sheet) => ({
			title: sheet.properties?.title,
			sheetId: sheet.properties?.sheetId,
			index: sheet.properties?.index,
		}));

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(sheetsList, null, 2),
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Create a new sheet in a Google Spreadsheet
 */
export async function createSheet(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<CreateSheetArgs>(args, [
			"spreadsheetId",
			"sheetName",
		]);
		const { spreadsheetId, sheetName } = validArgs;

		await sheets.spreadsheets.batchUpdate({
			spreadsheetId,
			requestBody: {
				requests: [
					{
						addSheet: {
							properties: {
								title: sheetName,
							},
						},
					},
				],
			},
		});

		return {
			content: [
				{
					type: "text",
					text: `Sheet "${sheetName}" created successfully in your travel spreadsheet.`,
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Read all data from a sheet
 */
export async function readAllFromSheet(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<SheetArgs>(args, ["spreadsheetId"]);
		const { spreadsheetId, sheetName } = validArgs;
		const title = await getSheetTitle(spreadsheetId, sheetName);

		const res = await sheets.spreadsheets.values.get({
			spreadsheetId,
			range: title,
		});

		const data = res.data.values || [];

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(data, null, 2),
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Read headings from a sheet (first row)
 */
export async function readHeadings(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<SheetArgs>(args, ["spreadsheetId"]);
		const { spreadsheetId, sheetName } = validArgs;
		const title = await getSheetTitle(spreadsheetId, sheetName);

		const res = await sheets.spreadsheets.values.get({
			spreadsheetId,
			range: `${title}!1:1`,
		});

		const headings = res.data.values || [];

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(headings, null, 2),
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Read specific rows from a sheet
 */
export async function readRows(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<ReadRowsArgs>(args, [
			"spreadsheetId",
			"startRow",
			"endRow",
		]);
		const { spreadsheetId, sheetName, startRow, endRow } = validArgs;
		const title = await getSheetTitle(spreadsheetId, sheetName);

		// Convert to 1-based for Sheets API
		const adjustedStartRow = startRow + 1;
		const adjustedEndRow = endRow + 1;

		const res = await sheets.spreadsheets.values.get({
			spreadsheetId,
			range: `${title}!${adjustedStartRow}:${adjustedEndRow}`,
		});

		const rows = res.data.values || [];

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(rows, null, 2),
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Read specific columns from a sheet
 */
export async function readColumns(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<ReadColumnsArgs>(args, [
			"spreadsheetId",
			"columns",
		]);
		const { spreadsheetId, sheetName, columns } = validArgs;
		const title = await getSheetTitle(spreadsheetId, sheetName);

		const result: Record<string, string[]> = {};

		for (const column of columns) {
			const res = await sheets.spreadsheets.values.get({
				spreadsheetId,
				range: `${title}!${column}:${column}`,
			});

			result[column] = (res.data.values || []).map((row) => row[0]);
		}

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Edit a cell in a sheet
 */
export async function editCell(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<EditCellArgs>(args, [
			"spreadsheetId",
			"cellAddress",
			"value",
		]);
		const { spreadsheetId, sheetName, cellAddress, value } = validArgs;
		const title = await getSheetTitle(spreadsheetId, sheetName);

		await sheets.spreadsheets.values.update({
			spreadsheetId,
			range: `${title}!${cellAddress}`,
			valueInputOption: "USER_ENTERED",
			requestBody: {
				values: [[value]],
			},
		});

		return {
			content: [
				{
					type: "text",
					text: `Cell ${cellAddress} updated successfully to "${value}".`,
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Edit an entire row in a sheet
 */
export async function editRow(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<EditRowArgs>(args, [
			"spreadsheetId",
			"rowIndex",
			"values",
		]);
		const { spreadsheetId, sheetName, rowIndex, values } = validArgs;
		const title = await getSheetTitle(spreadsheetId, sheetName);

		await sheets.spreadsheets.values.update({
			spreadsheetId,
			range: `${title}!${rowIndex}:${rowIndex}`,
			valueInputOption: "USER_ENTERED",
			requestBody: {
				values: [values],
			},
		});

		return {
			content: [
				{
					type: "text",
					text: `Row ${rowIndex} updated successfully with the travel information.`,
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Edit an entire column in a sheet
 */
export async function editColumn(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<EditColumnArgs>(args, [
			"spreadsheetId",
			"columnLetter",
			"values",
		]);
		const { spreadsheetId, sheetName, columnLetter, values } = validArgs;
		const title = await getSheetTitle(spreadsheetId, sheetName);

		// Convert array of values to array of arrays for the API
		const formattedValues = values.map((value) => [value]);

		await sheets.spreadsheets.values.update({
			spreadsheetId,
			range: `${title}!${columnLetter}:${columnLetter}`,
			valueInputOption: "USER_ENTERED",
			requestBody: {
				values: formattedValues,
			},
		});

		return {
			content: [
				{
					type: "text",
					text: `Column ${columnLetter} updated successfully in your travel spreadsheet.`,
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Insert a row at a specific position
 */
export async function insertRow(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<InsertRowArgs>(args, [
			"spreadsheetId",
			"rowIndex",
		]);
		const { spreadsheetId, sheetName, rowIndex, values = [] } = validArgs;
		const sheetId = await getSheetId(spreadsheetId, sheetName);
		const title = await getSheetTitle(spreadsheetId, sheetName);

		// First, insert the row
		await sheets.spreadsheets.batchUpdate({
			spreadsheetId,
			requestBody: {
				requests: [
					{
						insertDimension: {
							range: {
								sheetId: sheetId,
								dimension: "ROWS",
								startIndex: rowIndex - 1, // Convert to 0-based index
								endIndex: rowIndex, // non-inclusive end index
							},
						},
					},
				],
			},
		});

		// Then, if values were provided, update the row with the values
		if (values.length > 0) {
			await sheets.spreadsheets.values.update({
				spreadsheetId,
				range: `${title}!${rowIndex}:${rowIndex}`,
				valueInputOption: "USER_ENTERED",
				requestBody: {
					values: [values],
				},
			});
		}

		return {
			content: [
				{
					type: "text",
					text: `Row inserted successfully at position ${rowIndex} in your travel spreadsheet.`,
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Insert a column at a specific position
 */
export async function insertColumn(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<InsertColumnArgs>(args, [
			"spreadsheetId",
			"columnLetter",
		]);
		const { spreadsheetId, sheetName, columnLetter, values = [] } = validArgs;
		const sheetId = await getSheetId(spreadsheetId, sheetName);
		const title = await getSheetTitle(spreadsheetId, sheetName);

		// Convert column letter to index
		const columnIndex = columnLetterToIndex(columnLetter);

		// First, insert the column
		await sheets.spreadsheets.batchUpdate({
			spreadsheetId,
			requestBody: {
				requests: [
					{
						insertDimension: {
							range: {
								sheetId: sheetId,
								dimension: "COLUMNS",
								startIndex: columnIndex,
								endIndex: columnIndex + 1, // non-inclusive end index
							},
						},
					},
				],
			},
		});

		// Then, if values were provided, update the column with the values
		if (values.length > 0) {
			// Format values for API
			const formattedValues = values.map((value) => [value]);

			await sheets.spreadsheets.values.update({
				spreadsheetId,
				range: `${title}!${columnLetter}:${columnLetter}`,
				valueInputOption: "USER_ENTERED",
				requestBody: {
					values: formattedValues,
				},
			});
		}

		return {
			content: [
				{
					type: "text",
					text: `Column inserted successfully at position ${columnLetter} in your travel spreadsheet.`,
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Rename a sheet in a spreadsheet
 */
export async function renameSheet(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<RenameSheetArgs>(args, [
			"spreadsheetId",
			"sheetName",
			"newName",
		]);
		const { spreadsheetId, sheetName, newName } = validArgs;
		const sheetId = await getSheetId(spreadsheetId, sheetName);

		await sheets.spreadsheets.batchUpdate({
			spreadsheetId,
			requestBody: {
				requests: [
					{
						updateSheetProperties: {
							properties: {
								sheetId: sheetId,
								title: newName,
							},
							fields: "title",
						},
					},
				],
			},
		});

		return {
			content: [
				{
					type: "text",
					text: `Sheet renamed from "${sheetName}" to "${newName}" successfully in your travel spreadsheet.`,
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}

/**
 * Rename a spreadsheet
 */
export async function renameDoc(args: Record<string, unknown>) {
	try {
		const validArgs = validateArgs<RenameDocArgs>(args, [
			"spreadsheetId",
			"newName",
		]);
		const { spreadsheetId, newName } = validArgs;

		await sheets.spreadsheets.batchUpdate({
			spreadsheetId,
			requestBody: {
				requests: [
					{
						updateSpreadsheetProperties: {
							properties: {
								title: newName,
							},
							fields: "title",
						},
					},
				],
			},
		});

		return {
			content: [
				{
					type: "text",
					text: `Travel spreadsheet renamed to "${newName}" successfully.`,
				},
			],
			isError: false,
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `Error: ${error.message}`,
				},
			],
			isError: true,
		};
	}
}
