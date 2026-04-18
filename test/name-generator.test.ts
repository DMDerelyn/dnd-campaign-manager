import { describe, it, expect } from "vitest";
import { generateName, NAME_RACES, raceLabel } from "../src/features/names/generator";

describe("generateName", () => {
	it("produces a full name with non-empty first and last", () => {
		const name = generateName();
		expect(name.first.length).toBeGreaterThan(0);
		expect(name.last.length).toBeGreaterThan(0);
		expect(name.full).toBe(`${name.first} ${name.last}`);
		expect(NAME_RACES).toContain(name.race);
	});

	it("honors the requested race", () => {
		const name = generateName("dwarf");
		expect(name.race).toBe("dwarf");
	});

	it("is deterministic with a seeded RNG", () => {
		let seed = 0.5;
		const rand = () => seed;
		const a = generateName("elf", rand);
		const b = generateName("elf", rand);
		expect(a.full).toBe(b.full);
	});

	it("raceLabel handles half-orc casing", () => {
		expect(raceLabel("half-orc")).toBe("Half-Orc");
		expect(raceLabel("elf")).toBe("Elf");
	});
});
