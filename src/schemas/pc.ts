import { z } from "zod";
import { BaseEntity, Wikilink, WikilinkArray } from "./common";

const Stats = z.object({
	str: z.number().int().min(1).max(30),
	dex: z.number().int().min(1).max(30),
	con: z.number().int().min(1).max(30),
	int: z.number().int().min(1).max(30),
	wis: z.number().int().min(1).max(30),
	cha: z.number().int().min(1).max(30),
});

const HP = z.object({
	current: z.number().int(),
	max: z.number().int().positive(),
	temp: z.number().int().nonnegative().default(0),
});

export const PCSchema = BaseEntity.extend({
	kind: z.literal("pc"),
	player: z.string().min(1).optional(),
	class: z.string().min(1),
	subclass: z.string().optional(),
	level: z.number().int().min(1).max(20),
	race: z.string().min(1),
	background: z.string().optional(),
	alignment: z.string().optional(),
	hp: HP,
	ac: z.number().int().min(0),
	speed: z.number().int().nonnegative().default(30),
	initiative_bonus: z.number().int().default(0),
	stats: Stats,
	saves: z.record(z.string(), z.number().int()).default({}),
	skills: z.record(z.string(), z.number().int()).default({}),
	spell_slots: z.record(z.string(), z.number().int().nonnegative()).default({}),
	inventory: WikilinkArray,
	faction: Wikilink.optional(),
	dndbeyond_url: z.string().url().optional(),
	dndbeyond_imported_at: z.string().optional(),
});
export type PC = z.infer<typeof PCSchema>;
