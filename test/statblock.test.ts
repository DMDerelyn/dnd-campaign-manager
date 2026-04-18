import { describe, it, expect } from "vitest";
import { normalizeStatblock } from "../src/features/statblock/normalize";

describe("normalizeStatblock", () => {
	it("rejects non-object", () => {
		expect(normalizeStatblock(null)).toBe("Statblock must be a YAML object.");
		expect(normalizeStatblock("foo")).toBe("Statblock must be a YAML object.");
	});

	it("requires name", () => {
		expect(normalizeStatblock({})).toContain("name");
	});

	it("accepts minimal goblin", () => {
		const result = normalizeStatblock({
			name: "Goblin",
			size: "Small",
			type: "humanoid (goblinoid)",
			alignment: "Neutral Evil",
			ac: "15 (leather armor)",
			hp: "7 (2d6)",
			stats: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
			cr: "1/4",
		});
		expect(typeof result).not.toBe("string");
		if (typeof result === "string") return;
		expect(result.name).toBe("Goblin");
		expect(result.stats?.dex).toBe(14);
		expect(result.cr).toBe("1/4");
	});

	it("supports actions with desc or text keys", () => {
		const result = normalizeStatblock({
			name: "X",
			actions: [
				{ name: "Attack 1", text: "hit hard" },
				{ name: "Attack 2", desc: "hit softer" },
			],
		});
		if (typeof result === "string") throw new Error("expected object");
		expect(result.actions).toHaveLength(2);
		expect(result.actions![1].text).toBe("hit softer");
	});

	it("accepts armor_class and hit_points aliases", () => {
		const result = normalizeStatblock({
			name: "X",
			armor_class: 12,
			hit_points: 45,
		});
		if (typeof result === "string") throw new Error("expected object");
		expect(result.ac).toBe(12);
		expect(result.hp).toBe(45);
	});
});
