<%*
const name = tp.file.title === "Untitled" ? await tp.system.prompt("Character name") : tp.file.title;
if (tp.file.title === "Untitled") await tp.file.rename(name);
const id = tp.user.campaignUlid?.() ?? tp.date.now("YYYYMMDDHHmmssSSS");
-%>
---
id: <% id %>
kind: pc
aliases: []
visibility: both
tags: [pc]
schema_version: 1
player:
class:
level: 1
race:
background:
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
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
updated: <% tp.date.now("YYYY-MM-DDTHH:mm:ss") %>
---

# <% name %>

## Backstory

## Goals

## Bonds

## Notes
