<%*
const name = tp.file.title === "Untitled" ? await tp.system.prompt("Item name") : tp.file.title;
if (tp.file.title === "Untitled") await tp.file.rename(name);
const id = tp.user.campaignUlid?.() ?? tp.date.now("YYYYMMDDHHmmssSSS");
-%>
---
id: <% id %>
kind: item
aliases: []
visibility: both
tags: [item]
rarity: common
attunement: false
owner:
properties: []
cursed: false
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
updated: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
---

# <% name %>

## Description

## Properties

## History
