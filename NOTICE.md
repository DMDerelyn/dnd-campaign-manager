# Third-Party Notices

This plugin vendors source from the following MIT-licensed projects. Each
upstream repository's LICENSE text is preserved alongside the vendored code.

Scheduled for v0.3.0 / v0.4.0 — attributions will be added when the vendored
code lands:

- **Fantasy Statblocks** — https://github.com/javalent/fantasy-statblocks (MIT)
- **Zoom Map** — https://github.com/Jareika/zoom-map (MIT)

When vendored, each fork lives under `src/vendor/<name>/` with its own
`ATTRIBUTION.md` recording the upstream commit SHA and any substantive edits,
and `UPSTREAM.md` tracking which upstream changes we have or have not picked
up.

## Shared Enum Source of Truth

The Zod definitions in `src/schemas/` are this plugin's authoritative
definition of the following enums. Any sibling tool in the campaign
ecosystem (Campaign Scribe, Smart Encounters, Smart Relations, or an
external `campaign-schema` package) that claims to interoperate with
vaults written by this plugin MUST accept exactly these values. Adding
or renaming a value requires a `schema_version` bump.

| Enum | File | Values |
|---|---|---|
| `EntityKind` | `src/schemas/common.ts` | `pc`, `npc`, `quest`, `location`, `session`, `faction`, `item` |
| `Visibility` | `src/schemas/common.ts` | `gm`, `player`, `both` |
| `Disposition` (NPC) | `src/schemas/npc.ts` | `hostile`, `unfriendly`, `neutral`, `friendly`, `allied` |
| `NPCStatus` | `src/schemas/npc.ts` | `alive`, `dead`, `missing`, `unknown` |
| `QuestState` | `src/schemas/quest.ts` | `hook`, `active`, `completed`, `failed`, `abandoned` |
| `LocationType` | `src/schemas/location.ts` | `region`, `settlement`, `dungeon`, `poi`, `realm`, `plane` |
| `ItemRarity` | `src/schemas/item.ts` | `common`, `uncommon`, `rare`, `very-rare`, `legendary`, `artifact` |

Every entity on disk carries `schema_version` (integer, defaults to `1`
when absent). Consumers that read vaults written by this plugin should
branch on that value when the envelope evolves.

Envelope fields guaranteed across all entity kinds:

- `id` (ULID string)
- `kind` (see `EntityKind`)
- `aliases: string[]`
- `visibility` (see `Visibility`)
- `tags: string[]`
- `schema_version: number`
- `canonical_name?: string` — optional; falls back to the note's file basename
- `summary?: string` — optional, ≤240 characters
- `created?`, `updated?` — ISO 8601 strings

Kind-specific fields live alongside these and are documented by each
schema file.
