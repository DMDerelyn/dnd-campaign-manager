/**
 * Strip GM-only fences from markdown content. Two formats:
 *
 * 1. Block fence:
 *    %%gm-only%%
 *    secret stuff
 *    %%/gm-only%%
 *
 * 2. Inline front-matter fields with `visibility: gm` (handled at file level,
 *    not here — the exporter skips entire files with visibility=gm).
 *
 * Also strips frontmatter `secrets: [...]` arrays and any field explicitly
 * listed in `secretFields`.
 */

const GM_FENCE_RE = /%%gm-only%%[\s\S]*?%%\/gm-only%%/g;

export function stripGMContent(markdown: string): string {
	return markdown.replace(GM_FENCE_RE, "").trim();
}

const SECRET_FIELDS = ["secrets", "summary_gm"];

export function stripGMFrontmatter(
	frontmatter: Record<string, unknown>,
): Record<string, unknown> {
	const cleaned: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(frontmatter)) {
		if (SECRET_FIELDS.includes(key)) continue;
		if (key === "visibility") {
			cleaned[key] = value;
			continue;
		}
		cleaned[key] = value;
	}
	return cleaned;
}
