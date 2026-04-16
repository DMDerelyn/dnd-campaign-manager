import { z } from "zod";
import { BaseEntity, Wikilink } from "./common";

export const LocationType = z.enum([
	"region",
	"settlement",
	"dungeon",
	"poi",
	"realm",
	"plane",
]);

const Pin = z.object({
	x: z.number(),
	y: z.number(),
	target: Wikilink,
	label: z.string().optional(),
});

const FogPolygon = z.object({
	points: z.array(z.tuple([z.number(), z.number()])).min(3),
});

export const LocationSchema = BaseEntity.extend({
	kind: z.literal("location"),
	type: LocationType.default("poi"),
	parent: Wikilink.optional(),
	population: z.number().int().nonnegative().optional(),
	ruler: Wikilink.optional(),
	map_image: z.string().optional(),
	fog_revealed: z.array(FogPolygon).default([]),
	pins: z.array(Pin).default([]),
});
export type Location = z.infer<typeof LocationSchema>;
