import { z } from "zod";

export const EntityKind = z.enum([
	"pc",
	"npc",
	"quest",
	"location",
	"session",
	"faction",
	"item",
]);
export type EntityKind = z.infer<typeof EntityKind>;

export const Visibility = z.enum(["gm", "player", "both"]);
export type Visibility = z.infer<typeof Visibility>;

const WikilinkRegex = /^\[\[[^[\]]+\]\]$/;
export const Wikilink = z
	.string()
	.regex(WikilinkRegex, "must be a wikilink of the form [[Target]]");

export const WikilinkArray = z.array(Wikilink).default([]);

export const ULID = z
	.string()
	.regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "must be a ULID");

const IsoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/, "must be ISO 8601 date");

export const BaseEntity = z.object({
	id: ULID,
	kind: EntityKind,
	aliases: z.array(z.string().min(1)).default([]),
	visibility: Visibility.default("gm"),
	tags: z.array(z.string()).default([]),
	created: IsoDate.optional(),
	updated: IsoDate.optional(),
	schema_version: z.number().int().nonnegative().default(1),
	canonical_name: z.string().min(1).optional(),
	summary: z.string().max(240).optional(),
});
export type BaseEntity = z.infer<typeof BaseEntity>;
