import type { App, TFile } from "obsidian";
import type { EntityIndex } from "../../core/entity-index";
import { stripGMContent, stripGMFrontmatter } from "./gm-stripper";
import { renderPage, renderIndex, SITE_CSS } from "./site-templates";

export interface ExportOptions {
	outputPath: string;
	title: string;
	includeGM: boolean;
}

export interface ExportResult {
	filesExported: number;
	filesSkipped: number;
}

export async function exportStaticSite(
	app: App,
	index: EntityIndex,
	options: ExportOptions,
): Promise<ExportResult> {
	const { outputPath, title, includeGM } = options;
	await ensureDir(app, outputPath);

	const allFiles = app.vault.getMarkdownFiles();
	const exportable: { file: TFile; fm: Record<string, unknown>; body: string }[] = [];
	let skipped = 0;

	for (const file of allFiles) {
		const cache = app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (!fm || typeof fm.kind !== "string") continue;

		const vis = (fm.visibility as string) ?? "gm";
		if (!includeGM && vis === "gm") {
			skipped++;
			continue;
		}

		let body = await app.vault.read(file);
		const fmBlock = body.match(/^---\n[\s\S]*?\n---\n/);
		if (fmBlock) body = body.slice(fmBlock[0].length);

		if (!includeGM) {
			body = stripGMContent(body);
		}

		const cleanFM = includeGM ? fm : stripGMFrontmatter(fm as Record<string, unknown>);
		exportable.push({ file, fm: cleanFM, body });
	}

	await writeFile(app, `${outputPath}/styles.css`, SITE_CSS);

	const indexHTML = renderIndex(
		title,
		exportable.map((e) => ({
			href: `${slugify(e.file.basename)}.html`,
			name: e.file.basename,
			kind: String(e.fm.kind ?? ""),
		})),
	);
	await writeFile(app, `${outputPath}/index.html`, indexHTML);

	for (const entry of exportable) {
		const slug = slugify(entry.file.basename);
		const html = renderPage(title, entry.file.basename, entry.body, entry.fm);
		await writeFile(app, `${outputPath}/${slug}.html`, html);
	}

	return { filesExported: exportable.length, filesSkipped: skipped };
}

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

async function ensureDir(app: App, path: string): Promise<void> {
	const existing = app.vault.getAbstractFileByPath(path);
	if (!existing) await app.vault.createFolder(path);
}

async function writeFile(app: App, path: string, content: string): Promise<void> {
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing) {
		await app.vault.modify(existing as TFile, content);
	} else {
		await app.vault.create(path, content);
	}
}
