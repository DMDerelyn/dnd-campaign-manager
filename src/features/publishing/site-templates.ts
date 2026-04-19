/**
 * Static-site theme: Player's Handbook.
 *
 * Renders entity pages to mimic an actual PHB spread — warm parchment
 * background with a subtle noise texture, two-column body flow that
 * collapses to one column on narrow viewports, red small-caps chapter
 * headings with a red flourish rule, drop caps on the first paragraph of
 * each section, and a red-sidebar "spellbook" callout block for
 * statblock-style content.
 *
 * No web fonts are loaded (offline-friendly). Typography uses a stack of
 * serifs that ship with most operating systems; small-caps headings fall
 * back gracefully.
 */

const PARCHMENT_NOISE_SVG =
	`<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>` +
	`<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>` +
	`<feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.23  0 0 0 0 0.08  0 0 0 0.08 0'/></filter>` +
	`<rect width='100%' height='100%' filter='url(#n)'/></svg>`;

const PARCHMENT_NOISE_URI =
	"data:image/svg+xml;utf8," + encodeURIComponent(PARCHMENT_NOISE_SVG);

export const SITE_CSS = `
:root {
	--bg: #efe2c2;
	--bg-alt: #e9d8a8;
	--bg-deep: #d9c08a;
	--bg-callout: #f4e9c9;
	--ink: #1a1510;
	--ink-muted: #5e4a2c;
	--rule: #b79855;
	--rule-deep: #8a6a2c;
	--accent: #58180d;
	--accent-bright: #822000;
	--accent-ink: #3a1008;
	--max-col: 880px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { background: var(--bg-deep); }
body {
	font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
	color: var(--ink);
	line-height: 1.58;
	font-size: 17px;
	background:
		radial-gradient(ellipse at center, rgba(255, 245, 215, 0.55) 0%, transparent 70%),
		url("${PARCHMENT_NOISE_URI}"),
		linear-gradient(180deg, #f4e7c6 0%, #ecdcab 55%, #e2ce96 100%);
	background-attachment: fixed;
	min-height: 100vh;
}
.phb-page {
	max-width: var(--max-col);
	margin: 0 auto;
	padding: 3.2em 2.4em 4em;
	background:
		linear-gradient(180deg, rgba(255, 248, 225, 0.35), rgba(240, 220, 170, 0.15)),
		url("${PARCHMENT_NOISE_URI}"),
		#f2e3bd;
	box-shadow:
		0 0 0 1px rgba(120, 85, 30, 0.25),
		0 10px 40px rgba(60, 35, 5, 0.25);
	position: relative;
}
.phb-page::before, .phb-page::after {
	content: "";
	position: absolute; left: 0; right: 0; height: 6px;
	background: linear-gradient(90deg, transparent, var(--rule-deep) 20%, var(--rule-deep) 80%, transparent);
	opacity: 0.55;
}
.phb-page::before { top: 1.4em; }
.phb-page::after { bottom: 1.4em; }
a {
	color: var(--accent-bright);
	text-decoration: none;
	border-bottom: 1px dotted var(--accent-bright);
}
a:hover { color: var(--accent); border-bottom-style: solid; }
h1, h2, h3, h4, h5, h6 {
	font-family: "Trajan Pro", "Cinzel", "Iowan Old Style", "Palatino Linotype", serif;
	color: var(--accent);
	letter-spacing: 0.03em;
	margin: 0.9em 0 0.35em;
	font-weight: 700;
	page-break-after: avoid;
	break-after: avoid-column;
}
h1 {
	font-size: 2.3em;
	line-height: 1.1;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	margin: 0 0 0.3em;
	padding-bottom: 0.25em;
	border-bottom: 3px double var(--accent);
	column-span: all;
}
h2 {
	font-size: 1.55em;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	border-bottom: 1px solid var(--rule);
	padding-bottom: 0.12em;
	column-span: all;
}
h3 {
	font-size: 1.2em;
	font-variant: small-caps;
	letter-spacing: 0.04em;
	color: var(--accent-ink);
}
h4 { font-size: 1.05em; font-variant: small-caps; color: var(--accent-ink); }
h5, h6 { font-size: 1em; font-style: italic; color: var(--ink-muted); }

p { margin: 0.55em 0; text-align: justify; hyphens: auto; }

.phb-body {
	column-count: 2;
	column-gap: 2.2em;
	column-rule: 1px solid rgba(137, 106, 44, 0.35);
	margin-top: 1.2em;
}
.phb-body > p:first-of-type::first-letter,
.phb-body > .phb-drop > p:first-of-type::first-letter {
	font-family: "Trajan Pro", "Cinzel", "Iowan Old Style", serif;
	font-size: 3.2em;
	line-height: 0.9;
	float: left;
	color: var(--accent);
	padding: 0.08em 0.12em 0 0;
	margin-right: 0.05em;
	font-weight: 700;
}

.phb-body table, .phb-body pre, .phb-body blockquote, .phb-body .phb-callout {
	break-inside: avoid-column;
}

.phb-meta {
	font-variant: small-caps;
	letter-spacing: 0.06em;
	color: var(--ink-muted);
	font-size: 0.85em;
	margin-bottom: 0.75em;
	column-span: all;
}
.phb-meta span + span::before { content: " \u00b7 "; color: var(--rule); }

.phb-nav {
	column-span: all;
	font-variant: small-caps;
	letter-spacing: 0.05em;
	margin-bottom: 1em;
	padding-bottom: 0.4em;
	border-bottom: 1px solid var(--rule);
}
.phb-nav a { border-bottom: none; }

.phb-flourish {
	column-span: all;
	display: flex;
	align-items: center;
	text-align: center;
	color: var(--accent);
	margin: 1.4em 0;
	font-size: 1.1em;
}
.phb-flourish::before, .phb-flourish::after {
	content: "";
	flex: 1;
	height: 1px;
	background: linear-gradient(90deg, transparent, var(--accent) 50%, transparent);
}
.phb-flourish > span { padding: 0 0.8em; }

hr {
	column-span: all;
	border: none;
	height: 1px;
	background: linear-gradient(90deg, transparent, var(--rule-deep) 15%, var(--rule-deep) 85%, transparent);
	margin: 1.4em 0;
}

pre {
	background: var(--bg-callout);
	border: 1px solid var(--rule);
	padding: 0.8em 1em;
	border-radius: 2px;
	overflow-x: auto;
	font-family: "Courier New", monospace;
	font-size: 0.9em;
	color: var(--accent-ink);
}
code {
	background: var(--bg-callout);
	border: 1px solid var(--rule);
	padding: 0 0.3em;
	border-radius: 2px;
	font-family: "Courier New", monospace;
	font-size: 0.9em;
	color: var(--accent-ink);
}
pre code { background: none; border: none; padding: 0; }

table {
	border-collapse: collapse;
	width: 100%;
	margin: 0.9em 0;
	background: var(--bg-callout);
	font-size: 0.95em;
}
th, td {
	border: 1px solid var(--rule);
	padding: 0.5em 0.8em;
	text-align: left;
}
th {
	background: var(--accent);
	color: var(--bg);
	font-variant: small-caps;
	letter-spacing: 0.06em;
	font-weight: 700;
}
tr:nth-child(even) td { background: var(--bg-alt); }

blockquote {
	border-left: 4px solid var(--accent);
	background: var(--bg-callout);
	padding: 0.7em 1em;
	margin: 0.9em 0;
	font-style: italic;
	color: var(--ink-muted);
}

.phb-callout {
	background: var(--bg-callout);
	border: 1px solid var(--rule);
	border-left: 6px solid var(--accent);
	padding: 0.9em 1em;
	margin: 1em 0;
	font-size: 0.95em;
	box-shadow: 1px 1px 4px rgba(60, 40, 10, 0.1);
}
.phb-callout > *:first-child { margin-top: 0; }
.phb-callout > h3, .phb-callout > h4 {
	color: var(--accent);
	font-variant: small-caps;
	margin: 0 0 0.4em;
	border-bottom: 1px solid var(--accent);
	padding-bottom: 0.15em;
}

ul, ol { padding-left: 1.5em; margin: 0.45em 0; }
li { margin: 0.2em 0; }
strong { color: var(--accent-ink); }
em { color: var(--ink); }

.phb-index-grid {
	column-span: all;
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
	gap: 0.8em;
	margin: 0.5em 0 1.6em;
}
.phb-card {
	background: var(--bg-callout);
	border: 1px solid var(--rule);
	border-left: 4px solid var(--accent);
	border-radius: 2px;
	padding: 0.7em 0.9em;
	box-shadow: 1px 1px 3px rgba(60, 40, 10, 0.1);
}
.phb-card a { font-weight: 700; border-bottom: none; display: block; }
.phb-card .phb-card-kind {
	font-size: 0.78em;
	color: var(--ink-muted);
	font-variant: small-caps;
	letter-spacing: 0.06em;
	margin-top: 0.15em;
}

.phb-footer {
	column-span: all;
	margin-top: 2.2em;
	padding-top: 1em;
	border-top: 1px solid var(--rule);
	text-align: center;
	color: var(--ink-muted);
	font-size: 0.8em;
	font-variant: small-caps;
	letter-spacing: 0.08em;
}

@media (max-width: 720px) {
	body { font-size: 16px; }
	.phb-page { padding: 1.8em 1.2em 2.5em; }
	.phb-body { column-count: 1; column-rule: none; }
	.phb-body > p:first-of-type::first-letter,
	.phb-body > .phb-drop > p:first-of-type::first-letter {
		font-size: 2.6em;
	}
	h1 { font-size: 1.9em; }
	h2 { font-size: 1.3em; }
}

@media print {
	html, body { background: #fff; }
	.phb-page {
		box-shadow: none;
		max-width: none;
		padding: 1em 1.5em;
	}
	a { color: var(--accent-ink); }
}
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
		cards += `<h2>${escapeHTML(pluralize(kind))}</h2><div class="phb-index-grid">`;
		for (const item of items) {
			cards +=
				`<div class="phb-card">` +
				`<a href="${escapeAttr(item.href)}">${escapeHTML(item.name)}</a>` +
				`<div class="phb-card-kind">${escapeHTML(kind)}</div>` +
				`</div>`;
		}
		cards += "</div>";
	}

	const body =
		`<h1>${escapeHTML(title)}</h1>` +
		`<div class="phb-flourish"><span>\u2756</span></div>` +
		cards +
		`<div class="phb-footer">Published from Obsidian</div>`;

	return page(title, title, body);
}

export function renderPage(
	siteTitle: string,
	pageTitle: string,
	body: string,
	fm: Record<string, unknown>,
): string {
	const metaKeys = ["kind", "race", "class", "level", "disposition", "state", "type", "rarity"];
	const metas = metaKeys
		.filter((k) => fm[k] !== undefined && fm[k] !== null && fm[k] !== "")
		.map((k) => `<span>${escapeHTML(k)}: ${escapeHTML(String(fm[k]))}</span>`);
	const metaHTML = metas.length > 0 ? `<div class="phb-meta">${metas.join("")}</div>` : "";

	const htmlBody = markdownToHTML(body);

	const content =
		`<div class="phb-nav"><a href="index.html">\u2190 ${escapeHTML(siteTitle)}</a></div>` +
		`<h1>${escapeHTML(pageTitle)}</h1>` +
		metaHTML +
		`<div class="phb-body">${htmlBody}</div>` +
		`<div class="phb-footer">${escapeHTML(siteTitle)}</div>`;

	return page(siteTitle, pageTitle, content);
}

function page(siteTitle: string, pageTitle: string, content: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(pageTitle)} \u2014 ${escapeHTML(siteTitle)}</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main class="phb-page">
${content}
</main>
</body>
</html>`;
}

function pluralize(kind: string): string {
	const lower = kind.toLowerCase();
	if (lower === "pc") return "PCs";
	if (lower === "npc") return "NPCs";
	if (lower === "faction") return "Factions";
	if (lower === "quest") return "Quests";
	if (lower === "location") return "Locations";
	if (lower === "session") return "Sessions";
	if (lower === "item") return "Items";
	if (lower.endsWith("s")) return kind[0].toUpperCase() + lower.slice(1);
	return kind[0].toUpperCase() + lower.slice(1) + "s";
}

/**
 * Minimal markdown-to-HTML for the static export. Handles headings,
 * paragraphs, bold/italic, links, lists, blockquotes, fenced code,
 * inline code, horizontal rules, and `[!callout]` block callouts that
 * render as a PHB sidebar-style box.
 */
function markdownToHTML(md: string): string {
	const lines = md.split("\n");
	const out: string[] = [];
	let inFence = false;
	let inList = false;
	let inBlockquote = false;
	let blockquoteLines: string[] = [];
	let calloutKind: string | null = null;

	const flushBlockquote = () => {
		if (!inBlockquote) return;
		if (calloutKind !== null) {
			out.push(`<div class="phb-callout phb-callout-${escapeAttr(calloutKind)}">`);
			out.push(`<h4>${escapeHTML(calloutKind)}</h4>`);
			for (const l of blockquoteLines) out.push(`<p>${inlineFormat(l)}</p>`);
			out.push("</div>");
		} else {
			out.push("<blockquote>");
			for (const l of blockquoteLines) out.push(`<p>${inlineFormat(l)}</p>`);
			out.push("</blockquote>");
		}
		inBlockquote = false;
		blockquoteLines = [];
		calloutKind = null;
	};

	for (const line of lines) {
		if (line.startsWith("```")) {
			flushBlockquote();
			if (inList) { out.push("</ul>"); inList = false; }
			if (inFence) {
				out.push("</code></pre>");
				inFence = false;
			} else {
				out.push("<pre><code>");
				inFence = true;
			}
			continue;
		}
		if (inFence) {
			out.push(escapeHTML(line));
			continue;
		}

		const bqMatch = line.match(/^>\s?(.*)$/);
		if (bqMatch) {
			if (inList) { out.push("</ul>"); inList = false; }
			const inner = bqMatch[1];
			if (!inBlockquote) {
				inBlockquote = true;
				const calloutMatch = inner.match(/^\[!([A-Za-z][A-Za-z0-9_-]*)\]\s*(.*)$/);
				if (calloutMatch) {
					calloutKind = calloutMatch[1].toLowerCase();
					if (calloutMatch[2]) blockquoteLines.push(calloutMatch[2]);
				} else if (inner) {
					blockquoteLines.push(inner);
				}
			} else if (inner) {
				blockquoteLines.push(inner);
			}
			continue;
		}

		flushBlockquote();

		if (/^#{1,6}\s/.test(line)) {
			if (inList) { out.push("</ul>"); inList = false; }
			const level = line.match(/^(#{1,6})\s/)![1].length;
			const text = line.replace(/^#{1,6}\s+/, "");
			out.push(`<h${level}>${inlineFormat(text)}</h${level}>`);
			continue;
		}

		if (/^---+$/.test(line)) {
			if (inList) { out.push("</ul>"); inList = false; }
			out.push("<hr>");
			continue;
		}

		if (/^[-*]\s/.test(line)) {
			if (!inList) { out.push("<ul>"); inList = true; }
			out.push(`<li>${inlineFormat(line.replace(/^[-*]\s+/, ""))}</li>`);
			continue;
		}

		if (/^\d+\.\s/.test(line)) {
			if (!inList) { out.push("<ul>"); inList = true; }
			out.push(`<li>${inlineFormat(line.replace(/^\d+\.\s+/, ""))}</li>`);
			continue;
		}

		if (inList) { out.push("</ul>"); inList = false; }

		if (line.trim() === "") continue;

		out.push(`<p>${inlineFormat(line)}</p>`);
	}

	if (inBlockquote) flushBlockquote();
	if (inList) out.push("</ul>");
	if (inFence) out.push("</code></pre>");

	return out.join("\n");
}

function inlineFormat(text: string): string {
	let t = escapeHTML(text);
	t = t.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_m, target, display) => {
		const slug = String(target).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
	return escapeHTML(s);
}
