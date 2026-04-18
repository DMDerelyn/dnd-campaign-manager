import { describe, it, expect } from "vitest";
import { extractSessionLog } from "../src/features/timeline/parser";

describe("extractSessionLog", () => {
	it("returns empty array if no ## Session log section", () => {
		expect(extractSessionLog("# Just some note")).toEqual([]);
	});

	it("captures timestamped entries", () => {
		const note = `---
kind: session
---

# Session 1

## Session log
- **2026-04-16 19:30** \u2014 Party entered the tavern
- **2026-04-16 19:45** \u2014 Met [[Volo]]`;
		const entries = extractSessionLog(note);
		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({
			timestamp: "2026-04-16 19:30",
			text: "Party entered the tavern",
		});
		expect(entries[1].text).toBe("Met [[Volo]]");
	});

	it("captures plain bullets without timestamps", () => {
		const note = `## Session log
- Event: Party fled north
- Loot: 50gp`;
		const entries = extractSessionLog(note);
		expect(entries).toHaveLength(2);
		expect(entries[0].timestamp).toBeUndefined();
		expect(entries[0].text).toBe("Event: Party fled north");
	});

	it("stops at the next heading or gm-only fence", () => {
		const note = `## Session log
- Event: shown

## GM Notes
- Event: hidden`;
		const entries = extractSessionLog(note);
		expect(entries).toHaveLength(1);
		expect(entries[0].text).toBe("Event: shown");
	});

	it("stops at the gm-only fence", () => {
		const note = `## Session log
- Event: shown

%%gm-only%%
- Event: secret
%%/gm-only%%`;
		const entries = extractSessionLog(note);
		expect(entries).toHaveLength(1);
		expect(entries[0].text).toBe("Event: shown");
	});

	it("is case-insensitive for the Session log header", () => {
		const note = `## Session Log
- Event: works`;
		const entries = extractSessionLog(note);
		expect(entries).toHaveLength(1);
	});
});
