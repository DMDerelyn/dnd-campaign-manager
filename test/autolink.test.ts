import { describe, it, expect } from "vitest";
import { autolink } from "../src/features/autolink/linker";
import type { EntityIndex, IndexedEntity } from "../src/core/entity-index";

function makeIndex(entities: IndexedEntity[]): EntityIndex {
	return {
		allAliases: () => {
			const out: { alias: string; entity: IndexedEntity }[] = [];
			for (const e of entities) for (const a of e.aliases) out.push({ alias: a, entity: e });
			out.sort((a, b) => b.alias.length - a.alias.length);
			return out;
		},
	} as unknown as EntityIndex;
}

const goruk: IndexedEntity = {
	path: "NPCs/Goruk.md",
	id: "01HTEST",
	kind: "npc",
	name: "Goruk",
	aliases: ["Goruk", "the Mighty"],
	frontmatter: {},
};

describe("autolink", () => {
	it("wraps bare name in [[ ]]", () => {
		const out = autolink(makeIndex([goruk]), "Goruk entered the tavern.");
		expect(out.output).toBe("[[Goruk]] entered the tavern.");
		expect(out.replacements).toBe(1);
	});

	it("preserves existing wikilinks", () => {
		const text = "[[Goruk]] entered the tavern with Goruk.";
		const out = autolink(makeIndex([goruk]), text);
		expect(out.output).toBe("[[Goruk]] entered the tavern with [[Goruk]].");
		expect(out.replacements).toBe(1);
	});

	it("skips code fences", () => {
		const src = "```\nGoruk goes here\n```\nGoruk walks.";
		const out = autolink(makeIndex([goruk]), src);
		expect(out.output).toBe("```\nGoruk goes here\n```\n[[Goruk]] walks.");
		expect(out.replacements).toBe(1);
	});

	it("skips inline code", () => {
		const src = "call it `Goruk` but Goruk is real.";
		const out = autolink(makeIndex([goruk]), src);
		expect(out.output).toBe("call it `Goruk` but [[Goruk]] is real.");
	});

	it("skips frontmatter", () => {
		const src = "---\ntitle: Goruk\n---\nGoruk appears.";
		const out = autolink(makeIndex([goruk]), src);
		expect(out.output).toContain("title: Goruk");
		expect(out.output).toContain("[[Goruk]] appears.");
	});

	it("uses display pipe for alias variants", () => {
		const src = "the Mighty strode forward.";
		const out = autolink(makeIndex([goruk]), src);
		expect(out.output).toBe("[[Goruk|the Mighty]] strode forward.");
	});
});
