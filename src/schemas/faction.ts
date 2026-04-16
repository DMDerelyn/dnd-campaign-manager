import { z } from "zod";
import { BaseEntity, Wikilink, WikilinkArray } from "./common";

export const FactionSchema = BaseEntity.extend({
	kind: z.literal("faction"),
	alignment: z.string().optional(),
	goals: z.array(z.string()).default([]),
	leader: Wikilink.optional(),
	headquarters: Wikilink.optional(),
	members: WikilinkArray,
	allies: WikilinkArray,
	enemies: WikilinkArray,
	influence: z.number().int().min(0).max(10).default(5),
});
export type Faction = z.infer<typeof FactionSchema>;
