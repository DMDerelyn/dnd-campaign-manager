import { z } from "zod";
import { BaseEntity, Wikilink, WikilinkArray } from "./common";

export const Disposition = z.enum([
	"hostile",
	"unfriendly",
	"neutral",
	"friendly",
	"allied",
]);

export const NPCStatus = z.enum(["alive", "dead", "missing", "unknown"]);

const Relationship = z.object({
	target: Wikilink,
	kind: z.string().min(1),
	notes: z.string().optional(),
});

export const NPCSchema = BaseEntity.extend({
	kind: z.literal("npc"),
	disposition: Disposition.default("neutral"),
	status: NPCStatus.default("alive"),
	role: z.string().optional(),
	race: z.string().optional(),
	factions: WikilinkArray,
	location: Wikilink.optional(),
	relationships: z.array(Relationship).default([]),
	statblock: z.string().optional(),
	cr: z.union([z.number(), z.string()]).optional(),
	first_seen: Wikilink.optional(),
	secrets: z.array(z.string()).default([]),
});
export type NPC = z.infer<typeof NPCSchema>;
