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

export const NPCSchema = BaseEntity.extend({
	kind: z.literal("npc"),
	disposition: Disposition.default("neutral"),
	status: NPCStatus.default("alive"),
	role: z.string().optional(),
	race: z.string().optional(),
	factions: WikilinkArray,
	location: Wikilink.optional(),
	// Flat relationship fields (editable in Obsidian's Properties panel).
	// Each is a list of wikilinks; the field name supplies the edge label
	// in the NPC relationship graph.
	friends: WikilinkArray,
	enemies: WikilinkArray,
	rivals: WikilinkArray,
	family: WikilinkArray,
	statblock: z.string().optional(),
	cr: z.union([z.number(), z.string()]).optional(),
	first_seen: Wikilink.optional(),
	secrets: z.array(z.string()).default([]),
});
export type NPC = z.infer<typeof NPCSchema>;
