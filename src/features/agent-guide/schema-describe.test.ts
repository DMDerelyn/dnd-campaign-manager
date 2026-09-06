import { test } from "node:test";
import assert from "node:assert/strict";
import { describeObjectSchema } from "./schema-describe";
import { SchemaByKind } from "../../schemas";

test("describes base fields shared by every entity", () => {
	const fields = describeObjectSchema(SchemaByKind.npc);
	const byName = new Map(fields.map((f) => [f.name, f]));

	assert.equal(byName.get("id")?.type, "ULID");
	assert.equal(byName.get("id")?.required, true);

	const visibility = byName.get("visibility");
	assert.equal(visibility?.type, "enum: gm | player | both");
	assert.equal(visibility?.required, false);
	assert.equal(visibility?.default, '"gm"');

	const aliases = byName.get("aliases");
	assert.equal(aliases?.type, "string[]");
	assert.equal(aliases?.required, false);
});

test("describes the kind discriminator as a literal", () => {
	const fields = describeObjectSchema(SchemaByKind.faction);
	const kind = fields.find((f) => f.name === "kind");
	assert.equal(kind?.type, 'literal "faction"');
});

test("describes kind-specific fields with enums and wikilinks", () => {
	const npc = new Map(
		describeObjectSchema(SchemaByKind.npc).map((f) => [f.name, f]),
	);
	assert.equal(npc.get("disposition")?.type.startsWith("enum: "), true);

	const location = new Map(
		describeObjectSchema(SchemaByKind.location).map((f) => [f.name, f]),
	);
	assert.equal(location.get("parent")?.type, "wikilink (`[[Target]]`)");
	assert.equal(location.get("population")?.type, "integer (>= 0)");
});

test("describes record fields with their value type", () => {
	const pc = new Map(
		describeObjectSchema(SchemaByKind.pc).map((f) => [f.name, f]),
	);
	const saves = pc.get("saves");
	assert.ok(saves, "pc schema should still have a 'saves' field");
	assert.match(saves.type, /^record<string, /);
});

test("renders a union as its member types", () => {
	const npc = new Map(
		describeObjectSchema(SchemaByKind.npc).map((f) => [f.name, f]),
	);
	assert.equal(npc.get("cr")?.type, "number | string");
});

test("renders numeric min/max bounds as a range", () => {
	const faction = new Map(
		describeObjectSchema(SchemaByKind.faction).map((f) => [f.name, f]),
	);
	// influence: z.number().int().min(0).max(10)
	assert.equal(faction.get("influence")?.type, "integer (>= 0, <= 10)");
});

test("every entity kind introspects to a full field set (zod-compat guard)", () => {
	for (const kind of Object.keys(SchemaByKind) as (keyof typeof SchemaByKind)[]) {
		const fields = describeObjectSchema(SchemaByKind[kind]);
		assert.ok(
			fields.length >= 9,
			`${kind} introspected to only ${fields.length} fields — zod internals may have changed`,
		);
	}
});

test("returns an empty list for a non-object schema", () => {
	assert.deepEqual(describeObjectSchema(SchemaByKind.npc.shape.id), []);
});
