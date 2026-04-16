import type { App } from "obsidian";
import type { EntityIndex, IndexedEntity } from "./entity-index";

/**
 * Resolve a wikilink-like target (`"Name"` or `"Name|Display"`) to an indexed
 * entity via Obsidian's link resolution + alias table.
 */
export class EntityResolver {
	constructor(
		private app: App,
		private index: EntityIndex,
	) {}

	resolve(target: string, sourcePath = ""): IndexedEntity | undefined {
		const name = target.split("|")[0].split("#")[0].trim();
		if (!name) return undefined;
		const file = this.app.metadataCache.getFirstLinkpathDest(name, sourcePath);
		if (file) {
			const hit = this.index.getByPath(file.path);
			if (hit) return hit;
		}
		return this.index.getByAlias(name);
	}
}
