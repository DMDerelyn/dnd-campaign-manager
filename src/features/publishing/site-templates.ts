/**
 * Static-site theme: Player's Handbook — parchment background, dark red
 * accents, serif typography. Mirrors the plugin's in-app PHB theme so the
 * exported site feels like the source material.
 */
export const SITE_CSS = `
:root {
	--bg: #f4e4c1;
	--bg-card: #ecd9a8;
	--bg-header: #e8d5a3;
	--fg: #1a1a1a;
	--fg-muted: #5c4a2a;
	--accent: #58180d;
	--accent-bright: #9b2820;
	--border: #c9ad6a;
	--border-strong: #a38651;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
	font-family: "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
	background: var(--bg);
	background-image: linear-gradient(180deg, #f6e7c5 0%, #f4e4c1 100%);
	color: var(--fg);
	line-height: 1.65;
	padding: 2.5em 2em 4em;
	max-width: 760px;
	margin: 0 auto;
}
a { color: var(--accent-bright); text-decoration: none; border-bottom: 1px dotted var(--accent-bright); }
a:hover { color: var(--accent); border-bottom-style: solid; }
h1, h2, h3, h4 {
	font-family: "Trajan Pro", "Cinzel", "Palatino Linotype", serif;
	font-weight: 700;
	color: var(--accent);
	margin: 1.1em 0 0.35em;
	letter-spacing: 0.02em;
}
h1 {
	font-size: 2em;
	border-bottom: 3px double var(--border-strong);
	padding-bottom: 0.25em;
	margin-top: 0;
}
h2 {
	font-size: 1.45em;
	border-bottom: 1px solid var(--border);
	padding-bottom: 0.15em;
}
h3 { font-size: 1.2em; font-variant: small-caps; }
p { margin: 0.6em 0; }
hr { border: none; border-top: 1px solid var(--border-strong); margin: 1.5em 0; }
.nav {
	margin-bottom: 2em;
	padding-bottom: 0.75em;
	border-bottom: 1px solid var(--border);
	font-variant: small-caps;
	letter-spacing: 0.05em;
}
.nav a { margin-right: 1em; border-bottom: none; }
.entity-card {
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-left: 4px solid var(--accent);
	border-radius: 3px;
	padding: 0.9em 1em;
	margin: 0.5em 0;
	box-shadow: 1px 1px 3px rgba(60, 40, 10, 0.1);
}
.entity-card a { font-weight: 600; border-bottom: none; }
.entity-meta {
	font-size: 0.82em;
	color: var(--fg-muted);
	font-variant: small-caps;
	letter-spacing: 0.04em;
}
.entity-list {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
	gap: 0.9em;
	margin: 1em 0;
}
pre {
	background: var(--bg-header);
	border: 1px solid var(--border);
	padding: 0.8em 1em;
	border-radius: 3px;
	overflow-x: auto;
	font-family: "Courier New", monospace;
	font-size: 0.92em;
}
code {
	background: var(--bg-header);
	border: 1px solid var(--border);
	padding: 0.05em 0.35em;
	border-radius: 2px;
	font-family: "Courier New", monospace;
	font-size: 0.92em;
}
pre code { background: none; border: none; padding: 0; }
table {
	border-collapse: collapse;
	width: 100%;
	margin: 0.8em 0;
	background: var(--bg-card);
}
th, td {
	border: 1px solid var(--border);
	padding: 0.5em 0.9em;
	text-align: left;
}
th {
	background: var(--accent);
	color: var(--bg);
	font-variant: small-caps;
	letter-spacing: 0.05em;
}
tr:nth-child(even) td { background: var(--bg-header); }
blockquote {
	border-left: 3px solid var(--accent);
	background: var(--bg-card);
	padding: 0.6em 1em;
	margin: 0.8em 0;
	font-style: italic;
	color: var(--fg-muted);
}
ul, ol { padding-left: 1.6em; margin: 0.5em 0; }
li { margin: 0.25em 0; }
strong { color: var(--accent); }
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
