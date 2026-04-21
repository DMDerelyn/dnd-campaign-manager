<%*
const name = tp.file.title === "Untitled" ? await tp.system.prompt("Quest title") : tp.file.title;
if (tp.file.title === "Untitled") await tp.file.rename(name);
const id = tp.user.campaignUlid?.() ?? tp.date.now("YYYYMMDDHHmmssSSS");
-%>
---
id: <% id %>
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
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
updated: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
---

# <% name %>

> *Objectives are tracked in frontmatter and edited from the Quest Board. The sections below are freeform notes.*

## Hook

## Complications

## Resolution
