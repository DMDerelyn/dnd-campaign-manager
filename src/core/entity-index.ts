import type { App, EventRef } from "obsidian";
import { TFile } from "obsidian";
import type { EntityKind } from "../schemas";
import { validateFrontmatter, type ValidationIssue } from "../schemas";

export interface IndexedEntity {
	path: string;
	id: string;
	kind: EntityKind;
	name: string;
	aliases: string[];
	frontmatter: Record<string, unknown>;
}

export interface FileDiagnostics {
	path: string;
	issues: ValidationIssue[];
}

type ChangeListener = () => void;

/**
 * In-memory typed graph of campaign entities. Rebuilt from MetadataCache.
 * O(1) lookup by id, path, alias; O(n) scan by kind.
 */
export class EntityIndex {
	private byPath = new Map<string, IndexedEntity>();
	private byId = new Map<string, IndexedEntity>();
	private byAlias = new Map<string, IndexedEntity>();
	private diagnostics = new Map<string, FileDiagnostics>();
	private listeners = new Set<ChangeListener>();

	constructor(
		private app: App,
		private onDiagnosticsChange?: () => void,
		private isExcluded: (path: string) => boolean = () => false,
	) {}

	/** Rebuild the entire index from the vault. Call once at startup. */
	rebuildAll(): void {
		this.byPath.clear();
		this.byId.clear();
		this.byAlias.clear();
		this.diagnostics.clear();
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			if (this.isExcluded(file.path)) continue;
			this.indexFile(file, /*notify*/ false);
		}
		this.notify();
	}

	/** Index or re-index a single file based on its current MetadataCache state. */
	indexFile(file: TFile, notify = true): void {
		const prev = this.byPath.get(file.path);
		if (this.isExcluded(file.path)) {
			if (prev) this.removeFromIndex(prev);
			if (this.diagnostics.delete(file.path)) this.onDiagnosticsChange?.();
			if (prev && notify) this.notify();
			return;
		}
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (prev) this.removeFromIndex(prev);
		this.diagnostics.delete(file.path);

		if (!fm || typeof fm.kind !== "string") {
			if (prev) this.notify();
			return;
		}

		const validation = validateFrontmatter(fm);
		if (!validation.ok) {
			this.diagnostics.set(file.path, {
				path: file.path,
				issues: validation.issues,
			});
			this.onDiagnosticsChange?.();
			return;
		}

		const data = validation.data;
		const name = file.basename;
		const aliases = [name, ...(data.aliases ?? [])];
		const entry: IndexedEntity = {
			path: file.path,
			id: data.id,
			kind: data.kind,
			name,
			aliases,
			frontmatter: fm,
		};
		this.addToIndex(entry);
		if (notify) this.notify();
		this.onDiagnosticsChange?.();
	}

	removeFile(path: string): void {
		const prev = this.byPath.get(path);
		if (prev) {
			this.removeFromIndex(prev);
			this.notify();
		}
		if (this.diagnostics.delete(path)) this.onDiagnosticsChange?.();
	}

	renameFile(file: TFile, oldPath: string): void {
		const prev = this.byPath.get(oldPath);
		if (prev) this.removeFromIndex(prev);
		this.diagnostics.delete(oldPath);
		this.indexFile(file);
	}

	getByPath(path: string): IndexedEntity | undefined {
		return this.byPath.get(path);
	}
	getById(id: string): IndexedEntity | undefined {
		return this.byId.get(id);
	}
	getByAlias(alias: string): IndexedEntity | undefined {
		return this.byAlias.get(alias.toLowerCase());
	}

	/** All entities of a given kind. */
	byKind(kind: EntityKind): IndexedEntity[] {
		const out: IndexedEntity[] = [];
		for (const e of this.byPath.values()) if (e.kind === kind) out.push(e);
		return out;
	}

	/** All currently indexed aliases, sorted longest-first for trie-style matching. */
	allAliases(): { alias: string; entity: IndexedEntity }[] {
		const out: { alias: string; entity: IndexedEntity }[] = [];
		for (const entity of this.byPath.values()) {
			for (const alias of entity.aliases) out.push({ alias, entity });
		}
		out.sort((a, b) => b.alias.length - a.alias.length);
		return out;
	}

	allDiagnostics(): FileDiagnostics[] {
		return [...this.diagnostics.values()];
	}

	onChange(fn: ChangeListener): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private notify(): void {
		for (const fn of this.listeners) fn();
	}

	private addToIndex(entry: IndexedEntity): void {
		this.byPath.set(entry.path, entry);
		this.byId.set(entry.id, entry);
		for (const alias of entry.aliases) {
			this.byAlias.set(alias.toLowerCase(), entry);
		}
	}

	private removeFromIndex(entry: IndexedEntity): void {
		this.byPath.delete(entry.path);
		if (this.byId.get(entry.id) === entry) this.byId.delete(entry.id);
		for (const alias of entry.aliases) {
			const key = alias.toLowerCase();
			if (this.byAlias.get(key) === entry) this.byAlias.delete(key);
		}
	}
}

export function wireEntityIndex(app: App, index: EntityIndex): EventRef[] {
	return [
		app.metadataCache.on("changed", (file) => index.indexFile(file)),
		app.metadataCache.on("deleted", (file) => index.removeFile(file.path)),
		app.vault.on("rename", (file, oldPath) => {
			if (file instanceof TFile) index.renameFile(file, oldPath);
		}),
	];
}
