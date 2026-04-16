import { normalizeDDBCharacter, type NormalizedPC } from "./normalize";

/**
 * Parse a Beyond20-exported JSON string (or a raw DDB JSON blob the user
 * pasted) and normalize into our PC schema.
 */
export function parseDDBJson(jsonText: string): NormalizedPC {
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch {
		throw new Error("Invalid JSON. Please paste the full character JSON from Beyond20 or DDB.");
	}
	return normalizeDDBCharacter(parsed);
}
