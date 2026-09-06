import { test } from "node:test";
import assert from "node:assert/strict";
import {
	buildCampaignIndex,
	serializeCampaignIndex,
	type IndexedEntityInput,
} from "./index-export";
import { AGENT_GUIDE_MARKER_PREFIX } from "./generator";

const NOW = new Date("2026-09-06T12:00:00.000Z");

function entity(over: Partial<IndexedEntityInput> = {}): IndexedEntityInput {
	return {
		path: "Campaigns/Vale/NPCs/Volo.md",
		id: "01HXK0000000000000000000AB",
		kind: "npc",
		name: "Volo",
		aliases: ["Volothamp"],
		frontmatter: { kind: "npc", visibility: "both" },
		...over,
	};
}

function build(entities: IndexedEntityInput[], scope: "all" | "player" = "all") {
	return buildCampaignIndex(entities, {
		campaignRoot: "Campaigns/Vale",
		scope,
		now: NOW,
	});
}

test("produces the documented envelope", () => {
	const index = build([entity()]);
	assert.equal(index.generator, AGENT_GUIDE_MARKER_PREFIX);
	assert.equal(index.schema_version, 1);
	assert.equal(index.generated, "2026-09-06T12:00:00.000Z");
	assert.equal(index.campaign_root, "Campaigns/Vale");
	assert.equal(index.scope, "all");
	assert.equal(index.entity_count, 1);
	assert.equal(index.entities.length, 1);
});

test("visibility defaults to gm when the frontmatter omits it", () => {
	const index = build([entity({ frontmatter: { kind: "npc" } })]);
	assert.equal(index.entities[0].visibility, "gm");
});

test("player scope drops gm entities, keeps player and both", () => {
	const entities = [
		entity({ id: "a", name: "Secret", frontmatter: { kind: "npc" } }),
		entity({
			id: "b",
			name: "Public",
			frontmatter: { kind: "npc", visibility: "player" },
		}),
		entity({
			id: "c",
			name: "Shared",
			frontmatter: { kind: "npc", visibility: "both" },
		}),
	];
	const index = build(entities, "player");
	assert.deepEqual(
		index.entities.map((e) => e.name),
		["Public", "Shared"],
	);
	assert.equal(index.entity_count, 2);
});

test("extracts wikilink targets from frontmatter, ignoring non-link fields", () => {
	const index = build([
		entity({
			frontmatter: {
				kind: "npc",
				visibility: "both",
				location: "[[Waterdeep]]",
				factions: ["[[Harpers]]", "[[Zhentarim|the Zhents]]"],
				role: "chronicler",
				secrets: ["knows a guy"],
			},
		}),
	]);
	const { links } = index.entities[0];
	assert.deepEqual(links.location, ["Waterdeep"]);
	assert.deepEqual(links.factions, ["Harpers", "Zhentarim"]);
	assert.ok(!("role" in links));
	assert.ok(!("secrets" in links));
});

test("carries tags, summary, and real aliases", () => {
	const index = build([
		entity({
			aliases: ["Volothamp"],
			frontmatter: {
				kind: "npc",
				visibility: "both",
				tags: ["waterdeep", "author"],
				summary: "  Self-important travel writer.  ",
			},
		}),
	]);
	const e = index.entities[0];
	assert.deepEqual(e.tags, ["waterdeep", "author"]);
	assert.equal(e.summary, "Self-important travel writer.");
	assert.deepEqual(e.aliases, ["Volothamp"]);
});

test("sorts deterministically by kind, then name, then id", () => {
	const index = build([
		entity({ id: "1", kind: "npc", name: "Zed" }),
		entity({ id: "2", kind: "faction", name: "Bravos" }),
		entity({ id: "3", kind: "npc", name: "Ana" }),
		entity({ id: "0", kind: "npc", name: "Ana" }),
	]);
	assert.deepEqual(
		index.entities.map((e) => `${e.kind}/${e.name}/${e.id}`),
		["faction/Bravos/2", "npc/Ana/0", "npc/Ana/3", "npc/Zed/1"],
	);
});

test("reduces wikilinks to bare targets, matching the resolver", () => {
	const index = build([
		entity({
			frontmatter: {
				kind: "npc",
				visibility: "both",
				location: "[[NPCs/Volo#History|Volo]]",
				factions: ["[[Harpers#Leadership]]", "[[#DanglingHeading]]", "[[  ]]"],
			},
		}),
	]);
	const { links } = index.entities[0];
	assert.deepEqual(links.location, ["NPCs/Volo"]);
	assert.deepEqual(links.factions, ["Harpers"]);
});

test("player scope redacts links that point at gm-only entities", () => {
	const entities = [
		entity({
			id: "hero",
			kind: "pc",
			name: "Hero",
			path: "Campaigns/Vale/PCs/Hero.md",
			frontmatter: {
				kind: "pc",
				visibility: "both",
				allies: ["[[Contact]]", "[[Secret Lair]]"],
				rival: "[[Villain]]",
			},
		}),
		entity({
			id: "contact",
			kind: "npc",
			name: "Contact",
			path: "Campaigns/Vale/NPCs/Contact.md",
			frontmatter: { kind: "npc", visibility: "player" },
		}),
		entity({
			id: "lair",
			kind: "location",
			name: "Secret Lair",
			path: "Campaigns/Vale/Locations/Secret Lair.md",
			frontmatter: { kind: "location" }, // no visibility -> gm
		}),
		entity({
			id: "villain",
			kind: "npc",
			name: "Villain",
			path: "Campaigns/Vale/NPCs/Villain.md",
			frontmatter: { kind: "npc", visibility: "gm" },
		}),
	];
	const player = build(entities, "player");
	const hero = player.entities.find((e) => e.id === "hero");
	assert.ok(hero);
	// gm-only targets stripped, player-visible target kept.
	assert.deepEqual(hero.links.allies, ["Contact"]);
	assert.ok(!("rival" in hero.links), "all-gm link field is dropped");
	// The gm entities themselves are absent.
	assert.deepEqual(
		player.entities.map((e) => e.id).sort(),
		["contact", "hero"],
	);
});

test("all scope keeps every entity and every link", () => {
	const entities = [
		entity({
			id: "hero",
			frontmatter: {
				kind: "npc",
				visibility: "both",
				allies: ["[[Secret Lair]]"],
			},
		}),
		entity({
			id: "lair",
			name: "Secret Lair",
			path: "Campaigns/Vale/Locations/Secret Lair.md",
			frontmatter: { kind: "location" },
		}),
	];
	const index = build(entities, "all");
	assert.equal(index.entity_count, 2);
	assert.deepEqual(
		index.entities.find((e) => e.id === "hero")?.links.allies,
		["Secret Lair"],
	);
});

test("serialization is pretty-printed JSON with a trailing newline", () => {
	const text = serializeCampaignIndex(build([entity()]));
	assert.ok(text.endsWith("\n"));
	assert.deepEqual(JSON.parse(text).entities.length, 1);
	assert.ok(text.includes("\n  "));
});

test("output never names the host application", () => {
	const text = serializeCampaignIndex(
		build([
			entity({
				frontmatter: {
					kind: "npc",
					visibility: "both",
					tags: ["x"],
					summary: "y",
					location: "[[Z]]",
				},
			}),
		]),
	).toLowerCase();
	assert.ok(!text.includes("obsidian"));
});
