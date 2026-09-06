import { test } from "node:test";
import assert from "node:assert/strict";
import {
	AGENT_GUIDE_MARKER_PREFIX,
	buildAgentGuide,
	buildAssistantPointer,
	agentGuideMarker,
	type AgentGuideInput,
} from "./generator";
import { SchemaByKind } from "../../schemas";
import { describeObjectSchema } from "./schema-describe";

const FOLDERS: AgentGuideInput["folders"] = {
	pc: "PCs",
	npc: "NPCs",
	quest: "Quests",
	location: "Locations",
	session: "Sessions",
	faction: "Factions",
	item: "Items",
};

function build(overrides: Partial<AgentGuideInput> = {}): string {
	return buildAgentGuide({
		campaignRoot: "Campaigns/Test Vale",
		folders: FOLDERS,
		dataviewAvailable: false,
		...overrides,
	});
}

test("includes the core sections", () => {
	const md = build();
	for (const heading of [
		"# Campaign knowledge base — agent guide",
		"## Folder layout",
		"## Frontmatter",
		"## Cross-references",
		"## What is hidden from players",
		"## Search recipes",
		"## Ground rules for the assistant",
	]) {
		assert.ok(md.includes(heading), `missing section: ${heading}`);
	}
});

test("carries the generated-by marker for staleness detection", () => {
	assert.ok(build().includes(agentGuideMarker()));
});

test("uses the configured campaign root and folder names", () => {
	const md = build({
		campaignRoot: "Worlds/Eberron",
		folders: { ...FOLDERS, faction: "Orgs" },
	});
	assert.ok(md.includes("Campaign root: `Worlds/Eberron`"));
	assert.ok(md.includes("`Worlds/Eberron/Orgs`"));
	assert.ok(md.includes("rg -l '^kind: faction$' 'Worlds/Eberron'"));
});

test("lists every entity kind with a schema heading", () => {
	const md = build();
	for (const kind of Object.keys(SchemaByKind)) {
		assert.ok(md.includes(`### \`${kind}\``), `missing kind heading: ${kind}`);
	}
});

test("documents both hiding mechanisms and the gm-by-default rule", () => {
	const md = build();
	assert.ok(md.includes("%%gm-only%%"));
	assert.ok(md.includes("Secrets.md"));
	// A note with no visibility field must be treated as gm.
	assert.match(md, /missing `visibility` field means `gm`/);
	// The player-safe recipe lists player/both notes, not gm ones.
	assert.ok(md.includes("visibility: *\"?(player|both)\"?"));
	assert.ok(!md.includes("rg -l '^visibility: gm$'"));
});

test("marker prefix is version-agnostic and embedded in the marker", () => {
	assert.ok(!/\d/.test(AGENT_GUIDE_MARKER_PREFIX));
	assert.ok(agentGuideMarker().includes(AGENT_GUIDE_MARKER_PREFIX));
	assert.ok(build().includes(AGENT_GUIDE_MARKER_PREFIX));
});

test("shell recipes single-quote-escape the campaign root", () => {
	const md = build({ campaignRoot: "Campaigns/Baldur's Gate" });
	assert.ok(md.includes("'Campaigns/Baldur'\\''s Gate'"));
	// No unescaped apostrophe path leaked into a recipe.
	assert.ok(!md.includes("'Campaigns/Baldur's Gate'"));
});

test("a pipe in a folder name cannot break the folder-layout table", () => {
	const md = build({ folders: { ...FOLDERS, faction: "Fac|tions" } });
	const row = md
		.split("\n")
		.find((l) => l.startsWith("| `faction` |"));
	assert.ok(row);
	const cells = row.replace(/\\\|/g, "").split("|").length - 1;
	assert.equal(cells, 4);
});

test("cross-reference section names every wikilink-typed field", () => {
	const md = build();
	const section = md.slice(
		md.indexOf("## Cross-references"),
		md.indexOf("## What is hidden"),
	);
	const linkFields = new Set<string>();
	for (const kind of Object.keys(SchemaByKind) as (keyof typeof SchemaByKind)[]) {
		for (const f of describeObjectSchema(SchemaByKind[kind])) {
			if (f.type.startsWith("wikilink")) linkFields.add(f.name);
		}
	}
	assert.ok(linkFields.size > 5);
	for (const name of linkFields) {
		assert.ok(section.includes(`\`${name}\``), `cross-refs omit ${name}`);
	}
});

test("only emits the Dataview block when Dataview is available", () => {
	assert.ok(!build({ dataviewAvailable: false }).includes("```dataview"));
	assert.ok(build({ dataviewAvailable: true }).includes("```dataview"));
});

test("escapes pipes so enum types do not break the schema tables", () => {
	const md = build();
	assert.ok(md.includes("enum: gm \\| player \\| both"));
	// Every schema-table row (the ones with a Required cell) must have exactly
	// four columns once escaped pipes are removed.
	const schemaRows = md
		.split("\n")
		.filter((l) => / \| (yes|no) \| /.test(l));
	assert.ok(schemaRows.length > 10);
	for (const line of schemaRows) {
		const cells = line.replace(/\\\|/g, "").split("|").length - 1;
		assert.equal(cells, 5, `row has wrong column count: ${line}`);
	}
});

test("never names the host application", () => {
	const md = build({ dataviewAvailable: true }).toLowerCase();
	assert.ok(!md.includes("obsidian"), "guide must not name the host app");
});

test("assistant pointer references the guide without duplicating it", () => {
	const pointer = buildAssistantPointer("AGENTS.md");
	assert.ok(pointer.includes("[AGENTS.md](AGENTS.md)"));
	assert.ok(pointer.includes(agentGuideMarker()));
	assert.ok(pointer.length < 400);
	assert.ok(!pointer.toLowerCase().includes("obsidian"));
});
