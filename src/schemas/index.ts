import { z, ZodError } from "zod";
import { PCSchema } from "./pc";
import { NPCSchema } from "./npc";
import { QuestSchema } from "./quest";
import { LocationSchema } from "./location";
import { SessionSchema } from "./session";
import { FactionSchema } from "./faction";
import { ItemSchema } from "./item";
import type { EntityKind } from "./common";

export * from "./common";
export * from "./pc";
export * from "./npc";
export * from "./quest";
export * from "./location";
export * from "./session";
export * from "./faction";
export * from "./item";

export const EntitySchema = z.discriminatedUnion("kind", [
	PCSchema,
	NPCSchema,
	QuestSchema,
	LocationSchema,
	SessionSchema,
	FactionSchema,
	ItemSchema,
]);
export type Entity = z.infer<typeof EntitySchema>;

export const SchemaByKind = {
	pc: PCSchema,
	npc: NPCSchema,
	quest: QuestSchema,
	location: LocationSchema,
	session: SessionSchema,
	faction: FactionSchema,
	item: ItemSchema,
} as const;

export interface ValidationIssue {
	path: string;
	message: string;
	severity: "error" | "warning";
}

export function validateFrontmatter(
	frontmatter: unknown,
): { ok: true; data: Entity } | { ok: false; issues: ValidationIssue[] } {
	const fm = frontmatter as { kind?: unknown } | null | undefined;
	if (!fm || typeof fm !== "object") {
		return {
			ok: false,
			issues: [{ path: "", message: "missing frontmatter", severity: "error" }],
		};
	}
	const kind = (fm).kind;
	if (typeof kind !== "string" || !(kind in SchemaByKind)) {
		return {
			ok: false,
			issues: [
				{
					path: "kind",
					message: `unknown or missing entity kind: ${String(kind)}`,
					severity: "error",
				},
			],
		};
	}
	const schema = SchemaByKind[kind as EntityKind];
	const cleaned = stripNulls(fm);
	const result = schema.safeParse(cleaned);
	if (result.success) return { ok: true, data: result.data };
	return { ok: false, issues: zodIssues(result.error) };
}

function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value === null) continue;
		out[key] = value;
	}
	return out;
}

function zodIssues(err: ZodError): ValidationIssue[] {
	return err.issues.map((i) => ({
		path: i.path.map(String).join("."),
		message: i.message,
		severity: "error",
	}));
}
