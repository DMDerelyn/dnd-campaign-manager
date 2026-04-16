export interface Combatant {
	id: string;
	name: string;
	entityPath?: string;
	initiative: number;
	hp: { current: number; max: number; temp: number };
	ac: number;
	isPC: boolean;
	conditions: Condition[];
	notes: string;
}

export type Condition =
	| "blinded"
	| "charmed"
	| "deafened"
	| "frightened"
	| "grappled"
	| "incapacitated"
	| "invisible"
	| "paralyzed"
	| "petrified"
	| "poisoned"
	| "prone"
	| "restrained"
	| "stunned"
	| "unconscious"
	| "exhaustion"
	| "concentrating";

export const ALL_CONDITIONS: Condition[] = [
	"blinded",
	"charmed",
	"deafened",
	"frightened",
	"grappled",
	"incapacitated",
	"invisible",
	"paralyzed",
	"petrified",
	"poisoned",
	"prone",
	"restrained",
	"stunned",
	"unconscious",
	"exhaustion",
	"concentrating",
];

export interface CombatState {
	round: number;
	turnIndex: number;
	combatants: Combatant[];
	active: boolean;
}

export function createCombatState(): CombatState {
	return { round: 1, turnIndex: 0, combatants: [], active: false };
}

export function addCombatant(state: CombatState, c: Combatant): CombatState {
	const combatants = [...state.combatants, c];
	sortByInitiative(combatants);
	return { ...state, combatants };
}

export function removeCombatant(state: CombatState, id: string): CombatState {
	const idx = state.combatants.findIndex((c) => c.id === id);
	if (idx === -1) return state;
	const combatants = state.combatants.filter((c) => c.id !== id);
	let turnIndex = state.turnIndex;
	if (idx < turnIndex) turnIndex--;
	if (combatants.length === 0) turnIndex = 0;
	else turnIndex = Math.min(turnIndex, combatants.length - 1);
	return { ...state, combatants, turnIndex };
}

export function nextTurn(state: CombatState): CombatState {
	if (state.combatants.length === 0) return state;
	let turnIndex = state.turnIndex + 1;
	let round = state.round;
	if (turnIndex >= state.combatants.length) {
		turnIndex = 0;
		round++;
	}
	return { ...state, turnIndex, round };
}

export function prevTurn(state: CombatState): CombatState {
	if (state.combatants.length === 0) return state;
	let turnIndex = state.turnIndex - 1;
	let round = state.round;
	if (turnIndex < 0) {
		if (round > 1) {
			round--;
			turnIndex = state.combatants.length - 1;
		} else {
			turnIndex = 0;
		}
	}
	return { ...state, turnIndex, round };
}

export function adjustHP(
	state: CombatState,
	id: string,
	delta: number,
): CombatState {
	return mapCombatant(state, id, (c) => {
		let { current, max, temp } = c.hp;
		if (delta < 0) {
			const dmg = Math.abs(delta);
			if (temp > 0) {
				const absorbed = Math.min(temp, dmg);
				temp -= absorbed;
				current -= dmg - absorbed;
			} else {
				current -= dmg;
			}
		} else {
			current = Math.min(current + delta, max);
		}
		current = Math.max(current, 0);
		return { ...c, hp: { current, max, temp } };
	});
}

export function setTempHP(
	state: CombatState,
	id: string,
	temp: number,
): CombatState {
	return mapCombatant(state, id, (c) => ({
		...c,
		hp: { ...c.hp, temp: Math.max(0, temp) },
	}));
}

export function toggleCondition(
	state: CombatState,
	id: string,
	condition: Condition,
): CombatState {
	return mapCombatant(state, id, (c) => {
		const has = c.conditions.includes(condition);
		return {
			...c,
			conditions: has
				? c.conditions.filter((x) => x !== condition)
				: [...c.conditions, condition],
		};
	});
}

export function updateInitiative(
	state: CombatState,
	id: string,
	initiative: number,
): CombatState {
	const updated = mapCombatant(state, id, (c) => ({ ...c, initiative }));
	sortByInitiative(updated.combatants);
	return updated;
}

export function rollInitiativeValue(modifier = 0): number {
	return 1 + Math.floor(Math.random() * 20) + modifier;
}

export function currentCombatant(state: CombatState): Combatant | undefined {
	return state.combatants[state.turnIndex];
}

function mapCombatant(
	state: CombatState,
	id: string,
	fn: (c: Combatant) => Combatant,
): CombatState {
	return {
		...state,
		combatants: state.combatants.map((c) => (c.id === id ? fn(c) : c)),
	};
}

function sortByInitiative(combatants: Combatant[]): void {
	combatants.sort((a, b) => {
		if (b.initiative !== a.initiative) return b.initiative - a.initiative;
		if (a.isPC !== b.isPC) return a.isPC ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
}
