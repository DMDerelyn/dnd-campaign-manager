const DDB_CHARACTER_URL_RE = /dndbeyond\.com\/characters\/(\d+)/;

export function extractCharacterId(input: string): string | null {
	const match = input.match(DDB_CHARACTER_URL_RE);
	if (match) return match[1];
	if (/^\d+$/.test(input.trim())) return input.trim();
	return null;
}
