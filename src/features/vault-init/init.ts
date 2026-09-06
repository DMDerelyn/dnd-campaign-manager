import type { App } from "obsidian";
import { Notice, TFile } from "obsidian";
import type { CampaignSettings } from "../../settings";
import { ulid } from "../../core/ulid";
import { resolveCampaignSubfolder } from "../../core/path-safety";

export const ENTITY_TEMPLATES: Record<string, string> = {
	npc: `---
id: {{ID}}
kind: npc
aliases: []
visibility: gm
tags: [npc]
schema_version: 1
disposition: neutral
status: alive
role:
race:
factions: []
location:
friends: []
enemies: []
rivals: []
family: []
secrets: []
created: {{NOW}}
updated: {{NOW}}
---

# {{NAME}}

## Appearance
> *Describe what the players see when they first encounter this NPC — build, clothing, distinguishing marks, posture.*

## Personality
> *How do they behave? What's their demeanor? Think of one or two adjectives: "suspicious and meticulous" or "boisterous and generous."*

**Ideal:**
**Bond:**
**Flaw:**

## Voice & Mannerisms
> *A short note for roleplaying. Do they stutter? Speak in third person? Fidget with a coin? Use a catchphrase?*

**Catchphrase:**

## Secrets (GM Only)
%%gm-only%%
-
%%/gm-only%%

## Plot Hooks
-

## Relationship Details
> *Free-form notes about this NPC's relationships — history, dynamics, tension. The NPC Relationship Graph pulls from the flat frontmatter fields (friends, enemies, rivals, family, factions) above; this section is for the richer story behind them.*

## Notes
`,

	pc: `---
id: {{ID}}
kind: pc
aliases: []
visibility: both
tags: [pc]
schema_version: 1
player:
class:
subclass:
level: 1
race:
background:
alignment:
hp:
  current: 10
  max: 10
  temp: 0
ac: 10
speed: 30
initiative_bonus: 0
stats:
  str: 10
  dex: 10
  con: 10
  int: 10
  wis: 10
  cha: 10
saves: {}
skills: {}
spell_slots: {}
inventory: []
dndbeyond_url:
created: {{NOW}}
updated: {{NOW}}
---

# {{NAME}}

## Backstory
> *Where did they come from? What formative event set them on the adventuring path?*

**Birthplace:**
**Family:**

## Personality
**Traits:**
**Ideal:**
**Bond:**
**Flaw:**

## Goals
- **Short-term:**
- **Long-term:**

## Relationships
-

## Milestones & Key Moments
-

## Notes
`,

	quest: `---
id: {{ID}}
kind: quest
aliases: []
visibility: gm
tags: [quest]
schema_version: 1
state: hook
giver:
location:
objectives: []
rewards: []
related: []
secrets: []
deadline:
hook:
created: {{NOW}}
updated: {{NOW}}
---

# {{NAME}}

> *Objectives are tracked in frontmatter and edited from the Quest Board. The sections below are freeform notes.*

## Hook
> *How do the players learn about this quest? A desperate NPC? A posted bounty? An overheard rumor at the tavern?*

## Complications
> *What makes this harder than it seems? A twist, a moral dilemma, a rival group, a ticking clock.*

## Key Clues
-

## Resolution
> *What happens when the quest is completed or failed? What changes in the world?*

**Success:**
**Failure:**

## Rewards
-

## Related NPCs
-

## GM Notes
%%gm-only%%

%%/gm-only%%
`,

	location: `---
id: {{ID}}
kind: location
aliases: []
visibility: both
tags: [location]
schema_version: 1
type: poi
parent:
population:
ruler:
map_image:
fog_revealed: []
pins: []
created: {{NOW}}
updated: {{NOW}}
---

# {{NAME}}

## Description
> *What do the players experience when they arrive? Write for the senses.*

**Sights:**
**Sounds:**
**Smells:**

## Notable Features
-

## Inhabitants & NPCs Present
-

## Secrets & Hidden Areas
%%gm-only%%
-
%%/gm-only%%

## Hooks & Events
> *What might happen here? Random encounters, scheduled events, things triggered by player actions.*
-

## Travel Connections
> *How do players get here and where can they go from here?*
-

## Notes
`,

	session: `---
id: {{ID}}
kind: session
aliases: []
visibility: both
tags: [session]
schema_version: 1
number: 1
date: {{DATE}}
in_game_date:
pcs_present: []
strong_start: ""
scenes: []
secrets_revealed: []
loot: []
xp: 0
summary_player: ""
summary_gm: ""
created: {{NOW}}
updated: {{NOW}}
---

# {{NAME}}

## Strong Start
> *Open with action or tension. What scene drops the players right into something interesting?*

## Potential Scenes
- [ ]

## Secrets & Clues (Lazy DM Pool)
> *10 secrets or clues that can be discovered in any order, through any means. Move unused ones to the next session.*
-
-
-

## Fantastic Locations
> *Interesting places the characters might visit this session. One evocative detail each.*
-

## Important NPCs
> *Which NPCs might appear? What do they want?*
-

## Monsters & Hazards
> *Potential combat encounters or environmental dangers.*
-

## Magic Item Rewards
-

---

## Session Log
> *Notes captured during play.*

%%gm-only%%
## GM Notes (Private)
> *Post-session reflections: what worked, what to change, what to prep for next time.*

%%/gm-only%%
`,

	faction: `---
id: {{ID}}
kind: faction
aliases: []
visibility: gm
tags: [faction]
schema_version: 1
alignment:
goals: []
leader:
headquarters:
members: []
allies: []
enemies: []
influence: 5
created: {{NOW}}
updated: {{NOW}}
---

# {{NAME}}

## Overview
> *Who are they? What is their public face? What do common folk know about them?*

## Goals & Methods
> *What do they want, and how do they pursue it? Are their methods overt or covert?*
- **Primary Goal:**
- **Methods:**

## Leadership
-

## Known Members
-

## Assets & Holdings
> *What resources do they control? Gold, territory, political influence, magical artifacts?*
-

## Relationships
- **Allies:**
- **Enemies:**

## Progress Clocks
> *Track faction goals as segmented clocks (e.g., 0/6 segments). Advance when the faction acts or events unfold.*
- [ ] Goal: (0/6)

## Secrets
%%gm-only%%
-
%%/gm-only%%
`,

	item: `---
id: {{ID}}
kind: item
aliases: []
visibility: both
tags: [item]
schema_version: 1
rarity: common
attunement: false
owner:
weight:
value_gp:
properties: []
cursed: false
charges:
created: {{NOW}}
updated: {{NOW}}
---

# {{NAME}}

## Description
> *What does it look like? What material is it made of? Any distinctive markings or aura?*

## Properties
> *Mechanical effects. Copy the format from the DMG or use plain English.*

## Attunement
> *Requirements and effects of attunement, if any.*

## History
> *Who made it? How old is it? Has it had famous owners?*

## Side Effects / Curse
%%gm-only%%

%%/gm-only%%

## Notes
`,
};

export async function initializeCampaignVault(
	app: App,
	settings: CampaignSettings,
	campaignName: string,
): Promise<void> {
	const kinds = ["pc", "npc", "quest", "location", "session", "faction", "item"] as const;
	const root = settings.campaignRoot;

	for (const kind of kinds) {
		await ensureFolder(app, `${root}/${settings.folders[kind]}`);
	}

	const mapsPath = resolveCampaignSubfolder(root, settings.mapsFolder);
	if (mapsPath) {
		await ensureFolder(app, mapsPath);
	}

	await ensureFolder(app, "Templates/Campaign");
	await ensureFolder(app, "Templates/Scripts");

	let templatesCreated = 0;
	for (const [kind, content] of Object.entries(ENTITY_TEMPLATES)) {
		const path = `Templates/Campaign/${kind}.md`;
		const existing = app.vault.getAbstractFileByPath(path);
		if (!existing) {
			const populated = content
				.replace(/\{\{ID\}\}/g, "TEMPLATE-ID")
				.replace(/\{\{NAME\}\}/g, "{{NAME}}")
				.replace(/\{\{NOW\}\}/g, "TEMPLATE-DATE")
				.replace(/\{\{DATE\}\}/g, "TEMPLATE-DATE");
			await app.vault.create(path, populated);
			templatesCreated++;
		}
	}

	const tmplMsg = templatesCreated > 0
		? `${templatesCreated} new template(s) created`
		: "templates unchanged (already exist)";
	new Notice(`Campaign "${campaignName}" initialized!\nFolders: ${root}/\n${tmplMsg}`);
}

export function populateTemplate(template: string, name: string): string {
	const now = new Date().toISOString();
	const date = now.slice(0, 10);
	return template
		.replace(/\{\{ID\}\}/g, ulid())
		.replace(/\{\{NAME\}\}/g, name)
		.replace(/\{\{NOW\}\}/g, now)
		.replace(/\{\{DATE\}\}/g, date);
}

async function ensureFolder(app: App, path: string): Promise<void> {
	if (!path) return;
	const parts = path.split("/");
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			await app.vault.createFolder(current);
		}
	}
}
