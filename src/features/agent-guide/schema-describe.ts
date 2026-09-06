import type { z } from "zod";

export interface FieldDescriptor {
	name: string;
	/** Human-readable type, e.g. `enum: a | b`, `wikilink (`[[Target]]`)`, `integer (>= 0)`. */
	type: string;
	required: boolean;
	/** JSON-encoded default, when the schema declares one. */
	default?: string;
}

/**
 * Walk a Zod object schema and produce a flat, readable description of every
 * frontmatter field it accepts. The agent guide is generated from this so it
 * can never drift from the real schemas.
 */
export function describeObjectSchema(schema: z.ZodTypeAny): FieldDescriptor[] {
	const shape = unwrapToObjectShape(schema);
	if (!shape) return [];
	return Object.entries(shape).map(([name, raw]) => describeField(name, raw));
}

// --- Minimal structural views of Zod v3 internals ---------------------------
// `_def` is not part of Zod's public types. Rather than reach for `any`, this
// module models just the fields it reads and narrows access through `defOf`.

type ZodRawShape = Record<string, z.ZodTypeAny>;

interface ZodCheck {
	kind: string;
	value?: number;
	inclusive?: boolean;
	regex?: RegExp;
}

interface ZodDefLike {
	typeName?: string;
	innerType?: z.ZodTypeAny;
	schema?: z.ZodTypeAny;
	type?: z.ZodTypeAny;
	valueType?: z.ZodTypeAny;
	shape?: (() => ZodRawShape) | ZodRawShape;
	checks?: ZodCheck[];
	values?: string[];
	value?: unknown;
	options?: z.ZodTypeAny[];
	defaultValue?: () => unknown;
}

function defOf(schema: z.ZodTypeAny | undefined): ZodDefLike | undefined {
	if (!schema || typeof schema !== "object") return undefined;
	const def = (schema as { _def?: unknown })._def;
	// Every field of ZodDefLike is optional, so a plain object satisfies it.
	return def && typeof def === "object" ? def : undefined;
}

function unwrapToObjectShape(schema: z.ZodTypeAny): ZodRawShape | null {
	let cur: z.ZodTypeAny | undefined = schema;
	for (let i = 0; i < 10; i++) {
		const def = defOf(cur);
		if (!def) break;
		if (def.typeName === "ZodObject") {
			return typeof def.shape === "function"
				? def.shape()
				: (def.shape ?? null);
		}
		if (def.typeName === "ZodEffects" && def.schema) {
			cur = def.schema;
			continue;
		}
		// Transparent wrapper: keep unwrapping toward the object.
		if (def.typeName === "ZodBranded" && def.type) {
			cur = def.type;
			continue;
		}
		if (def.innerType) {
			cur = def.innerType;
			continue;
		}
		break;
	}
	return null;
}

function describeField(name: string, schema: z.ZodTypeAny): FieldDescriptor {
	let cur: z.ZodTypeAny | undefined = schema;
	let required = true;
	let defaultValue: string | undefined;

	for (let i = 0; i < 12; i++) {
		const def = defOf(cur);
		if (!def) break;
		if (def.typeName === "ZodOptional") {
			required = false;
			cur = def.innerType;
			continue;
		}
		if (def.typeName === "ZodNullable") {
			cur = def.innerType;
			continue;
		}
		if (def.typeName === "ZodDefault") {
			required = false;
			try {
				const value = def.defaultValue?.();
				defaultValue = value === undefined ? undefined : JSON.stringify(value);
			} catch {
				defaultValue = undefined;
			}
			cur = def.innerType;
			continue;
		}
		if (def.typeName === "ZodEffects" && def.schema) {
			cur = def.schema;
			continue;
		}
		// Transparent wrappers that don't change the value's shape.
		if (
			(def.typeName === "ZodCatch" || def.typeName === "ZodReadonly") &&
			def.innerType
		) {
			cur = def.innerType;
			continue;
		}
		if (def.typeName === "ZodBranded" && def.type) {
			cur = def.type;
			continue;
		}
		break;
	}

	const descriptor: FieldDescriptor = { name, type: typeName(cur), required };
	if (defaultValue !== undefined) descriptor.default = defaultValue;
	return descriptor;
}

function typeName(schema: z.ZodTypeAny | undefined): string {
	const def = defOf(schema);
	if (!def) return "unknown";
	switch (def.typeName) {
		case "ZodString":
			return stringType(def);
		case "ZodNumber": {
			const checks = def.checks ?? [];
			const base = checks.some((c) => c.kind === "int") ? "integer" : "number";
			let lo: string | undefined;
			let hi: string | undefined;
			for (const c of checks) {
				if (c.kind === "min") {
					lo = `${c.inclusive === false ? ">" : ">="} ${c.value}`;
				}
				if (c.kind === "max") {
					hi = `${c.inclusive === false ? "<" : "<="} ${c.value}`;
				}
			}
			if (lo && hi) return `${base} (${lo}, ${hi})`;
			if (lo) return `${base} (${lo})`;
			if (hi) return `${base} (${hi})`;
			return base;
		}
		case "ZodBoolean":
			return "boolean";
		case "ZodEnum":
			return `enum: ${(def.values ?? []).join(" | ")}`;
		case "ZodNativeEnum":
			return "enum";
		case "ZodLiteral":
			return `literal ${JSON.stringify(def.value)}`;
		case "ZodArray":
			return `${typeName(def.type)}[]`;
		case "ZodObject":
			return "object";
		case "ZodRecord":
			return `record<string, ${typeName(def.valueType)}>`;
		case "ZodTuple":
			return "tuple";
		case "ZodUnion":
		case "ZodDiscriminatedUnion": {
			const names = (def.options ?? []).map((o) => typeName(o));
			return names.length ? names.join(" | ") : "union";
		}
		case "ZodEffects":
			return typeName(def.schema);
		case "ZodOptional":
		case "ZodNullable":
		case "ZodDefault":
		case "ZodCatch":
		case "ZodReadonly":
			return typeName(def.innerType);
		case "ZodBranded":
			return typeName(def.type);
		default:
			// Unknown / unsupported wrapper (ZodLazy, ZodPipeline, ZodIntersection,
			// ZodMap, ZodSet, ZodPromise, …). None appear in this project's
			// schemas; fall back to a neutral label rather than leaking an
			// internal type name into the guide.
			return "unknown";
	}
}

function stringType(def: ZodDefLike): string {
	for (const c of def.checks ?? []) {
		if (c.kind !== "regex") continue;
		const src = String(c.regex ?? "");
		if (src.includes("\\[\\[")) return "wikilink (`[[Target]]`)";
		if (src.includes("0-9A-HJKMNP-TV-Z]{26}")) return "ULID";
		if (src.includes("\\d{4}-\\d{2}-\\d{2}")) return "date (ISO 8601)";
	}
	return "string";
}
