import { describe, it, expect } from "vitest";
import { AliasTrie } from "../src/features/autolink/alias-trie";

describe("AliasTrie", () => {
	it("finds exact prefix matches, longest first", () => {
		const t = new AliasTrie();
		t.insert("Goruk");
		t.insert("Goruk the Mighty");
		const text = "Goruk the Mighty smiled.";
		const m = t.longestMatchAt(text, 0);
		expect(m?.alias).toBe("Goruk the Mighty");
		expect(m?.length).toBe("Goruk the Mighty".length);
	});

	it("respects word boundaries", () => {
		const t = new AliasTrie();
		t.insert("Goruk");
		expect(t.longestMatchAt("Goruk.", 0)?.alias).toBe("Goruk");
		expect(t.longestMatchAt("Gorukite", 0)).toBeUndefined();
	});

	it("is case-insensitive for lookup but preserves canonical alias", () => {
		const t = new AliasTrie();
		t.insert("Goruk");
		const m = t.longestMatchAt("goruk smiled", 0);
		expect(m?.alias).toBe("Goruk");
	});

	it("returns undefined for no match", () => {
		const t = new AliasTrie();
		t.insert("Goruk");
		expect(t.longestMatchAt("Nobody", 0)).toBeUndefined();
	});
});
