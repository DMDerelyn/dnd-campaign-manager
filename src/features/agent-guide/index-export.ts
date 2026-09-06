import { AGENT_GUIDE_MARKER_PREFIX } from "./generator";

/** Minimal shape this module needs from the plugin's entity index. */
export interface IndexedEntityInput {
	path: string;
	id: string;
	kind: string;
	name: string;
	aliases: string[];
	frontmatter: Record<string, unknown>;
}

export type IndexScope = "all" | "player";

type Visibility = "gm" | "player" | "both";

export interface CampaignIndexEntity {
	id: string;
	kind: string;
	name: string;
	path: string;
	aliases: string[];
	visibility: Visibility;
	tags: string[];
	summary?: string;
	/** Frontmatter field -> the wikilink targets it points at (name or path). */
	links: Record<string, string[]>;
}

export interface CampaignIndex {
	/** Marker string; also lets the write path recognise a file it owns. */
	generator: string;
	schema_version: number;
	generated: string;
	campaign_root: string;
	scope: IndexScope;
	entity_count: number;
	entities: CampaignIndexEntity[];
}

const INDEX_SCHEMA_VERSION = 1;

const VISIBILITIES = new Set<Visibility>(["gm", "player", "both"]);

export interface BuildIndexOptions {
	campaignRoot: string;
	scope: IndexScope;
	/** Injected for deterministic output in tests. Defaults to now. */
	now?: Date;
}

/**
 * Build the machine-readable campaign index. Pure: give it the entities and it
 * returns the object to serialise.
 *
 * `player` scope omits any entity that resolves to `visibility: gm` (the
 * default when the field is absent) **and** redacts links from the surviving
 * entities that point at a gm-only entity, so a player-visible note cannot
 * disclose a secret entity's name through its `links`.
 */
export function buildCampaignIndex(
	entities: IndexedEntityInput[],
	options: BuildIndexOptions,
): CampaignIndex {
	const { campaignRoot, scope } = options;
	const now = options.now ?? new Date();

	const all = entities.map(toIndexEntity);
	const visibilityOf = buildVisibilityLookup(all);

	const mapped = all
		.filter((e) => scope !== "player" || e.visibility !== "gm")
		.map((e) =>
			scope === "player"
				? { ...e, links: redactGmLinks(e.links, visibilityOf) }
				: e,
		)
		.sort(compareEntities);

	return {
		generator: AGENT_GUIDE_MARKER_PREFIX,
		schema_version: INDEX_SCHEMA_VERSION,
		generated: now.toISOString(),
		campaign_root: campaignRoot,
		scope,
		entity_count: mapped.length,
		entities: mapped,
	};
}

export function serializeCampaignIndex(index: CampaignIndex): string {
	return JSON.stringify(index, null, 2) + "\n";
}

function toIndexEntity(e: IndexedEntityInput): CampaignIndexEntity {
	const fm = e.frontmatter;
	const entity: CampaignIndexEntity = {
		id: e.id,
		kind: e.kind,
		name: e.name,
		path: e.path,
		aliases: [...e.aliases],
		visibility: resolveVisibility(fm.visibility),
		tags: stringArray(fm.tags),
		links: linksFromFrontmatter(fm),
	};
	if (typeof fm.summary === "string" && fm.summary.trim()) {
		entity.summary = fm.summary.trim();
	}
	return entity;
}

function resolveVisibility(value: unknown): Visibility {
	return typeof value === "string" && VISIBILITIES.has(value as Visibility)
		? (value as Visibility)
		: "gm";
}

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((v): v is string => typeof v === "string");
}

const WIKILINK = /^\[\[([^\[\]]+)\]\]$/;

/**
 * Reduce a `[[target|alias]]` / `[[target#heading]]` string to just the target,
 * matching {@link EntityResolver} semantics (`split("|")[0].split("#")[0]`).
 * Returns null for a non-wikilink or an empty target.
 */
function wikilinkTarget(raw: string): string | null {
	const m = raw.match(WIKILINK);
	if (!m) return null;
	const target = m[1].split("|")[0].split("#")[0].trim();
	return target || null;
}

function linksFromFrontmatter(
	fm: Record<string, unknown>,
): Record<string, string[]> {
	const links: Record<string, string[]> = {};
	for (const [key, value] of Object.entries(fm)) {
		if (key === "aliases" || key === "tags") continue;
		const items = Array.isArray(value) ? value : [value];
		const targets: string[] = [];
		for (const item of items) {
			if (typeof item !== "string") continue;
			const target = wikilinkTarget(item);
			if (target) targets.push(target);
		}
		if (targets.length) links[key] = targets;
	}
	return links;
}

/** Map every name / file-stem / alias to a visibility, most-restrictive wins. */
function buildVisibilityLookup(
	entities: CampaignIndexEntity[],
): Map<string, Visibility> {
	const map = new Map<string, Visibility>();
	const put = (key: string, vis: Visibility) => {
		if (!key || map.get(key) === "gm") return;
		if (vis === "gm" || !map.has(key)) map.set(key, vis);
	};
	for (const e of entities) {
		put(e.name, e.visibility);
		put(fileStem(e.path), e.visibility);
		for (const alias of e.aliases) put(alias, e.visibility);
	}
	return map;
}

function redactGmLinks(
	links: Record<string, string[]>,
	visibilityOf: Map<string, Visibility>,
): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const [field, targets] of Object.entries(links)) {
		const kept = targets.filter((t) => {
			const vis = visibilityOf.get(t) ?? visibilityOf.get(fileStem(t));
			return vis !== "gm";
		});
		if (kept.length) out[field] = kept;
	}
	return out;
}

function fileStem(path: string): string {
	const slash = path.lastIndexOf("/");
	const base = slash === -1 ? path : path.slice(slash + 1);
	return base.replace(/\.md$/i, "");
}

/** Total order on (kind, name, id) — deterministic across machines/locales. */
function compareEntities(a: CampaignIndexEntity, b: CampaignIndexEntity): number {
	if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
	if (a.name !== b.name) return a.name < b.name ? -1 : 1;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
