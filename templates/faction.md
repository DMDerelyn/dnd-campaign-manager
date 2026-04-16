<%*
const name = tp.file.title === "Untitled" ? await tp.system.prompt("Faction name") : tp.file.title;
if (tp.file.title === "Untitled") await tp.file.rename(name);
const id = tp.user.campaignUlid?.() ?? tp.date.now("YYYYMMDDHHmmssSSS");
-%>
---
id: <% id %>
kind: faction
aliases: []
visibility: gm
tags: [faction]
alignment:
goals: []
leader:
headquarters:
members: []
allies: []
enemies: []
influence: 5
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
updated: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
---

# <% name %>

## Overview

## Goals & methods

## Known members

## Assets & holdings
