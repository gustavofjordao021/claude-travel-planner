────────────────────────────────────────────────────  
1 ARCHITECTURE OVERVIEW  
────────────────────────────────────────────────────  
• Single MCP server process (existing `google-sheets-mcp` entry-point)  
 ├── Integrations  
 │ ├── sheets (✓ already)  
 │ ├── browserbase (✓ already)  
 │ └── maps ▶ NEW (`integrations/google-maps/`)  
 ├── Resources layer ▶ NEW (`resources/`)  
 ├── Prompts layer ▶ NEW (`prompts/`)  
 ├── Validation layer ▶ NEW (`schemas/`)  
 └── Travel domain utilities (`utils/`)

The server stays STDIO-based; we simply add capabilities.

────────────────────────────────────────────────────  
2 GOOGLE MAPS MCP INTEGRATION  
────────────────────────────────────────────────────  
A. Google Cloud setup  
 • Enable "Maps JavaScript", "Places", "Directions" & "Distance Matrix" APIs.  
 • Put Maps API key in `.env` as `GOOGLE_MAPS_API_KEY`.

B. Code scaffolding

```
integrations/google-maps/
  ├── index.ts              // registerGoogleMapsTools(server)
  └── maps-api.ts           // thin wrapper around Google Maps REST
```

C. Core Maps tools to expose  
| Tool | Description | Required Inputs | Typical Output |
|------|-------------|-----------------|----------------|
| `maps_distance` | Straight-line & driving distance between 2 coords | `origin`, `destination` | `km`, `estimated_time` |
| `maps_route` | Optimized driving/transit route w/ polyline | `waypoints[]`, `mode` | geojson/polyline |
| `maps_place_search` | Find POIs near lat/lng or text query | `query` OR `lat`, `lng`, `radius` | array of POIs |
| `maps_timezone` | Time-zone for coordinates | `lat`, `lng` | IANA TZ string |

D. Registration pattern  
Replicate Sheets/Browserbase style:

```
export function registerGoogleMapsTools(server: Server) { … }
```

Declare capability & append tools in `ListTools` handler.

────────────────────────────────────────────────────  
3 TRAVEL-SPECIFIC PROMPTS (TEMPLATES)  
────────────────────────────────────────────────────  
Directory: `prompts/` with `.json` or `.yaml` files following MCP prompt schema.

• `destination_research.json`  
 Instruction set guiding the model to:

1. call `maps_place_search` to list attractions;
2. open each link with `browserbase_navigate`;
3. store summary in Google Sheets.

• `itinerary_optimization.json`  
 Steps: read existing sheet → call `maps_route` for day grouping → update sheet.

• `budget_tracking.json`  
 Guides Sheets edits: insert spending rows, compute totals, call `currency_convert`.

Prompts must be added to `ListPrompts` handler (now empty).

────────────────────────────────────────────────────  
4 SPECIALIZED TRAVEL TOOLS  
────────────────────────────────────────────────────  
A. Itinerary Sheet Helpers

```
itinerary_create         // new spreadsheet w/ template tabs
itinerary_add_activity   // append row (date, time, place, cost)
itinerary_summary        // return high-level stats
```

B. Attraction Research (Browserbase)

```
browserbase_scrape_tripadvisor   // navigate + extract rating/price/category
```

C. Currency Conversion  
Simple REST call to exchangerate.host or fixer.io.

```
currency_convert           // amount, from, to → converted_amount, rate
```

Each tool lives in an integration or `utils` file, but exposed through MCP `CallTool`.

────────────────────────────────────────────────────  
5 TRAVEL-DATA RESOURCES  
────────────────────────────────────────────────────  
Add a lightweight "resource provider" layer returning structured JSON:

| URI scheme                | Source                    | Purpose                |
| ------------------------- | ------------------------- | ---------------------- |
| `weather://CITY_OR_COORD` | OpenWeather API           | forecasts in itinerary |
| `currency://rates`        | exchange-rate API         | daily FX rates         |
| `events://CITY/DATE`      | public-holiday/events API | avoid closures         |
| `transport://ROUTE_ID`    | GTFS feeds                | train/bus schedules    |

Implement a generic `ReadResource` handler that detects these schemes and fetches on-demand (cache in memory).

────────────────────────────────────────────────────  
6 SCHEMA VALIDATION (Zod)  
────────────────────────────────────────────────────  
Create `schemas/` with Zod objects for:

• `DateISO` – `YYYY-MM-DD`  
• `TimeISO` – `HH:MM`  
• `Lat`, `Lng` – numeric w/ bounds  
• `CurrencyCode` – 3-char ISO  
• `BudgetItem` – `{date, category, amount, currency}`  
Reuse these in each tool's `inputSchema` to guarantee consistency.

────────────────────────────────────────────────────  
7 SERVER CHANGES SUMMARY  
────────────────────────────────────────────────────

1. `index.ts`  
   • Import `registerGoogleMapsTools` and call it.  
   • Extend `ListTools` to merge Sheets + Browserbase + Maps + Travel tools.  
   • Extend `ListPrompts` to return new prompt definitions.  
   • Extend `ReadResource` to support new URI schemes.

2. `package.json`  
   • Add `@googlemaps/google-maps-services-js` (if using official SDK) or axios.  
   • Document new env vars: `GOOGLE_MAPS_API_KEY`, `OPENWEATHER_API_KEY`, etc.

────────────────────────────────────────────────────  
8 DEV MILESTONES  
────────────────────────────────────────────────────

1. Maps integration skeleton & token handling (½ day)
2. Implement 4 core Maps tools + tests (1 day)
3. Add prompt schema loader & 3 prompt templates (½ day)
4. Create itinerary sheet helpers (1 day)
5. Browserbase attraction scraper prototype (½ day)
6. Currency converter + schema validation layer (½ day)
7. Resource providers (weather, events, transport) (1 day)
8. Refactor `ListTools`/`ListPrompts`/`ReadResource` to merge everything (½ day)
9. End-to-end scenario test (plan → book) (½ day)
10. Docs update & demo video (½ day)

────────────────────────────────────────────────────  
9 NEXT STEPS  
────────────────────────────────────────────────────  
• Confirm API keys & quotas.  
• Decide on prompt storage format (JSON vs YAML).  
• Approve file/folder layout.  
• Begin with Google Maps integration (highest leverage).

────────────────────────────────────────────────────  
10 FINAL DECISIONS  
────────────────────────────────────────────────────

1. Google Maps APIs  
   • Enable "Maps JavaScript", "Places", "Directions" & "Distance Matrix".  
   • Key will be injected via `GOOGLE_MAPS_API_KEY` (same model as Sheets).

2. Prompt-template format  
   • Using **JSON** format.  
    – Directly serializable, no additional YAML loader, and MCP tools already expect JSON schemas.  
    – Readability is still good with comments in a side `README` if needed.

3. Directory layout  
   • Keep the layout from PLAN.md (`integrations/`, `resources/`, `prompts/`, `schemas/`, `utils/`).  
   • No nesting changes.

4. External data providers  
   • Weather → OpenWeather API.  
   • Currency → exchangerate.host (free, no key required).  
   • Holidays → Nager.Date API (public-holiday JSON feed – free, no key).  
    (`https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}`)

5. Milestone order  
   • Start with **Milestone 1 – Google Maps integration skeleton**, because other milestones build on it.

────────────────────────────────────────────────────  
11 DETAILED ROADMAP FOR MILESTONE 1  
────────────────────────────────────────────────────

Task list:

1. `package.json`  
   • Add `@googlemaps/google-maps-services-js` dependency.  
   • Document new env var in README.

2. Scaffolding

```
integrations/google-maps/
  ├── index.ts          // registerGoogleMapsTools(server)
  └── maps-api.ts       // thin wrapper: init client w/ key, helper fns
```

3. maps-api helpers  
   • `distance(origin, destination)`  
   • `route(waypoints, mode)`  
   • `placeSearch(query | lat/lng)`  
   • `timezone(lat, lng)`

4. Tool registration (`registerGoogleMapsTools`)  
   • Add four tools with detailed `inputSchema` (Zod) and description.  
   • Plug into existing `ListTools` merge logic.

5. Minimal tests (Jest or simple script) hitting Sandbox coordinates.

6. Update central `index.ts`  
   • `registerGoogleMapsTools(server)` call.  
   • Ensure Maps errors propagate through `handleAuthError`-like wrapper.

Expected PR footprint ~6-8 new files, ≤400 LOC.

After Milestone 1 is complete, we'll continue with:

- Milestone 2 → add prompt loader & three travel prompt JSON files.
- Milestone 3 → itinerary helpers, etc.
