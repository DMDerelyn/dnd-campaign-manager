import { describe, it, expect } from "vitest";
import { parseSecrets } from "../src/features/secrets/parser";

describe("parseSecrets", () => {
	it("parses unrevealed and revealed items", () => {
		const content = `## Unrevealed
- [ ] The innkeeper is a werewolf
- [ ] The map was forged by a demon

## Revealed
- [x] The duke's daughter is the oracle \u2014 [[Session 3]]`;

		const items = parseSecrets(content);
		expect(items).toHaveLength(3);
		expect(items[0]).toMatchObject({
			text: "The innkeeper is a werewolf",
			revealed: false,
		});
		expect(items[2]).toMatchObject({
			text: "The duke's daughter is the oracle",
			revealed: true,
			revealedNote: "[[Session 3]]",
		});
	});

	it("ignores non-checkbox lines", () => {
		const content = `# Header\n- a bullet\n- [ ] a secret`;
		expect(parseSecrets(content)).toHaveLength(1);
	});

	it("accepts uppercase X for revealed", () => {
		const content = `- [X] shouted secret`;
		const items = parseSecrets(content);
		expect(items[0].revealed).toBe(true);
	});
});
