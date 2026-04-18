export interface SecretEntry {
	text: string;
	revealed: boolean;
	revealedNote?: string;
	lineIndex: number;
}

export function parseSecrets(content: string): SecretEntry[] {
	const lines = content.split("\n");
	const out: SecretEntry[] = [];
	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(/^\s*-\s*\[([ xX])\]\s*(.+?)\s*$/);
		if (!match) continue;
		const revealed = match[1].toLowerCase() === "x";
		const rest = match[2];
		const dashIdx = rest.lastIndexOf(" \u2014 ");
		if (revealed && dashIdx !== -1) {
			out.push({
				text: rest.slice(0, dashIdx),
				revealed: true,
				revealedNote: rest.slice(dashIdx + 3),
				lineIndex: i,
			});
		} else {
			out.push({ text: rest, revealed, lineIndex: i });
		}
	}
	return out;
}
