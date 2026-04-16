import { z } from "zod";
import { BaseEntity, Wikilink, WikilinkArray } from "./common";

const Scene = z.object({
	title: z.string().min(1),
	notes: z.string().optional(),
	resolved: z.boolean().default(false),
});

export const SessionSchema = BaseEntity.extend({
	kind: z.literal("session"),
	number: z.number().int().positive(),
	date: z.string(),
	in_game_date: z.string().optional(),
	pcs_present: WikilinkArray,
	strong_start: z.string().optional(),
	scenes: z.array(Scene).default([]),
	secrets_revealed: z.array(z.string()).default([]),
	loot: WikilinkArray,
	xp: z.number().int().nonnegative().default(0),
	summary_player: z.string().optional(),
	summary_gm: z.string().optional(),
	next_session: Wikilink.optional(),
});
export type Session = z.infer<typeof SessionSchema>;
