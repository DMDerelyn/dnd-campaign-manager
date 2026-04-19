import type { App, TFile } from "obsidian";

/**
 * Thin wrapper around Templater's public API. Templater is a hard dep, so
 * all methods assume it is installed and enabled; we surface a friendlier
 * error when it isn't.
 */
export class TemplaterBridge {
	constructor(private app: App) {}

	isAvailable(): boolean {
		return Boolean(this.getApi());
	}

	/**
	 * Templater's configured templates folder, if the plugin is installed and
	 * has a folder set. Returns null otherwise. Used by the entity index to
	 * skip files that aren't real entities.
	 */
	getTemplatesFolder(): string | null {
		const plug = (this.app as unknown as AppWithPlugins).plugins?.plugins?.["templater-obsidian"];
		const folder = plug?.settings?.templates_folder;
		if (typeof folder !== "string") return null;
		const trimmed = folder.trim();
		return trimmed.length > 0 ? trimmed : null;
	}

	/**
	 * Every folder that Templater treats as a source of templates. This is a
	 * superset of `getTemplatesFolder` — it also includes the parent folders
	 * of each per-folder template rule, so any file living under them is
	 * treated as a template by the entity index.
	 */
	getAllTemplateFolders(): string[] {
		const plug = (this.app as unknown as AppWithPlugins).plugins?.plugins?.["templater-obsidian"];
		const settings = plug?.settings;
		const out: string[] = [];
		if (typeof settings?.templates_folder === "string") {
			const trimmed = settings.templates_folder.trim();
			if (trimmed) out.push(trimmed);
		}
		const folderTemplates = settings?.folder_templates;
		if (Array.isArray(folderTemplates)) {
			for (const ft of folderTemplates) {
				const tpl = ft?.template;
				if (typeof tpl !== "string") continue;
				const parent = tpl.includes("/") ? tpl.slice(0, tpl.lastIndexOf("/")) : "";
				const trimmed = parent.trim();
				if (trimmed) out.push(trimmed);
			}
		}
		return out;
	}

	/** Create a file from one of our shipped templates. */
	async createFromTemplate(
		templateFile: TFile,
		folder: string,
		filename: string,
	): Promise<TFile> {
		const api = this.getApi();
		if (!api) {
			throw new Error(
				"Templater is not installed. Install and enable the Templater plugin to create campaign entities.",
			);
		}
		const folderFile = await this.ensureFolder(folder);
		return api.create_new_note_from_template(
			templateFile,
			folderFile,
			filename,
			/*open*/ true,
		);
	}

	private async ensureFolder(path: string): Promise<unknown> {
		if (!path) return undefined;
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing) return existing;
		await this.app.vault.createFolder(path);
		return this.app.vault.getAbstractFileByPath(path);
	}

	private getApi():
		| {
				create_new_note_from_template: (
					template: TFile,
					folder: unknown,
					filename: string,
					open: boolean,
				) => Promise<TFile>;
		  }
		| undefined {
		const plug = (this.app as unknown as AppWithPlugins).plugins?.plugins?.["templater-obsidian"];
		const api = plug?.templater?.create_new_note_from_template;
		if (!api) return undefined;
		return {
			create_new_note_from_template: (t, f, n, o) => api(t, f, n, o),
		};
	}
}

interface AppWithPlugins {
	plugins?: {
		plugins?: Record<string, {
			templater?: {
				create_new_note_from_template: (
					template: TFile,
					folder: unknown,
					filename: string,
					open: boolean,
				) => Promise<TFile>;
			};
			settings?: {
				templates_folder?: string;
				folder_templates?: Array<{ folder?: string; template?: string }>;
			};
		}>;
	};
}
