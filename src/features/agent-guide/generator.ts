import { SchemaByKind, type EntityKind } from "../../schemas";
import { describeObjectSchema, type FieldDescriptor } from "./schema-describe";

export interface AgentGuideInput {
	/** Vault-relative campaign root, e.g. `Campaigns/My Campaign`. */
	campaignRoot: string;
	/** Entity-kind to subfolder-name map, from plugin settings. */
	folders: Record<EntityKind, string>;
	/** Whether the Dataview community plugin is installed and enabled. */
	dataviewAvailable: boolean;
}

/** Bump when the guide's structure changes so stale files can be detected. */
const GUIDE_VERSION = 1;

/**
 * Version-agnostic prefix of the HTML comment every generated file carries.
 * The write path uses it to tell a plugin-owned file apart from a hand-authored
 * one, so it must never contain a version number.
 */
export const AGENT_GUIDE_MARKER_PREFIX =
	"generated-by: dnd-campaign-manager agent-guide";

const KIND_CONTENTS: Record<EntityKind, string> = {
	pc: "Player characters.",
	npc: "Non-player characters the party can meet.",
	quest: "Quests and adventure threads, with state and objectives.",
	location: "Places: regions, settlements, dungeons, points of interest.",
	session: "Per-session prep and play logs.",
	faction: "Organizations, their goals, and their standing.",
	item: "Notable items, treasure, and magic items.",
};

const BASE_FIELDS = new Set([
	"id",
	"kind",
	"aliases",
	"visibility",
	"tags",
	"created",
	"updated",
	"schema_version",
	"canonical_name",
	"summary",
]);

export function agentGuideMarker(): string {
	return `<!-- ${AGENT_GUIDE_MARKER_PREFIX} v${GUIDE_VERSION} -->`;
}

/**
 * Render the agent guide markdown for a campaign. Pure: no vault or app access,
 * so it is cheap to unit-test and safe to call from anywhere.
 *
 * Throws if schema introspection returns implausibly little — that means the
 * installed `zod` is incompatible with {@link describeObjectSchema} and the
 * guide would otherwise be written hollow (and overwrite a good prior copy).
 */
export function buildAgentGuide(input: AgentGuideInput): string {
	const { campaignRoot, dataviewAvailable } = input;
	const kinds = Object.keys(SchemaByKind) as EntityKind[];
	const folder = (kind: EntityKind) => input.folders[kind] || kind;

	const introspected = new Map(
		kinds.map((k) => [k, describeObjectSchema(SchemaByKind[k])] as const),
	);
	assertIntrospectionSane(introspected);

	const out: string[] = [];
	const p = (line = "") => out.push(line);

	p("# Campaign knowledge base — agent guide");
	p();
	p(agentGuideMarker());
	p('<!-- Regenerate with the "Generate agent guide" command. Do not edit by hand. -->');
	p();
	p("This vault holds a single tabletop RPG campaign as linked markdown notes.");
	p("Each note is a typed *entity* with a YAML frontmatter block at the top of");
	p("the file. This guide describes the layout so an automated assistant can");
	p("search and read the campaign reliably.");
	p();

	p("## Folder layout");
	p();
	p(`Campaign root: \`${campaignRoot}\``);
	p();
	p("| Kind | Folder | Contents |");
	p("|---|---|---|");
	for (const kind of kinds) {
		p(
			`| \`${kind}\` | \`${escapeCell(campaignRoot)}/${escapeCell(folder(kind))}\` | ${KIND_CONTENTS[kind]} |`,
		);
	}
	p();
	p("Notes outside these folders (campaign overview, `Secrets.md`, prep prose)");
	p("are plain markdown with no `kind` field.");
	p();

	p("## Frontmatter");
	p();
	p("Every entity carries these base fields:");
	p();
	p(fieldTable(baseFields(introspected.get("npc") ?? [])));
	p();
	p("`kind` is set to the entity type and is what marks a note as an entity.");
	p("`visibility` controls who may see the note: `gm` (secret), `player` (safe");
	p("to show players), or `both`. **It defaults to `gm` when the field is");
	p("absent** — see \"What is hidden from players\" below.");
	p();

	for (const kind of kinds) {
		const specific = (introspected.get(kind) ?? []).filter(
			(f) => !BASE_FIELDS.has(f.name),
		);
		p(`### \`${kind}\``);
		p();
		p(specific.length ? fieldTable(specific) : "No fields beyond the base set.");
		p();
	}

	p("## Cross-references");
	p();
	p("Entities link to each other with `[[Wikilinks]]`. A link `[[Volo]]` resolves");
	p("to a file named `Volo.md` anywhere under the campaign root, or to an entity");
	p("whose `aliases` list contains `Volo`.");
	p();
	const linkFields = wikilinkFieldNames(introspected);
	p(
		linkFields.length
			? `Link-bearing frontmatter fields: ${linkFields.map((n) => `\`${n}\``).join(", ")}. Follow these to walk the campaign graph.`
			: "Follow wikilink-typed frontmatter fields to walk the campaign graph.",
	);
	p();

	p("## What is hidden from players");
	p();
	p("A note is GM-only unless it is explicitly marked otherwise. Never surface");
	p("any of the following in player-facing output:");
	p();
	p("- Any entity **without** `visibility: player` or `visibility: both` — a");
	p("  missing `visibility` field means `gm`.");
	p("- Body text between `%%gm-only%%` and `%%/gm-only%%` markers.");
	p('- Sections titled "Secrets", "GM Notes", "GM Only", or similar.');
	p("- `Secrets.md` at the campaign root — a running list of clues written as");
	p("  task-list items (`- [ ]` unrevealed, `- [x]` revealed).");
	p();

	p("## Search recipes");
	p();
	p("If `campaign-index.json` exists at the campaign root, read it first: it is a");
	p("generated list of every entity (id, kind, name, path, aliases, visibility,");
	p("tags, links) and is faster than scanning notes. Regenerate it with the");
	p('"Export campaign index" command.');
	p();
	p("Exact, structural lookups with ripgrep:");
	p();
	p("```sh");
	p("# every faction note");
	p(`rg -l '^kind: faction$' ${shQuote(campaignRoot)}`);
	p("# find an entity by name or alias");
	p(`rg -n 'Volothamp' ${shQuote(campaignRoot)}`);
	p("# notes safe to show players — everything else is GM-only");
	p(`rg -l '^visibility: *\"?(player|both)\"?$' ${shQuote(campaignRoot)}`);
	p("# quests, with their state (a quest with no 'state' is 'hook' = not started)");
	p(`rg -n '^state:' ${shQuote(`${campaignRoot}/${folder("quest")}`)}`);
	p("```");
	p();
	if (dataviewAvailable) {
		p("Structured queries with the Dataview plugin:");
		p();
		p("````md");
		p("```dataview");
		p("TABLE disposition, location, status");
		p(`FROM ${dataviewString(`${campaignRoot}/${folder("npc")}`)}`);
		p('WHERE kind = "npc"');
		p("```");
		p("````");
		p();
	}

	p("## Ground rules for the assistant");
	p();
	p("- Frontmatter is the source of truth for structured fields; the prose body");
	p("  holds description and story.");
	p("- `[RESEARCH GAP]` and `TODO` markers are intentional. Do not invent");
	p("  replacement facts.");
	p("- When asked for player-facing text, apply the hiding rules above and state");
	p("  what you withheld.");
	p("- Cite entities by file path so the reader can open them.");
	p();

	return out.join("\n") + "\n";
}

/**
 * A short companion file that points a coding assistant at the full guide
 * instead of duplicating it.
 */
export function buildAssistantPointer(guideFilename: string): string {
	return [
		"# Campaign knowledge base",
		"",
		agentGuideMarker(),
		"",
		`See [${guideFilename}](${guideFilename}) for how this vault is laid out`,
		"and how to search it.",
		"",
	].join("\n");
}

function assertIntrospectionSane(
	introspected: Map<EntityKind, FieldDescriptor[]>,
): void {
	for (const [kind, fields] of introspected) {
		if (fields.length < BASE_FIELDS.size - 1) {
			throw new Error(
				`Schema introspection for "${kind}" returned only ${fields.length} fields. ` +
					"The installed 'zod' version is likely incompatible with the agent-guide " +
					"generator; the guide was not written.",
			);
		}
	}
}

function wikilinkFieldNames(
	introspected: Map<EntityKind, FieldDescriptor[]>,
): string[] {
	const names = new Set<string>();
	for (const fields of introspected.values()) {
		for (const f of fields) {
			if (f.type.startsWith("wikilink")) names.add(f.name);
		}
	}
	return [...names].sort();
}

function baseFields(fields: FieldDescriptor[]): FieldDescriptor[] {
	return fields.filter((f) => BASE_FIELDS.has(f.name) && f.name !== "kind");
}

function fieldTable(fields: FieldDescriptor[]): string {
	const rows = ["| Field | Type | Required | Default |", "|---|---|---|---|"];
	for (const f of fields) {
		const type = escapeCell(f.type);
		const dflt = f.default !== undefined ? `\`${escapeCell(f.default)}\`` : "—";
		rows.push(`| \`${f.name}\` | ${type} | ${f.required ? "yes" : "no"} | ${dflt} |`);
	}
	return rows.join("\n");
}

/** Keep literal pipes from splitting a markdown table row into extra columns. */
function escapeCell(value: string): string {
	return value.replace(/\|/g, "\\|");
}

/** POSIX single-quote a value for safe literal use in an `sh` recipe. */
function shQuote(value: string): string {
	return `'${value.replace(/'/g, "'\\''")}'`;
}

/** Double-quote a path for a Dataview `FROM` clause. */
function dataviewString(value: string): string {
	return JSON.stringify(value);
}
