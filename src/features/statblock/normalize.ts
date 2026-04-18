export interface StatblockAction {
	name: string;
	text: string;
}

export interface StatblockData {
	name: string;
	size?: string;
	type?: string;
	alignment?: string;
	ac?: string | number;
	hp?: string | number;
	speed?: string;
	stats?: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>;
	saves?: string | string[];
	skills?: string | string[];
	damage_vulnerabilities?: string;
	damage_resistances?: string;
	damage_immunities?: string;
	condition_immunities?: string;
	senses?: string;
	languages?: string;
	cr?: string | number;
	traits?: StatblockAction[];
	actions?: StatblockAction[];
	bonus_actions?: StatblockAction[];
	reactions?: StatblockAction[];
	legendary_actions?: StatblockAction[];
	description?: string;
}

function firstTextOf(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	if (Array.isArray(value)) return value.map((v) => firstTextOf(v)).join(", ");
	return "";
}

function normalizeActions(value: unknown): StatblockAction[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (item && typeof item === "object") {
				const obj = item as { name?: unknown; text?: unknown; desc?: unknown };
				const name = typeof obj.name === "string" ? obj.name : "";
				const text =
					typeof obj.text === "string"
						? obj.text
						: typeof obj.desc === "string"
							? obj.desc
							: "";
				return { name, text };
			}
			return null;
		})
		.filter((v): v is StatblockAction => v !== null && v.name !== "");
}

export function normalizeStatblock(raw: unknown): StatblockData | string {
	if (!raw || typeof raw !== "object") {
		return "Statblock must be a YAML object.";
	}
	const r = raw as Record<string, unknown>;
	const name = typeof r.name === "string" ? r.name : "";
	if (!name) return "Statblock requires a 'name' field.";

	const statsRaw = (r.stats ?? r.ability_scores) as Record<string, number> | undefined;
	const stats: StatblockData["stats"] = {};
	if (statsRaw && typeof statsRaw === "object") {
		for (const k of ["str", "dex", "con", "int", "wis", "cha"] as const) {
			const v = (statsRaw as Record<string, unknown>)[k];
			if (typeof v === "number") stats[k] = v;
		}
	}

	return {
		name,
		size: firstTextOf(r.size) || undefined,
		type: firstTextOf(r.type) || undefined,
		alignment: firstTextOf(r.alignment) || undefined,
		ac: (r.ac as string | number | undefined) ?? (r.armor_class as string | number | undefined),
		hp: (r.hp as string | number | undefined) ?? (r.hit_points as string | number | undefined),
		speed: firstTextOf(r.speed) || undefined,
		stats: Object.keys(stats).length > 0 ? stats : undefined,
		saves: r.saves as string | string[] | undefined,
		skills: r.skills as string | string[] | undefined,
		damage_vulnerabilities: firstTextOf(r.damage_vulnerabilities) || undefined,
		damage_resistances: firstTextOf(r.damage_resistances) || undefined,
		damage_immunities: firstTextOf(r.damage_immunities) || undefined,
		condition_immunities: firstTextOf(r.condition_immunities) || undefined,
		senses: firstTextOf(r.senses) || undefined,
		languages: firstTextOf(r.languages) || undefined,
		cr: r.cr as string | number | undefined,
		traits: normalizeActions(r.traits),
		actions: normalizeActions(r.actions),
		bonus_actions: normalizeActions(r.bonus_actions),
		reactions: normalizeActions(r.reactions),
		legendary_actions: normalizeActions(r.legendary_actions),
		description: typeof r.description === "string" ? r.description : undefined,
	};
}

export function abilityMod(score: number): string {
	const mod = Math.floor((score - 10) / 2);
	return `${mod >= 0 ? "+" : ""}${mod}`;
}
