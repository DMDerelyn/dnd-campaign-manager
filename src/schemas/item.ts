import { z } from "zod";
import { BaseEntity, Wikilink } from "./common";

export const ItemRarity = z.enum([
	"common",
	"uncommon",
	"rare",
	"very-rare",
	"legendary",
	"artifact",
]);

export const ItemSchema = BaseEntity.extend({
	kind: z.literal("item"),
	rarity: ItemRarity.default("common"),
	attunement: z.boolean().default(false),
	owner: Wikilink.optional(),
	weight: z.number().nonnegative().optional(),
	value_gp: z.number().nonnegative().optional(),
	properties: z.array(z.string()).default([]),
	cursed: z.boolean().default(false),
	charges: z.number().int().nonnegative().optional(),
});
export type Item = z.infer<typeof ItemSchema>;
