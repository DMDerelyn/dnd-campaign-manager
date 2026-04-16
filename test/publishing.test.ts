import { describe, it, expect } from "vitest";
import { stripGMContent, stripGMFrontmatter } from "../src/features/publishing/gm-stripper";

describe("stripGMContent", () => {
	it("removes %%gm-only%% fenced blocks", () => {
		const input = `Player stuff

%%gm-only%%
Secret plans
More secrets
%%/gm-only%%

More player stuff`;

		const result = stripGMContent(input);
		expect(result).toContain("Player stuff");
		expect(result).toContain("More player stuff");
		expect(result).not.toContain("Secret plans");
		expect(result).not.toContain("More secrets");
		expect(result).not.toContain("gm-only");
	});

	it("removes multiple fenced blocks", () => {
		const input = `A %%gm-only%%secret1%%/gm-only%% B %%gm-only%%secret2%%/gm-only%% C`;
		const result = stripGMContent(input);
		expect(result).toBe("A  B  C");
	});

	it("returns content unchanged if no fences", () => {
		const input = "Normal content\nNothing secret here.";
		expect(stripGMContent(input)).toBe(input);
	});
});

describe("stripGMFrontmatter", () => {
	it("removes secrets and summary_gm fields", () => {
		const fm = {
			kind: "npc",
			name: "Goruk",
			secrets: ["hidden motive"],
			summary_gm: "GM only notes",
			disposition: "friendly",
		};
		const result = stripGMFrontmatter(fm);
		expect(result).not.toHaveProperty("secrets");
		expect(result).not.toHaveProperty("summary_gm");
		expect(result).toHaveProperty("kind", "npc");
		expect(result).toHaveProperty("disposition", "friendly");
	});
});
