import { describe, it, expect } from "vitest";
import {
	createCombatState,
	addCombatant,
	removeCombatant,
	nextTurn,
	prevTurn,
	adjustHP,
	toggleCondition,
	updateInitiative,
	currentCombatant,
	rollInitiativeValue,
	type Combatant,
} from "../src/features/initiative/turn-engine";

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
	return {
		id: Math.random().toString(36).slice(2),
		name: "Test",
		initiative: 10,
		hp: { current: 20, max: 20, temp: 0 },
		ac: 15,
		isPC: false,
		conditions: [],
		notes: "",
		...overrides,
	};
}

describe("turn-engine", () => {
	it("creates an empty state", () => {
		const s = createCombatState();
		expect(s.round).toBe(1);
		expect(s.turnIndex).toBe(0);
		expect(s.combatants).toHaveLength(0);
	});

	it("adds combatants sorted by initiative (high first)", () => {
		let s = createCombatState();
		s = addCombatant(s, makeCombatant({ name: "Low", initiative: 5 }));
		s = addCombatant(s, makeCombatant({ name: "High", initiative: 20 }));
		s = addCombatant(s, makeCombatant({ name: "Mid", initiative: 10 }));
		expect(s.combatants.map((c) => c.name)).toEqual(["High", "Mid", "Low"]);
	});

	it("removes a combatant and adjusts turnIndex", () => {
		let s = createCombatState();
		const a = makeCombatant({ name: "A", initiative: 20 });
		const b = makeCombatant({ name: "B", initiative: 15 });
		const c = makeCombatant({ name: "C", initiative: 10 });
		s = addCombatant(s, a);
		s = addCombatant(s, b);
		s = addCombatant(s, c);
		s = { ...s, turnIndex: 2 };
		s = removeCombatant(s, a.id);
		expect(s.combatants).toHaveLength(2);
		expect(s.turnIndex).toBe(1);
	});

	it("advances turn and round", () => {
		let s = createCombatState();
		s = addCombatant(s, makeCombatant({ name: "A", initiative: 20 }));
		s = addCombatant(s, makeCombatant({ name: "B", initiative: 10 }));
		expect(currentCombatant(s)?.name).toBe("A");

		s = nextTurn(s);
		expect(currentCombatant(s)?.name).toBe("B");
		expect(s.round).toBe(1);

		s = nextTurn(s);
		expect(currentCombatant(s)?.name).toBe("A");
		expect(s.round).toBe(2);
	});

	it("goes back a turn", () => {
		let s = createCombatState();
		s = addCombatant(s, makeCombatant({ name: "A", initiative: 20 }));
		s = addCombatant(s, makeCombatant({ name: "B", initiative: 10 }));
		s = nextTurn(s);
		s = prevTurn(s);
		expect(currentCombatant(s)?.name).toBe("A");
	});

	it("does not go before round 1 turn 0", () => {
		let s = createCombatState();
		s = addCombatant(s, makeCombatant({ name: "A", initiative: 20 }));
		s = prevTurn(s);
		expect(s.round).toBe(1);
		expect(s.turnIndex).toBe(0);
	});

	it("deals damage correctly, absorbed by temp HP first", () => {
		let s = createCombatState();
		const c = makeCombatant({ hp: { current: 20, max: 20, temp: 5 } });
		s = addCombatant(s, c);

		s = adjustHP(s, c.id, -8);
		const updated = s.combatants[0];
		expect(updated.hp.temp).toBe(0);
		expect(updated.hp.current).toBe(17);
	});

	it("heals up to max", () => {
		let s = createCombatState();
		const c = makeCombatant({ hp: { current: 5, max: 20, temp: 0 } });
		s = addCombatant(s, c);
		s = adjustHP(s, c.id, 100);
		expect(s.combatants[0].hp.current).toBe(20);
	});

	it("HP does not go below 0", () => {
		let s = createCombatState();
		const c = makeCombatant({ hp: { current: 3, max: 20, temp: 0 } });
		s = addCombatant(s, c);
		s = adjustHP(s, c.id, -100);
		expect(s.combatants[0].hp.current).toBe(0);
	});

	it("toggles conditions", () => {
		let s = createCombatState();
		const c = makeCombatant();
		s = addCombatant(s, c);

		s = toggleCondition(s, c.id, "prone");
		expect(s.combatants[0].conditions).toContain("prone");

		s = toggleCondition(s, c.id, "prone");
		expect(s.combatants[0].conditions).not.toContain("prone");
	});

	it("updates initiative and re-sorts", () => {
		let s = createCombatState();
		const a = makeCombatant({ name: "A", initiative: 20 });
		const b = makeCombatant({ name: "B", initiative: 10 });
		s = addCombatant(s, a);
		s = addCombatant(s, b);

		s = updateInitiative(s, b.id, 25);
		expect(s.combatants[0].name).toBe("B");
	});

	it("rollInitiativeValue produces values in range", () => {
		for (let i = 0; i < 100; i++) {
			const v = rollInitiativeValue(3);
			expect(v).toBeGreaterThanOrEqual(4);
			expect(v).toBeLessThanOrEqual(23);
		}
	});
});
