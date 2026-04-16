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
	aliases: ["Goruk"],
	frontmatter: {},
};

describe("autolink edge cases", () => {
	it("still links after an unclosed code fence", () => {
		const src = "```\nsome code\nGoruk walked in.";
		const out = autolink(makeIndex([goruk]), src);
		expect(out.output).toContain("[[Goruk]]");
	});

	it("does not link inside a properly closed fence", () => {
		const src = "```\nGoruk code\n```\nGoruk walks.";
		const out = autolink(makeIndex([goruk]), src);
		expect(out.output).toContain("```\nGoruk code\n```");
		expect(out.output).toContain("[[Goruk]] walks.");
		expect(out.replacements).toBe(1);
	});

	it("handles empty string", () => {
		const out = autolink(makeIndex([goruk]), "");
		expect(out.output).toBe("");
		expect(out.replacements).toBe(0);
	});

	it("does not double-link", () => {
		const src = "[[Goruk]] and Goruk";
		const out = autolink(makeIndex([goruk]), src);
		expect(out.output).toBe("[[Goruk]] and [[Goruk]]");
		expect(out.replacements).toBe(1);
	});

	it("handles entity at very end of file", () => {
		const src = "Hello Goruk";
		const out = autolink(makeIndex([goruk]), src);
		expect(out.output).toBe("Hello [[Goruk]]");
	});
});
