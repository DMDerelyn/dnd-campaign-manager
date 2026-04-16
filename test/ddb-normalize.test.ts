import { describe, it, expect } from "vitest";
import { normalizeDDBCharacter } from "../src/features/pc/ddb-import/normalize";
import { extractCharacterId } from "../src/features/pc/ddb-import/utils";

const MOCK_DDB_PAYLOAD = {
	data: {
		name: "Goruk Ironjaw",
		stats: [
			{ id: 1, value: 18 },
			{ id: 2, value: 12 },
			{ id: 3, value: 16 },
			{ id: 4, value: 8 },
			{ id: 5, value: 10 },
			{ id: 6, value: 14 },
		],
		bonusStats: [
			{ id: 1, value: 2 },
		],
		overrideStats: [],
		classes: [
			{
				definition: { name: "Barbarian" },
				subclassDefinition: { name: "Path of the Totem" },
				level: 5,
			},
		],
		baseHitPoints: 55,
		bonusHitPoints: 0,
		temporaryHitPoints: 3,
		removedHitPoints: 10,
		armorClass: 16,
		race: {
			fullName: "Half-Orc",
			baseName: "Orc",
			weightSpeeds: { normal: { walk: 30 } },
		},
		background: { name: "Soldier" },
		spellSlots: [
			{ level: 1, available: 0, used: 0 },
			{ level: 2, available: 2, used: 0 },
		],
		modifiers: {},
	},
};

describe("normalizeDDBCharacter", () => {
	it("extracts name, class, race, and level", () => {
		const pc = normalizeDDBCharacter(MOCK_DDB_PAYLOAD, "https://www.dndbeyond.com/characters/12345");
		expect(pc.aliases[0]).toBe("Goruk Ironjaw");
		expect(pc.class).toBe("Barbarian");
		expect(pc.subclass).toBe("Path of the Totem");
		expect(pc.level).toBe(5);
		expect(pc.race).toBe("Half-Orc");
	});

	it("computes stats with bonus stats", () => {
		const pc = normalizeDDBCharacter(MOCK_DDB_PAYLOAD);
		expect(pc.stats.str).toBe(20);
		expect(pc.stats.dex).toBe(12);
		expect(pc.stats.con).toBe(16);
	});

	it("computes HP accounting for removed HP and temp HP", () => {
		const pc = normalizeDDBCharacter(MOCK_DDB_PAYLOAD);
		expect(pc.hp.max).toBe(55);
		expect(pc.hp.current).toBe(45);
		expect(pc.hp.temp).toBe(3);
	});

	it("extracts AC", () => {
		const pc = normalizeDDBCharacter(MOCK_DDB_PAYLOAD);
		expect(pc.ac).toBe(16);
	});

	it("extracts spell slots (only non-zero)", () => {
		const pc = normalizeDDBCharacter(MOCK_DDB_PAYLOAD);
		expect(pc.spell_slots).toEqual({ level_2: 2 });
	});

	it("extracts DDB url", () => {
		const pc = normalizeDDBCharacter(MOCK_DDB_PAYLOAD, "https://www.dndbeyond.com/characters/12345");
		expect(pc.dndbeyond_url).toBe("https://www.dndbeyond.com/characters/12345");
	});

	it("handles flat payload without data wrapper", () => {
		const flat = { ...MOCK_DDB_PAYLOAD.data };
		const pc = normalizeDDBCharacter(flat);
		expect(pc.aliases[0]).toBe("Goruk Ironjaw");
	});

	it("handles missing fields gracefully", () => {
		const pc = normalizeDDBCharacter({ data: { name: "Blank" } });
		expect(pc.class).toBe("Unknown");
		expect(pc.stats.str).toBe(10);
		expect(pc.hp.max).toBe(10);
	});
});

describe("extractCharacterId", () => {
	it("extracts from full URL", () => {
		expect(extractCharacterId("https://www.dndbeyond.com/characters/98765432")).toBe("98765432");
	});

	it("extracts from bare number", () => {
		expect(extractCharacterId("98765432")).toBe("98765432");
	});

	it("returns null for invalid input", () => {
		expect(extractCharacterId("not a url")).toBeNull();
	});
});
