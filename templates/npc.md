<%*
const name = tp.file.title === "Untitled" ? await tp.system.prompt("NPC name") : tp.file.title;
if (tp.file.title === "Untitled") await tp.file.rename(name);
const id = tp.user.campaignUlid?.() ?? tp.date.now("YYYYMMDDHHmmssSSS");
-%>
---
id: <% id %>
kind: npc
aliases: []
visibility: gm
tags: [npc]
disposition: neutral
status: alive
role:
race:
factions: []
location:
relationships: []
secrets: []
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
updated: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
---

# <% name %>

## Appearance

## Personality

## Voice / mannerisms

## Bonds, goals, secrets

## Notes
