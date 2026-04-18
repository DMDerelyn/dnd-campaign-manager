export interface TimelineEntry {
	line: string;
	text: string;
	timestamp?: string;
}

/**
 * Pull the `## Session log` section from a session note and extract each
 * bullet. Supports both timestamped entries ("- **2026-04-16 19:30** —
 * text") and plain event lines ("- Event: text"). Returns entries in the
 * order they appear in the log.
 */
export function extractSessionLog(content: string): TimelineEntry[] {
	const headerMatch = content.match(/^## Session log\b/im);
	if (!headerMatch || headerMatch.index === undefined) return [];
	const sectionStart = headerMatch.index + headerMatch[0].length;
	const rest = content.slice(sectionStart);
	const boundary = rest.match(/\n(?:#{1,2} |%%gm-only%%)/);
	const end = boundary && boundary.index !== undefined
		? sectionStart + boundary.index
		: content.length;
	const section = content.slice(sectionStart, end);

	const out: TimelineEntry[] = [];
	for (const rawLine of section.split("\n")) {
		const match = rawLine.match(/^\s*-\s+(.+?)\s*$/);
		if (!match) continue;
		const body = match[1];
		const tsMatch = body.match(/^\*\*([^*]+?)\*\*\s*\u2014\s*(.+)$/);
		if (tsMatch) {
			out.push({
				line: rawLine.trim(),
				timestamp: tsMatch[1].trim(),
				text: tsMatch[2].trim(),
			});
		} else {
			out.push({ line: rawLine.trim(), text: body });
		}
	}
	return out;
}
