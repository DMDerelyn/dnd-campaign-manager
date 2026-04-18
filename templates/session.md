<%*
const defaultTitle = `Session ${tp.date.now("YYYY-MM-DD")}`;
const name = tp.file.title === "Untitled" ? await tp.system.prompt("Session title", defaultTitle) : tp.file.title;
if (tp.file.title === "Untitled") await tp.file.rename(name);
const id = tp.user.campaignUlid?.() ?? tp.date.now("YYYYMMDDHHmmssSSS");
const numStr = await tp.system.prompt("Session number", "1");
-%>
---
id: <% id %>
kind: session
aliases: []
visibility: both
tags: [session]
schema_version: 1
number: <% numStr %>
date: <% tp.date.now("YYYY-MM-DD") %>
in_game_date:
pcs_present: []
strong_start: ""
scenes: []
secrets_revealed: []
loot: []
xp: 0
summary_player: ""
summary_gm: ""
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
updated: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
---

# <% name %>

## Strong start

## Potential scenes
- [ ]

## Secrets & clues (Lazy DM pool)
- 

## Fantastic locations

## Important NPCs

## Monsters / hazards

## Magic item rewards

---

## Session log

%%gm-only%%
## GM notes (private)

%%/gm-only%%
