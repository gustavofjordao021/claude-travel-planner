# CLaude Travel Planner

A Model Context Protocol (MCP) connector for travel planning that allows AI agents to interact with Google Sheets, Maps, and web content directly. This connector enables AI models to create, read, update, and manage travel plans without requiring direct API access.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [API Setup](#api-setup)
  - [Google Cloud Setup](#google-cloud-setup)
  - [Google Maps Setup](#google-maps-setup-optional)
- [Architecture Overview](#architecture-overview)
- [Starting the Server](#starting-the-server)
- [Integration with Claude](#integration-with-claude)
- [Built-in Prompts](#built-in-prompts)
- [Available Tools](#available-tools)
- [Usage Examples](#usage-examples)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Development Notes](#development-notes)
- [License](#license)

## Prerequisites

- Node.js (v14+)
- npm or yarn
- A Google account
- Basic knowledge of Google Cloud Platform for setting up OAuth credentials
- (Optional) Google Maps API key for location-based planning

## Installation

1. Clone this repository:

```bash
git clone https://github.com/gustavofjordao021/claude-travel-planner.git
cd claude-travel-planner
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables (copy from template):

```bash
cp .env.example .env
```

4. Build the project:

```bash
npm run build
```

## API Setup

### Google Cloud Setup

1. Create OAuth credentials in Google Cloud Platform:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or select an existing one)
   - Enable the [Google Sheets API](https://console.cloud.google.com/marketplace/product/google/sheets.googleapis.com)
   - Navigate to "APIs & Services" > "Credentials"
   - Configure the OAuth consent screen:
     - User Type: External (if not part of a Google Workspace organization)
     - Add scopes for Google Sheets API (`https://www.googleapis.com/auth/spreadsheets`)
     - Add test users (including your own email)
   - Create OAuth client ID:
     - Application type: Desktop application
     - Name: Google Sheets MCP (or any name you prefer)
     - Specify a redirect URI for localhost (e.g., `http://localhost:3000/oauth2callback`)
   - Download the credentials JSON
   - Rename the downloaded file to `gcp-oauth.keys.json` and place it in the project root directory

### Google Maps Setup (Optional)

To enable Google Maps integration for travel planning:

1. Create a Google Maps API key from [Google Cloud Console](https://console.cloud.google.com)
2. Enable the following APIs in your Google Cloud project:
   - Maps JavaScript API
   - Places API
   - Directions API
   - Distance Matrix API
   - Time Zone API
3. Set your API key in the `.env` file:

```
GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Architecture Overview

The Google Sheets MCP for Travel Planning uses a modular architecture with several key components:

- **Auth Module**: Handles Google OAuth authentication and token management
- **Sheets Module**: Provides tools for interacting with Google Sheets
- **Maps Module**: Implements location and travel-related features using Google Maps APIs
- **Utils Module**: Contains utility functions like logging and port management
- **Types Module**: Defines TypeScript types used throughout the application

### Key Design Principles

1. **Modularity**: Each functionality is separated into its own module for better maintainability
2. **Type Safety**: TypeScript interfaces ensure proper data handling throughout the system
3. **Extensibility**: The system can be extended with additional tools or services
4. **Authentication**: A robust authentication system handles token refresh and port management
5. **Standardization**: Common error handling and logging patterns across all modules

### Authentication Flow

The authentication works as follows:

1. On first run, the system checks for credentials
2. If not found, it opens a browser window for OAuth authentication
3. The user logs in to their Google account and grants permission
4. Credentials are saved locally in `.gsheets-server-credentials.json` for future use
5. Token refresh is handled automatically when credentials expire

## Starting the Server

You can run the server in development or production mode:

### Development Mode

This runs the TypeScript code directly using ts-node:

```bash
npm run dev
```

### Production Mode

This compiles the TypeScript to JavaScript first, then runs the compiled code:

```bash
npm run serve
```

The first time you run the server, you'll be prompted to authenticate with your Google account. A browser window will open for authentication. After successful authentication, your credentials will be saved locally in `.gsheets-server-credentials.json` for future sessions.

## Integration with Claude

### Claude MCP Configuration

For integration with Claude, use the following configuration snippet:

```json
{
	"mcpServers": {
		"travel-planner": {
			"command": "node",
			"args": ["/path/to/claude-travel-planner/dist/travel-planner.js"]
		}
	}
}
```

> **Note:** Replace `/path/to/claude-travel-planner/` with the absolute path to your installation directory.

## Built-in Prompts

The Travel Planner MCP includes built-in prompts that provide structured guidance for common travel planning tasks:

### 1. Destination Research

The `destination_research` prompt guides Claude through a comprehensive process for researching a travel destination.

To use: "Use the destination_research prompt for Paris, France"

### 2. Itinerary Optimization

The `itinerary_optimization` prompt helps Claude create optimized daily travel itineraries.

To use: "Apply the itinerary_optimization prompt for my 3-day trip to Tokyo"

### 3. Budget Tracking

The `budget_tracking` prompt guides Claude through creating and managing a comprehensive travel budget.

To use: "Help me with budget_tracking for my trip to Italy with USD as base currency"

## Available Tools

The MCP provides a comprehensive set of tools for travel planning:

### Authentication

| Tool           | Description                                                 | Required Inputs | Optional Inputs |
| -------------- | ----------------------------------------------------------- | --------------- | --------------- |
| `refresh_auth` | Re-authenticate your Google Account when credentials expire | None            | None            |

### Spreadsheet Management

| Tool                 | Description                     | Required Inputs                            | Optional Inputs                                |
| -------------------- | ------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| `create_spreadsheet` | Create a new Google Spreadsheet | `title`: String                            | `initialSheetName`: String (default: "Sheet1") |
| `rename_doc`         | Rename a Google Spreadsheet     | `spreadsheetId`: String, `newName`: String | None                                           |

### Sheet Management

| Tool           | Description                                    | Required Inputs                                                 | Optional Inputs |
| -------------- | ---------------------------------------------- | --------------------------------------------------------------- | --------------- |
| `list_sheets`  | List all sheets/tabs in a Google Spreadsheet   | `spreadsheetId`: String                                         | None            |
| `create_sheet` | Create a new sheet/tab in a Google Spreadsheet | `spreadsheetId`: String, `sheetName`: String                    | None            |
| `rename_sheet` | Rename a sheet/tab in a spreadsheet            | `spreadsheetId`: String, `sheetName`: String, `newName`: String | None            |

### Reading Data

| Tool                  | Description                           | Required Inputs                                                        | Optional Inputs                               |
| --------------------- | ------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| `read_all_from_sheet` | Read all data from a specified sheet  | `spreadsheetId`: String                                                | `sheetName`: String (defaults to first sheet) |
| `read_headings`       | Read the column headings from a sheet | `spreadsheetId`: String                                                | `sheetName`: String (defaults to first sheet) |
| `read_rows`           | Read specific rows from a sheet       | `spreadsheetId`: String, `startRow`: Integer, `endRow`: Integer        | `sheetName`: String (defaults to first sheet) |
| `read_columns`        | Read specific columns from a sheet    | `spreadsheetId`: String, `columns`: Array of String (e.g., ["A", "C"]) | `sheetName`: String (defaults to first sheet) |

### Editing Data

| Tool            | Description                               | Required Inputs                                                              | Optional Inputs                                                          |
| --------------- | ----------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `edit_cell`     | Edit a single cell in a sheet             | `spreadsheetId`: String, `cellAddress`: String (e.g., "B2"), `value`: String | `sheetName`: String (defaults to first sheet)                            |
| `edit_row`      | Edit an entire row in a sheet             | `spreadsheetId`: String, `rowIndex`: Integer, `values`: Array of String      | `sheetName`: String (defaults to first sheet)                            |
| `edit_column`   | Edit an entire column in a sheet          | `spreadsheetId`: String, `columnLetter`: String, `values`: Array of String   | `sheetName`: String (defaults to first sheet)                            |
| `insert_row`    | Insert a new row at specified position    | `spreadsheetId`: String, `rowIndex`: Integer                                 | `sheetName`: String (defaults to first sheet), `values`: Array of String |
| `insert_column` | Insert a new column at specified position | `spreadsheetId`: String, `columnLetter`: String                              | `sheetName`: String (defaults to first sheet), `values`: Array of String |

### Google Maps Travel Tools

| Tool               | Description                                  | Required Inputs                                             | Optional Inputs                                                                    |
| ------------------ | -------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `geocode`          | Convert an address to geographic coordinates | `address`: String                                           | None                                                                               |
| `places_nearby`    | Find places near a specific location         | `location`: String, `radius`: Number, `type`: String        | `keyword`: String                                                                  |
| `distance_matrix`  | Calculate distances between multiple points  | `origins`: Array of String, `destinations`: Array of String | `mode`: String ("driving", "walking", "bicycling", "transit") - default: "driving" |
| `directions`       | Get directions between two locations         | `origin`: String, `destination`: String                     | `waypoints`: Array of String, `mode`: String                                       |
| `timezone`         | Get timezone information for a location      | `location`: String                                          | `timestamp`: Number (seconds since epoch) - default: current time                  |
| `convert_currency` | Convert between currencies                   | `amount`: Number, `from`: String, `to`: String              | None                                                                               |

## Usage Examples

### Complete Travel Planning Example

```bash
npm start
```

Example prompt: "Create a 3-day trip itinerary for Paris. Find the top attractions, calculate distances between them, and organize them into a daily schedule in a spreadsheet."

You can use the built-in prompts:

- "Use the destination_research prompt for Paris, France"
- "Apply the itinerary_optimization prompt for my 3-day trip to Tokyo"
- "Help me with budget_tracking for my trip to Italy with USD as base currency"

### Tool Usage Examples

#### Creating a New Spreadsheet

```javascript
// Example tool call to create a new spreadsheet
{
  "name": "create_spreadsheet",
  "arguments": {
    "title": "My New Spreadsheet",
    "initialSheetName": "Data"
  }
}
```

#### Reading Data

```javascript
// Example tool call to read all data from a sheet
{
  "name": "read_all_from_sheet",
  "arguments": {
    "spreadsheetId": "1ABC123DEF456GHI789JKL",
    "sheetName": "Sheet1"
  }
}
```

#### Using Maps to Calculate Distance

```javascript
// Example tool call to calculate distance between two locations
{
  "name": "distance_matrix",
  "arguments": {
    "origins": ["Eiffel Tower, Paris"],
    "destinations": ["Louvre Museum, Paris", "Arc de Triomphe, Paris"],
    "mode": "walking"
  }
}
```

## Environment Variables

Create a `.env` file in the project root with:

```
# For Google Sheets authentication
GSHEETS_CREDENTIALS_PATH=/path/to/credentials.json  # Optional, default: .gsheets-server-credentials.json
GSHEETS_OAUTH_PATH=/path/to/oauth-keys.json  # Optional, default: gcp-oauth.keys.json

# For Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## Troubleshooting

### Authentication Issues

If you encounter authentication issues:

1. Delete the `.gsheets-server-credentials.json` file (if it exists)
2. Restart the server and go through the authentication flow again
3. Make sure your Google account has the necessary permissions
4. Verify your OAuth consent screen is properly configured

### TypeScript or Build Issues

If you encounter TypeScript errors:

1. Make sure all dependencies are installed with `npm install`
2. Check TypeScript configuration in `tsconfig.json`
3. Try removing `dist` directory and rebuilding with `npm run build`

### MCP Connection Issues

If Claude is having trouble connecting to the MCP:

1. Make sure the MCP server is running
2. Check that the MCP configuration in Claude is correct
3. Verify that the path to the MCP script is correct and absolute
4. Check for any error messages in the MCP server terminal

## Development Notes

- The project uses TypeScript for type safety
- All console.log output is redirected to stderr to keep stdout clean for JSON-RPC communication
- Authentication with Google is handled automatically with token refresh support
- For troubleshooting, view the stderr output from the running MCP

### Project Structure

```
google-sheets-mcp/
├── src/                      # TypeScript source code
│   ├── auth/                 # Authentication handling
│   ├── sheets/               # Google Sheets integration
│   ├── maps/                 # Google Maps functionality
│   ├── utils/                # Common utilities
│   ├── types/                # TypeScript type definitions
│   └── travel-planner.ts     # Main entry point
├── dist/                     # Compiled JavaScript (generated)
├── package.json              # Project configuration
└── tsconfig.json             # TypeScript configuration
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
