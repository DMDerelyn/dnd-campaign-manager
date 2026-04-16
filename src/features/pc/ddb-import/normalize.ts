import { ulid } from "../../../core/ulid";

export interface NormalizedPC {
	id: string;
	kind: "pc";
	aliases: string[];
	visibility: "both";
	tags: string[];
	player: string;
	class: string;
	subclass: string;
	level: number;
	race: string;
	background: string;
	alignment: string;
	hp: { current: number; max: number; temp: number };
	ac: number;
	speed: number;
	initiative_bonus: number;
	stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
	saves: Record<string, number>;
	skills: Record<string, number>;
	spell_slots: Record<string, number>;
	inventory: string[];
	dndbeyond_url: string;
	dndbeyond_imported_at: string;
}

const STAT_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
const STAT_MAP: Record<number, typeof STAT_KEYS[number]> = {
	1: "str", 2: "dex", 3: "con", 4: "int", 5: "wis", 6: "cha",
};

/**
 * Normalize the JSON blob returned by DDB's character-service v3/v5 endpoint
 * into our PC schema shape. Isolated here so DDB schema drift is a one-file fix.
 */
export function normalizeDDBCharacter(raw: unknown, sourceUrl = ""): NormalizedPC {
	const data = unwrapPayload(raw);

	const name = str(data, "name") || "Unknown";
	const stats = extractStats(data);
	const classes = extractClasses(data);
	const hp = extractHP(data);
	const ac = extractAC(data);
	const speed = extractSpeed(data);

	return {
		id: ulid(),
		kind: "pc",
		aliases: [name],
		visibility: "both",
		tags: ["pc"],
		player: "",
		class: classes.className,
		subclass: classes.subclass,
		level: classes.level,
		race: extractRace(data),
		background: str(data, "background", "name") || "",
		alignment: "",
		hp,
		ac,
		speed,
		initiative_bonus: abilityMod(stats.dex),
		stats,
		saves: extractSaves(stats),
		skills: {},
		spell_slots: extractSpellSlots(data),
		inventory: [],
		dndbeyond_url: sourceUrl,
		dndbeyond_imported_at: new Date().toISOString(),
	};
}

function unwrapPayload(raw: unknown): Record<string, unknown> {
	if (!raw || typeof raw !== "object") throw new Error("Invalid DDB payload");
	const obj = raw as Record<string, unknown>;
	if ("data" in obj && typeof obj.data === "object" && obj.data !== null) {
		return obj.data as Record<string, unknown>;
	}
	return obj;
}

function str(obj: Record<string, unknown>, ...path: string[]): string {
	let cur: unknown = obj;
	for (const key of path) {
		if (!cur || typeof cur !== "object") return "";
		cur = (cur as Record<string, unknown>)[key];
	}
	return typeof cur === "string" ? cur : "";
}

function num(obj: Record<string, unknown>, ...path: string[]): number {
	let cur: unknown = obj;
	for (const key of path) {
		if (!cur || typeof cur !== "object") return 0;
		cur = (cur as Record<string, unknown>)[key];
	}
	return typeof cur === "number" ? cur : 0;
}

function abilityMod(score: number): number {
	return Math.floor((score - 10) / 2);
}

function extractStats(data: Record<string, unknown>): NormalizedPC["stats"] {
	const result = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
	const stats = data.stats as Array<{ id?: number; value?: number }> | undefined;
	if (!Array.isArray(stats)) return result;

	for (const s of stats) {
		const key = STAT_MAP[s.id ?? 0];
		if (key) result[key] = s.value ?? 10;
	}

	const bonusStats = data.bonusStats as Array<{ id?: number; value?: number | null }> | undefined;
	if (Array.isArray(bonusStats)) {
		for (const b of bonusStats) {
			const key = STAT_MAP[b.id ?? 0];
			if (key && typeof b.value === "number") result[key] += b.value;
		}
	}

	const overrideStats = data.overrideStats as Array<{ id?: number; value?: number | null }> | undefined;
	if (Array.isArray(overrideStats)) {
		for (const o of overrideStats) {
			const key = STAT_MAP[o.id ?? 0];
			if (key && typeof o.value === "number") result[key] = o.value;
		}
	}

	const modifiers = data.modifiers as Record<string, Array<{ type?: string; subType?: string; value?: number }>> | undefined;
	if (modifiers && typeof modifiers === "object") {
		for (const source of Object.values(modifiers)) {
			if (!Array.isArray(source)) continue;
			for (const mod of source) {
				if (mod.type !== "bonus") continue;
				for (const [id, key] of Object.entries(STAT_MAP)) {
					if (mod.subType === `${key}-score`) {
						result[key] += mod.value ?? 0;
					}
				}
			}
		}
	}

	for (const key of STAT_KEYS) {
		result[key] = Math.max(1, Math.min(30, result[key]));
	}

	return result;
}

function extractClasses(data: Record<string, unknown>): { className: string; subclass: string; level: number } {
	const classes = data.classes as Array<{ definition?: { name?: string }; subclassDefinition?: { name?: string }; level?: number }> | undefined;
	if (!Array.isArray(classes) || classes.length === 0) {
		return { className: "Unknown", subclass: "", level: 1 };
	}
	const primary = classes[0];
	const totalLevel = classes.reduce((sum, c) => sum + (c.level ?? 0), 0);
	const names = classes.map((c) => c.definition?.name ?? "Unknown").join(" / ");
	return {
		className: names,
		subclass: primary.subclassDefinition?.name ?? "",
		level: totalLevel || 1,
	};
}

function extractHP(data: Record<string, unknown>): NormalizedPC["hp"] {
	const base = num(data, "baseHitPoints");
	const bonus = num(data, "bonusHitPoints");
	const temp = num(data, "temporaryHitPoints");
	const removed = num(data, "removedHitPoints");
	const max = (base || 10) + bonus;
	return { current: Math.max(0, max - removed), max, temp };
}

function extractAC(data: Record<string, unknown>): number {
	const armor = data.armorClass as number | undefined;
	if (typeof armor === "number") return armor;
	return 10;
}

function extractSpeed(data: Record<string, unknown>): number {
	const race = data.race as { weightSpeeds?: { normal?: { walk?: number } } } | undefined;
	return race?.weightSpeeds?.normal?.walk ?? 30;
}

function extractRace(data: Record<string, unknown>): string {
	const race = data.race as { fullName?: string; baseName?: string } | undefined;
	return race?.fullName ?? race?.baseName ?? "";
}

function extractSaves(stats: NormalizedPC["stats"]): Record<string, number> {
	const result: Record<string, number> = {};
	for (const key of STAT_KEYS) {
		result[key] = abilityMod(stats[key]);
	}
	return result;
}

function extractSpellSlots(data: Record<string, unknown>): Record<string, number> {
	const slots: Record<string, number> = {};
	const spellSlots = data.spellSlots as Array<{ level?: number; used?: number; available?: number }> | undefined;
	if (!Array.isArray(spellSlots)) return slots;
	for (const s of spellSlots) {
		if (typeof s.level === "number" && typeof s.available === "number" && s.available > 0) {
			slots[`level_${s.level}`] = s.available;
		}
	}
	return slots;
}
