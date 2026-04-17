import { z } from "zod";
import { BaseEntity, Wikilink, WikilinkArray } from "./common";

const Stats = z.object({
	str: z.number().int().min(1).max(30).default(10),
	dex: z.number().int().min(1).max(30).default(10),
	con: z.number().int().min(1).max(30).default(10),
	int: z.number().int().min(1).max(30).default(10),
	wis: z.number().int().min(1).max(30).default(10),
	cha: z.number().int().min(1).max(30).default(10),
});

const HP = z.object({
	current: z.number().int().default(10),
	max: z.number().int().nonnegative().default(10),
	temp: z.number().int().nonnegative().default(0),
});

export const PCSchema = BaseEntity.extend({
	kind: z.literal("pc"),
	player: z.string().optional(),
	class: z.string().optional(),
	subclass: z.string().optional(),
	level: z.number().int().min(0).max(20).default(1),
	race: z.string().optional(),
	background: z.string().optional(),
	alignment: z.string().optional(),
	hp: HP.default({ current: 10, max: 10, temp: 0 }),
	ac: z.number().int().min(0).default(10),
	speed: z.number().int().nonnegative().default(30),
	initiative_bonus: z.number().int().default(0),
	stats: Stats.default({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
	saves: z.record(z.string(), z.number().int()).default({}),
	skills: z.record(z.string(), z.number().int()).default({}),
	spell_slots: z.record(z.string(), z.number().int().nonnegative()).default({}),
	inventory: WikilinkArray,
	faction: Wikilink.optional(),
	dndbeyond_url: z.string().url().optional(),
	dndbeyond_imported_at: z.string().optional(),
});
export type PC = z.infer<typeof PCSchema>;
