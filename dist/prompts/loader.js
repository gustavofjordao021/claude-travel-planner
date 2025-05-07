#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load all prompt templates from JSON files in the prompts directory
 * @returns {Array} Array of prompt objects
 */
export function loadPrompts() {
	const promptsDir = path.dirname(__filename);

	try {
		// Get all JSON files in the prompts directory
		const promptFiles = fs
			.readdirSync(promptsDir)
			.filter((file) => file.endsWith(".json") && !file.startsWith("."));

		// Load and parse each prompt file
		return promptFiles
			.map((file) => {
				try {
					const content = fs.readFileSync(path.join(promptsDir, file), "utf-8");
					const promptData = JSON.parse(content);

					// Validate that the prompt has required fields
					if (!promptData.name || !promptData.text) {
						console.error(
							`Warning: Prompt file ${file} is missing required fields (name, text)`
						);
						return null;
					}

					return promptData;
				} catch (fileError) {
					console.error(
						`Error loading prompt file ${file}:`,
						fileError.message
					);
					return null;
				}
			})
			.filter(Boolean); // Remove any null entries
	} catch (error) {
		console.error("Error loading prompts:", error.message);
		return [];
	}
}

/**
 * Get a specific prompt by name
 * @param {string} promptName - The name of the prompt to retrieve
 * @returns {Object|null} The prompt object or null if not found
 */
export function getPromptByName(promptName) {
	const prompts = loadPrompts();
	return prompts.find((prompt) => prompt.name === promptName) || null;
}

// Test loading the prompts if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const prompts = loadPrompts();
	console.log(
		`Loaded ${prompts.length} prompts:`,
		prompts.map((p) => p.name)
	);
}
