import { requestUrl } from "obsidian";
import { extractCharacterId } from "./utils";

const CHARACTER_SERVICE_BASE = "https://character-service.dndbeyond.com/character/v5/character";

export { extractCharacterId } from "./utils";

/**
 * Extract the character ID from a DDB URL, fetch the JSON from the
 * undocumented character-service endpoint, and return the raw payload.
 * Character must be set to "public" on DDB for this to work.
 */
export async function fetchDDBCharacter(input: string): Promise<unknown> {
	const id = extractCharacterId(input);
	if (!id) throw new Error("Could not find a D&D Beyond character ID in that URL.");

	const url = `${CHARACTER_SERVICE_BASE}/${id}`;
	const response = await requestUrl({ url, method: "GET" });

	if (response.status !== 200) {
		if (response.status === 403 || response.status === 404) {
			throw new Error(
				`DDB returned ${response.status}. Make sure the character is set to "public" on D&D Beyond.`,
			);
		}
		throw new Error(`DDB returned HTTP ${response.status}.`);
	}

	return response.json;
}
