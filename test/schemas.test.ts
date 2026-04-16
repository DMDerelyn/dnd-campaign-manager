import { describe, it, expect } from "vitest";
import { validateFrontmatter } from "../src/schemas";
import { ulid } from "../src/core/ulid";

const baseValid = {
	id: ulid(),
	aliases: [],
	visibility: "gm",
	tags: [],
};

describe("validateFrontmatter", () => {
	it("rejects missing frontmatter", () => {
		const r = validateFrontmatter(undefined);
		expect(r.ok).toBe(false);
	});

	it("rejects unknown kind", () => {
		const r = validateFrontmatter({ ...baseValid, kind: "nope" });
		expect(r.ok).toBe(false);
	});

	it("accepts a valid PC", () => {
		const r = validateFrontmatter({
			...baseValid,
			kind: "pc",
			class: "Fighter",
			level: 3,
			race: "Human",
			hp: { current: 20, max: 24, temp: 0 },
			ac: 16,
			stats: { str: 16, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
		});
		expect(r.ok).toBe(true);
	});

	it("rejects PC with out-of-range stat", () => {
		const r = validateFrontmatter({
			...baseValid,
			kind: "pc",
			class: "Fighter",
			level: 3,
			race: "Human",
			hp: { current: 20, max: 24 },
			ac: 16,
			stats: { str: 99, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
		});
		expect(r.ok).toBe(false);
	});

	it("accepts a valid NPC", () => {
		const r = validateFrontmatter({
			...baseValid,
			kind: "npc",
			disposition: "friendly",
			status: "alive",
		});
		expect(r.ok).toBe(true);
	});

	it("rejects NPC with invalid disposition", () => {
		const r = validateFrontmatter({
			...baseValid,
			kind: "npc",
			disposition: "grumpy",
		});
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.issues.some((i) => i.path === "disposition")).toBe(true);
	});

	it("accepts a valid quest with objectives", () => {
		const r = validateFrontmatter({
			...baseValid,
			kind: "quest",
			state: "active",
			objectives: [{ text: "find sword", done: false }],
		});
		expect(r.ok).toBe(true);
	});

	it("rejects malformed wikilink", () => {
		const r = validateFrontmatter({
			...baseValid,
			kind: "npc",
			factions: ["not a link"],
		});
		expect(r.ok).toBe(false);
	});

	it("accepts a session with date", () => {
		const r = validateFrontmatter({
			...baseValid,
			kind: "session",
			number: 4,
			date: "2026-04-16",
		});
		expect(r.ok).toBe(true);
	});
});
