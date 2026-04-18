<%*
const name = tp.file.title === "Untitled" ? await tp.system.prompt("Location name") : tp.file.title;
if (tp.file.title === "Untitled") await tp.file.rename(name);
const id = tp.user.campaignUlid?.() ?? tp.date.now("YYYYMMDDHHmmssSSS");
-%>
---
id: <% id %>
kind: location
aliases: []
visibility: both
tags: [location]
schema_version: 1
type: poi
parent:
map_image:
fog_revealed: []
pins: []
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
updated: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
---

# <% name %>

## Description

## Notable features

## NPCs present

## Hooks
