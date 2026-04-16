export const SITE_CSS = `
:root { --bg: #1a1a2e; --fg: #e8e8e8; --accent: #4a90d9; --border: #333; --card-bg: #16213e; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.6; padding: 2em; max-width: 900px; margin: 0 auto; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
h1, h2, h3, h4 { margin: 0.75em 0 0.25em; }
h1 { border-bottom: 2px solid var(--accent); padding-bottom: 0.3em; }
.nav { margin-bottom: 2em; }
.nav a { margin-right: 1em; }
.entity-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1em; margin: 0.5em 0; }
.entity-meta { font-size: 0.85em; color: #999; }
.entity-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1em; margin: 1em 0; }
pre { background: var(--card-bg); padding: 1em; border-radius: 6px; overflow-x: auto; }
code { background: var(--card-bg); padding: 0.1em 0.3em; border-radius: 3px; }
table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
th, td { border: 1px solid var(--border); padding: 0.4em 0.8em; text-align: left; }
th { background: var(--card-bg); }
blockquote { border-left: 3px solid var(--accent); padding-left: 1em; color: #ccc; margin: 0.5em 0; }
ul, ol { padding-left: 1.5em; }
li { margin: 0.2em 0; }
`;

export function renderIndex(
	title: string,
	entries: { href: string; name: string; kind: string }[],
): string {
	const grouped = new Map<string, typeof entries>();
	for (const e of entries) {
		const bucket = grouped.get(e.kind) ?? [];
		bucket.push(e);
		grouped.set(e.kind, bucket);
	}

	let cards = "";
	for (const [kind, items] of grouped) {
		cards += `<h2>${escapeHTML(kind.toUpperCase())}S</h2><div class="entity-list">`;
		for (const item of items) {
			cards += `<div class="entity-card"><a href="${escapeAttr(item.href)}">${escapeHTML(item.name)}</a><div class="entity-meta">${escapeHTML(kind)}</div></div>`;
		}
		cards += "</div>";
	}

	return page(title, title, `<h1>${escapeHTML(title)}</h1>${cards}`);
}

export function renderPage(
	siteTitle: string,
	pageTitle: string,
	body: string,
	fm: Record<string, unknown>,
): string {
	let metaHTML = "";
	const metaKeys = ["kind", "race", "class", "level", "disposition", "state", "type", "rarity"];
	const metas = metaKeys
		.filter((k) => fm[k] !== undefined && fm[k] !== null && fm[k] !== "")
		.map((k) => `<span class="entity-meta">${escapeHTML(k)}: ${escapeHTML(String(fm[k]))}</span>`);
	if (metas.length > 0) metaHTML = `<div style="margin-bottom:1em">${metas.join(" &middot; ")}</div>`;

	const htmlBody = markdownToHTML(body);

	return page(
		siteTitle,
		pageTitle,
		`<div class="nav"><a href="index.html">&larr; ${escapeHTML(siteTitle)}</a></div><h1>${escapeHTML(pageTitle)}</h1>${metaHTML}${htmlBody}`,
	);
}

function page(siteTitle: string, pageTitle: string, content: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(pageTitle)} — ${escapeHTML(siteTitle)}</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
${content}
</body>
</html>`;
}

/**
 * Minimal markdown-to-HTML for the static export. Handles headings,
 * paragraphs, bold, italic, links, lists, blockquotes, code fences,
 * inline code, and horizontal rules. Not a full parser — just enough
 * for clean campaign notes.
 */
function markdownToHTML(md: string): string {
	const lines = md.split("\n");
	const out: string[] = [];
	let inFence = false;
	let inList = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.startsWith("```")) {
			if (inFence) {
				out.push("</code></pre>");
				inFence = false;
			} else {
				if (inList) { out.push("</ul>"); inList = false; }
				out.push("<pre><code>");
				inFence = true;
			}
			continue;
		}
		if (inFence) {
			out.push(escapeHTML(line));
			continue;
		}

		if (line.match(/^#{1,6}\s/)) {
			if (inList) { out.push("</ul>"); inList = false; }
			const level = line.match(/^(#{1,6})\s/)![1].length;
			const text = line.replace(/^#{1,6}\s+/, "");
			out.push(`<h${level}>${inlineFormat(text)}</h${level}>`);
			continue;
		}

		if (line.match(/^---+$/)) {
			if (inList) { out.push("</ul>"); inList = false; }
			out.push("<hr>");
			continue;
		}

		if (line.match(/^>\s?/)) {
			if (inList) { out.push("</ul>"); inList = false; }
			const text = line.replace(/^>\s?/, "");
			out.push(`<blockquote>${inlineFormat(text)}</blockquote>`);
			continue;
		}

		if (line.match(/^[-*]\s/)) {
			if (!inList) { out.push("<ul>"); inList = true; }
			const text = line.replace(/^[-*]\s+/, "");
			out.push(`<li>${inlineFormat(text)}</li>`);
			continue;
		}

		if (line.match(/^\d+\.\s/)) {
			if (!inList) { out.push("<ul>"); inList = true; }
			const text = line.replace(/^\d+\.\s+/, "");
			out.push(`<li>${inlineFormat(text)}</li>`);
			continue;
		}

		if (inList) { out.push("</ul>"); inList = false; }

		if (line.trim() === "") {
			continue;
		}

		out.push(`<p>${inlineFormat(line)}</p>`);
	}

	if (inList) out.push("</ul>");
	if (inFence) out.push("</code></pre>");

	return out.join("\n");
}

function inlineFormat(text: string): string {
	let t = escapeHTML(text);
	t = t.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_, target, display) => {
		const slug = target.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
		return `<a href="${slug}.html">${display ?? target}</a>`;
	});
	t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
	t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");
	t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
	return t;
}

function escapeHTML(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
	return escapeHTML(s);
}
