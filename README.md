# Campaign Codex

Plan and run tabletop RPG campaigns entirely inside Obsidian. One plugin replaces a stack of single-purpose tools: typed entity management, a session runner dashboard, an in-house initiative tracker, an interactive map with fog of war, and more.

> **Device support:** Optimized for desktop and tablet use. Mobile (phone) is usable for quick additions and references — slash commands, secrets, quick notes, statblock reading, quest board, timeline — but canvas-based views (Campaign Map, NPC Relationship Graph) are not an ideal experience on small touch screens. Multi-panel layouts like the Session Runner also work best with a wider display.

---

## Quick Start

1. **Install** — Copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/dnd-campaign-manager/` folder. Enable the plugin in Settings > Community Plugins.
2. **Initialize your vault** — Open the command palette (`Ctrl/Cmd + P`) and run **"Campaign: Initialize Campaign Vault"**. Enter your campaign name (e.g., *Curse of Strahd*). This creates all the folders and templates you need. This can be done in an already existing vault.
3. **Create your first entity** — Run **"Campaign: Create NPC"** from the command palette, or type `/add npc Goruk the Mighty` in any note.

### Required Companion Plugins

| Plugin | Why |
|---|---|
| **Templater** | Powers entity creation from templates. Without it, the plugin uses built-in templates (still works, but Templater gives you customizable prompts). |
| **Dataview** | Enables advanced queries in your notes (e.g., "all NPCs in Waterdeep"). The plugin detects both and warns you in settings if they're missing. |

---

## Features

### Initialize Campaign Vault

**Command:** `Campaign: Initialize Campaign Vault`

Sets up a fresh vault for campaign management in seconds. Perfect for DMs who start a new vault for each campaign.

**What it creates:**
```
Campaign/
  PCs/
  NPCs/
  Quests/
  Locations/
  Sessions/
  Factions/
  Items/
Templates/
  Campaign/
    npc.md
    pc.md
    quest.md
    location.md
    session.md
    faction.md
    item.md
```

**Example:** You're starting *Waterdeep: Dragon Heist*. Run the command, type "Waterdeep: Dragon Heist", and you've got a fully organized vault ready to fill with NPCs, locations, and session prep.

---

### Entity Creation & Templates

**Commands:** `Campaign: Create NPC`, `Create PC`, `Create Quest`, `Create Location`, `Create Session`, `Create Faction`, `Create Item`

Each command prompts you for a name and creates a fully structured markdown file with frontmatter fields tailored to that entity type.

**Example — Creating an NPC:**
Run `Campaign: Create NPC` and type "Volothamp Geddarm". The plugin creates `Campaign/NPCs/Volothamp Geddarm.md` with:

```yaml
---
id: 01HXK...
kind: npc
disposition: neutral
status: alive
role:
race:
factions: []
location:
relationships: []
secrets: []
---
```

Plus sections for Appearance, Personality (Ideal/Bond/Flaw), Voice & Mannerisms, Secrets (GM-only), Plot Hooks, and Relationships.

**Templates live in your vault** at `Templates/Campaign/`. You can edit them to match your style — add custom sections, change the prompts, restructure as you like.

---

### Slash Commands

Type `/` in any note to access quick commands. A suggestion popup appears as you type.

| Command | What it does | Example |
|---|---|---|
| `/add npc <name>` | Creates an NPC file and inserts a `[[link]]` | `/add npc Xanathar` |
| `/add pc <name>` | Creates a PC file and inserts a link | `/add pc Elara Moonwhisper` |
| `/add quest <name>` | Creates a quest and inserts a link | `/add quest The Missing Diplomat` |
| `/add location <name>` | Creates a location and inserts a link | `/add location Yawning Portal` |
| `/add faction <name>` | Creates a faction and inserts a link | `/add faction Zhentarim` |
| `/add item <name>` | Creates an item and inserts a link | `/add item Cloak of Elvenkind` |
| `/roll <dice>` | Rolls dice and inserts the result | `/roll 2d6+3` |
| `/link` | Opens a picker to insert a link to any entity | `/link` |
| `/log event <text>` | Inserts a timestamped event line | `/log event Party enters the dungeon` |

**Tip:** If you type `/add npc` without a name, the plugin will prompt you for one instead of creating a dead link.

**Example — Mid-session notes:**
You're running a session and the party meets a new NPC. In your session note, type:

```
/add npc Renaer Neverember
```

This creates the NPC file, links it in your session note, and you can flesh out the NPC later. Then log what happened:

```
/log event Party rescued Renaer from the Zhentarim warehouse
/roll 2d6+3
```

Result: `- **2026-04-16 19:30** — Party rescued Renaer from the Zhentarim warehouse`
and: `` `2d6+3 = 11` (4, 4) ``

---

### Dice Rolling

Type `/roll` followed by standard dice notation.

| Expression | Meaning |
|---|---|
| `/roll 1d20` | Roll a d20 |
| `/roll 2d6+3` | Roll 2d6 and add 3 |
| `/roll 4d6-1` | Roll 4d6 and subtract 1 |
| `/roll 1d100` | Percentile roll |

The result is inserted inline: `` `1d20 = 15` (15) ``

---

### Auto-Linking

**Command:** `Campaign: Auto-link entities in current file`

Scans your note for entity names and wraps them in `[[wikilinks]]`. Knows all entity names and aliases. Respects existing links, code blocks, and frontmatter — won't double-link or break formatting.

**Example:** You write a session note with plain text:

```markdown
The party met Goruk at the Yawning Portal. He told them about the Zhentarim's plot.
```

Run the auto-link command and it becomes:

```markdown
The party met [[Goruk]] at the [[Yawning Portal]]. He told them about the [[Zhentarim]]'s plot.
```

---

### Quest Board

**Command:** `Campaign: Open Quest Board` | **Ribbon icon:** Scroll

A dedicated panel that groups all your quests by state: **Hook** (rumors the party hasn't engaged with), **Active**, **Completed**, **Failed**, **Abandoned**.

**Example:** You've created quests like "Find the Stone of Golorr" (active), "Rescue Floon" (completed), and "Investigate the Fireball" (hook). The Quest Board shows them grouped and color-coded. Click any quest to jump to its note.

**Quest states** are controlled by the `state:` field in quest frontmatter. Update it to `active`, `completed`, `failed`, or `abandoned` and the board updates automatically.

---

### Campaign Issues (Diagnostics)

**Command:** `Campaign: Open Campaign Issues`

Shows all entity files with schema validation errors — missing required fields, wrong types, invalid values. Like a linter for your campaign notes.

**Example:** You accidentally set an NPC's `disposition: grumpy` (not a valid value — should be hostile/unfriendly/neutral/friendly/allied). The diagnostics panel flags it with the file, field, and error message. Click the filename to jump there and fix it.

---

### Initiative Tracker

**Command:** `Campaign: Open Initiative Tracker` | **Ribbon icon:** Swords

A full combat tracker built into Obsidian. No external dependencies.

**Features:**
- **Add PCs from index** — One click pulls all your PC entities in with their HP, AC, and initiative bonuses
- **Add NPCs manually** — Name, HP, AC, initiative
- **Roll initiative** — "Roll All NPCs" button, or edit individual values
- **Track HP** — +1/+5/-1/-5 buttons, temp HP support, damage absorbs temp HP first
- **Conditions** — All 16 standard 5e conditions (blinded, charmed, frightened, etc.) plus Concentrating and Exhaustion
- **Turn tracking** — Round counter, current turn highlighted, forward/back navigation

**Example:** The party is ambushed by 3 goblins and a bugbear.

1. Click **Add PCs** — your 4 PCs appear with their stats from the entity index
2. Click **Add NPC** four times for the enemies (Goblin 1, Goblin 2, Goblin 3, Bugbear)
3. Click **Roll All NPCs** — goblins and bugbear get initiative rolls
4. Combat! Track HP with the +/- buttons. Toggle **prone** on a goblin when the fighter shoves it. Mark the wizard as **concentrating** on Hold Person.
5. The bugbear hits the rogue hard — click **-12** (hold -5, -5, -1, -1) or edit HP directly

---

### Session Runner

**Command:** `Campaign: Start Session (layout)` | **Ribbon icon:** Play

Opens a three-panel layout optimized for running a live game session:
- **Left sidebar:** Session Runner dashboard
- **Center:** Your session note in the editor
- **Right sidebar:** Initiative Tracker

**Session Runner features:**
- **Pick Session** — Load any session entity from the index
- **Quick Insert buttons** — Insert NPC Link, Roll, Event, Loot, Mark Secret Revealed
- **Session info panel** — Shows session number, date, PCs present, strong start
- **NPC panel** — Quick access to all campaign NPCs with disposition badges
- **Quick Note capture** — Type in the text box and hit Enter to append a timestamped line to the session log

**Example:** Session 12 of your campaign. You:
1. Run "Start Session" from the command palette
2. Pick "Session 12 - The Dragon's Lair"
3. Click "Open in Editor" to get your session note in the center pane
4. During play, use Quick Insert buttons to drop NPC links and log events
5. When combat starts, the Initiative Tracker is already open on the right
6. Use the Quick Note box to jot observations: "Players really enjoyed the puzzle with the colored gems"

---

### PC Sheet

**Command:** `Campaign: Open PC Sheet`

A read-only character sheet view that displays ability scores, combat stats, spell slots, and a link to the full note.

**Importing from D&D Beyond:**
1. Click **Import from DDB** in the PC Sheet view
2. Paste a D&D Beyond character URL (e.g., `https://www.dndbeyond.com/characters/12345678`) — the character must be set to **Public** on DDB
3. The plugin fetches the character data and creates a fully populated PC file

**Fallback:** If the URL doesn't work (character is private or DDB changes their API), paste the character's JSON export from the Beyond20 browser extension instead.

**Example:** Your player just leveled up on DDB. Paste their character URL into the importer and the PC file updates with new HP, spell slots, and ability scores.

---

### NPC Relationship Graph

**Command:** `Campaign: Open NPC Relationship Graph`

A canvas-based visual graph showing NPCs and factions as nodes, with edges drawn from `relationships`, `factions`, `allies`, and `enemies` frontmatter fields.

- **Drag nodes** to rearrange the layout
- **Double-click** a node to open that entity's note
- **Color-coded edges:** green = ally, red = enemy, gray = other relationships

**Example:** You've built out the Waterdeep faction network — Zhentarim, Xanathar Guild, Harpers, Lords' Alliance, Force Grey. Open the graph and instantly see who's allied, who's at war, and which NPCs belong to which faction. Drag the Xanathar node next to the Zhentarim to visually group the antagonists.

---

### Campaign Map

**Command:** `Campaign: Open Campaign Map`

An interactive map view with fog of war and pin placement.

**Setup:**
1. Create a Location entity with a `map_image:` field pointing to an image in your vault (e.g., `map_image: Maps/waterdeep.png`)
2. Open the Campaign Map and click **Pick Location**
3. Select your location — the map loads with full fog of war (map is hidden)

**Using the map:**
- **Pan:** Click and drag
- **Zoom:** Scroll wheel
- **Reveal fog:** Click "Fog: OFF" to toggle to "Fog: REVEAL", then paint circles on the map to uncover areas
- **Place pins:** Double-click anywhere (with fog mode off) to add a labeled pin
- **Navigate pins:** Double-click an existing pin to open its linked entity
- **Save:** Click "Save Fog/Pins" to persist revealed areas and pins to the location's frontmatter

**Example:** You have a dungeon map. As the party explores, toggle fog reveal and paint the rooms they've entered. Place pins labeled "Trapped Door", "Boss Room", "Secret Passage". The fog state saves to frontmatter so it persists between sessions.

---

## Settings Reference

| Setting | Default | Description |
|---|---|---|
| **Entity folders** | `Campaign/PCs`, etc. | Where new entities of each kind are created |
| **Strict validation** | Off | Show a notice when opening a file with schema errors |
| **Auto-link on save** | Off | Automatically rewrite entity names as wikilinks on save |
| **Excluded folders** | *(empty)* | Folders the plugin should ignore entirely — their contents won't appear in Campaign Issues or be indexed as entities |

---

## Entity Frontmatter Reference

Every entity file has YAML frontmatter that the plugin validates. Here are the key fields for each kind:

### NPC
```yaml
kind: npc
disposition: neutral    # hostile | unfriendly | neutral | friendly | allied
status: alive           # alive | dead | missing | unknown
role: Tavern keeper
race: Dwarf
factions: ["[[Zhentarim]]"]
location: "[[Yawning Portal]]"
relationships:
  - target: "[[Renaer Neverember]]"
    kind: rival
secrets: ["Secretly reports to Manshoon"]
```

### PC
```yaml
kind: pc
player: Alex
class: Wizard
level: 5
race: High Elf
hp: { current: 32, max: 38, temp: 0 }
ac: 15
stats: { str: 8, dex: 14, con: 12, int: 20, wis: 13, cha: 10 }
```

### Quest
```yaml
kind: quest
state: active           # hook | active | completed | failed | abandoned
giver: "[[Volothamp Geddarm]]"
objectives:
  - text: Find Floon Blagmaar
    done: true
  - text: Investigate the warehouse
    done: false
rewards: ["10 gold dragons", "A map to the Vault"]
```

### Location
```yaml
kind: location
type: settlement        # region | settlement | dungeon | poi | realm | plane
parent: "[[Sword Coast]]"
map_image: Maps/waterdeep.png
```

### Session
```yaml
kind: session
number: 12
date: 2026-04-16
pcs_present: ["[[Elara]]", "[[Goruk]]", "[[Theron]]"]
strong_start: "A fireball explodes in Trollskull Alley"
```

### Faction
```yaml
kind: faction
alignment: Lawful Evil
leader: "[[Manshoon]]"
influence: 7            # 0-10 scale
allies: ["[[Doom Raiders]]"]
enemies: ["[[Harpers]]"]
```

### Item
```yaml
kind: item
rarity: rare            # common | uncommon | rare | very-rare | legendary | artifact
attunement: true
cursed: false
owner: "[[Elara]]"
```

---

---

### Secrets & Clues Pool

**Commands:**
- `Secrets: Add a secret or clue to the pool`
- `Secrets: Reveal a secret to the players`
- `Secrets: Open pool file`

A Lazy DM pool of unrevealed plot threads for the current campaign. Stored as plain markdown at `Campaigns/<name>/Secrets.md` with GFM task-list syntax so you can also check boxes manually.

**Example:** During session prep you brainstorm 10 secrets the players could uncover. Run **"Add a secret or clue"** for each: *"The innkeeper is a werewolf"*, *"The map was forged by the BBEG"*. During play, when the party discovers one, run **"Reveal a secret"** — it moves from the Unrevealed section to Revealed, tagged with the current session. Any unrevealed secrets roll forward to the next session automatically.

---

### Statblock Rendering

Inline 5e-style monster statblocks via a `campaign-statblock` code block. DM-friendly YAML format, no external plugin dependency.

**Usage:**

~~~markdown
```campaign-statblock
name: Goblin
size: Small
type: humanoid (goblinoid)
alignment: Neutral Evil
ac: 15 (leather armor, shield)
hp: 7 (2d6)
speed: 30 ft.
stats:
  str: 8
  dex: 14
  con: 10
  int: 10
  wis: 8
  cha: 8
skills: Stealth +6
senses: darkvision 60 ft., passive Perception 9
languages: Common, Goblin
cr: 1/4
actions:
  - name: Scimitar
    text: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage."
  - name: Shortbow
    text: "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage."
```
~~~

Supports all 5e statblock fields: AC, HP, speed, stats, saves, skills, damage/condition immunities/resistances, senses, languages, CR, traits, actions, bonus actions, reactions, legendary actions. Missing fields just don't render.

---

### Name Generator

When creating an NPC — via the command palette or `/add npc` — the prompt includes a **Generate name** button. Click it to fill the field with a random fantasy-flavored name across 9 races (human, elf, dwarf, halfling, dragonborn, tiefling, gnome, half-orc, orc). Click again to cycle through suggestions. The generator is built-in and doesn't depend on any network call.

---

### Campaign Timeline

**Command:** `Open Campaign Timeline`

A chronological `ItemView` that aggregates every `## Session log` bullet from every session note in the active campaign. Sessions group by number (then date); entries within each session appear in their original order.

- **Filter box** at the top — type part of an entity name (e.g. `Goruk`) to show only lines that mention it.
- **Click a session title** to jump to the session note.
- Auto-refreshes when you switch campaigns or when the entity index changes.

**Example:** Halfway through a campaign you ask "wait, when did the party first meet Strahd?" Open the Timeline, type `Strahd` in the filter, scroll to the first match — it's right there with a session link.

---

## Command Reference

| Command | Description |
|---|---|
| Initialize Campaign Vault | Create all folders and templates for a new campaign |
| Switch Active Campaign (default) | Pick the default campaign when no campaign file is open |
| Create NPC / PC / Quest / etc. | Create a new entity from template |
| Open Quest Board | View quests grouped by state |
| Open Campaign Issues | View schema validation errors |
| Open Initiative Tracker | Combat tracker |
| Start Session (layout) | Three-panel session running layout |
| Open NPC Relationship Graph | Visual NPC/faction graph |
| Open PC Sheet | Character sheet viewer + DDB importer |
| Open Campaign Map | Interactive map with fog of war |
| Open Campaign Timeline | Chronological log of all session events |
| Secrets: Add / Reveal / Open pool | Lazy DM secrets & clues pool |
| Auto-link entities in current file | Convert entity names to wikilinks |
| Fix frontmatter position (current file) | Manual repair if another plugin injected content |

---

## Interoperability

The plugin is designed to stay usable on its own, and to interoperate cleanly with a future hosted memory service (`campaign-scribe`, planned for v0.6) and other tools in the same ecosystem.

Every entity writes an envelope with a version stamp:

- `id` (ULID), `kind`, `aliases`, `visibility`, `tags`
- `schema_version: 1`
- `canonical_name` (optional; falls back to the note's file name)
- `summary` (optional, ≤240 characters)
- `created`, `updated` (ISO 8601)

`NOTICE.md` lists the exact values of every shared enum (`EntityKind`, `Visibility`, `Disposition`, `NPCStatus`, `QuestState`, `LocationType`, `ItemRarity`). Renaming or adding a value is treated as a `schema_version` bump.

A few things the plugin **does not** adopt on purpose:

- **Flat relationship fields (`friends:`, `factions:`, etc.) remain canonical**, editable directly in Obsidian's Properties panel. When a central relationship service lands, it will merge with those fields rather than replace them — the offline, in-Obsidian experience stays first-class.
- **Per-character visibility** is not modeled. Files are `gm`, `player`, or `both`. Per-player fog of knowledge is a future concern, not a v0.1 field.
- **No codegen / shared npm package.** The Zod schemas here are hand-written and ~200 LoC total; pulling them through a generator for a single TypeScript consumer isn't worth the build complexity yet.

---

## License

MIT. See [LICENSE](LICENSE).

This plugin vendors code from [Fantasy Statblocks](https://github.com/javalent/fantasy-statblocks) (MIT) and [Zoom Map](https://github.com/Jareika/zoom-map) (MIT) — see [NOTICE.md](NOTICE.md) for attribution details. These are scheduled for integration in future releases.
