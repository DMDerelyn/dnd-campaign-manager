interface TrieNode {
	children: Map<string, TrieNode>;
	value?: string;
}

/**
 * Case-insensitive trie for alias lookup. Stored values are the canonical
 * alias string; longest-match-wins is enforced by caller.
 */
export class AliasTrie {
	private root: TrieNode = { children: new Map() };

	insert(alias: string): void {
		let node = this.root;
		const key = alias.toLowerCase();
		for (const ch of key) {
			let next = node.children.get(ch);
			if (!next) {
				next = { children: new Map() };
				node.children.set(ch, next);
			}
			node = next;
		}
		node.value = alias;
	}

	/**
	 * Scan `text` starting at `from`. Returns the longest alias that starts
	 * at that offset, or undefined if none match. Treats alphanumeric boundaries.
	 */
	longestMatchAt(text: string, from: number): { alias: string; length: number } | undefined {
		const lower = text.toLowerCase();
		let node = this.root;
		let best: { alias: string; length: number } | undefined;
		for (let i = from; i < lower.length; i++) {
			const next = node.children.get(lower[i]);
			if (!next) break;
			node = next;
			if (node.value !== undefined) {
				const endCh = lower[i + 1];
				if (!endCh || !isWordChar(endCh)) {
					best = { alias: node.value, length: i - from + 1 };
				}
			}
		}
		return best;
	}

	size(): number {
		return this.countValues(this.root);
	}

	private countValues(n: TrieNode): number {
		let c = n.value !== undefined ? 1 : 0;
		for (const child of n.children.values()) c += this.countValues(child);
		return c;
	}
}

function isWordChar(ch: string): boolean {
	return /[A-Za-z0-9_]/.test(ch);
}

export function isWordBoundary(text: string, i: number): boolean {
	if (i <= 0) return true;
	return !isWordChar(text[i - 1]);
}
