import type { App } from "obsidian";
import type { TemplaterBridge } from "../integrations/templater-api";

/**
 * True if `path` sits inside any of the given `folders`. Comparison is
 * case-insensitive and tolerant of leading/trailing slashes on both the
 * path and the folder, so a setting like `/Templates/` still matches a
 * path like `templates/npc.md`.
 */
export function pathIsInAnyFolder(
	path: string,
	folders: Iterable<string>,
): boolean {
	const normalizedPath = path.replace(/^\/+|\/+$/g, "").toLowerCase();
	for (const folder of folders) {
		const norm = folder.replace(/^\/+|\/+$/g, "").toLowerCase();
		if (!norm) continue;
		if (normalizedPath === norm || normalizedPath.startsWith(`${norm}/`)) {
			return true;
		}
	}
	return false;
}

/**
 * Every folder that should be treated as a template source: the built-in
 * `Templates/` folder the vault initializer creates (both cases), every
 * folder Templater treats as a template source, and the folder configured
 * by Obsidian's core Templates plugin.
 */
export function gatherTemplateFolders(
	app: App,
	templater: TemplaterBridge,
): string[] {
	const folders = new Set<string>();
	folders.add("Templates");
	folders.add("templates");
	for (const f of templater.getAllTemplateFolders()) folders.add(f);
	const core = getCoreTemplatesFolder(app);
	if (core) folders.add(core);
	return [...folders];
}

/** Convenience for the common case: check a path against all template folders. */
export function isTemplatePath(
	path: string,
	app: App,
	templater: TemplaterBridge,
): boolean {
	return pathIsInAnyFolder(path, gatherTemplateFolders(app, templater));
}

/**
 * True if `path` should be invisible to the plugin — either because it
 * sits inside a template folder (see `isTemplatePath`) or because the
 * user has configured its containing folder as an exclusion in settings.
 * This is the check to gate indexing on.
 */
export function isPathExcluded(
	path: string,
	app: App,
	templater: TemplaterBridge,
	userExcludedFolders: Iterable<string>,
): boolean {
	if (isTemplatePath(path, app, templater)) return true;
	return pathIsInAnyFolder(path, userExcludedFolders);
}

function getCoreTemplatesFolder(app: App): string | null {
	const internal = (app as unknown as {
		internalPlugins?: {
			plugins?: Record<string, {
				instance?: { options?: { folder?: string } };
			}>;
		};
	}).internalPlugins;
	const folder = internal?.plugins?.templates?.instance?.options?.folder;
	if (typeof folder !== "string") return null;
	const trimmed = folder.trim();
	return trimmed.length > 0 ? trimmed : null;
}
