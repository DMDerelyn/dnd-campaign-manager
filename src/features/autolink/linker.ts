import { AliasTrie, isWordBoundary } from "./alias-trie";
import type { EntityIndex, IndexedEntity } from "../../core/entity-index";

export interface LinkPlan {
	output: string;
	replacements: number;
}

/**
 * Build a trie from the entity index's alias table and replace unlinked
 * occurrences of those aliases with `[[Alias]]` wikilinks. Skips content
 * inside existing wikilinks, code fences, inline code, and frontmatter.
 */
export function autolink(
	index: EntityIndex,
	source: string,
	campaignRoot?: string,
): LinkPlan {
	const entries = index.allAliases();
	if (entries.length === 0) return { output: source, replacements: 0 };

	const prefix = campaignRoot ? `${campaignRoot}/` : null;
	const trie = new AliasTrie();
	const aliasToEntity = new Map<string, IndexedEntity>();
	for (const { alias, entity } of entries) {
		if (alias.length < 2) continue;
		if (prefix && !entity.path.startsWith(prefix)) continue;
		trie.insert(alias);
		aliasToEntity.set(alias.toLowerCase(), entity);
	}

	const masks = computeMasks(source);
	const out: string[] = [];
	let i = 0;
	let replacements = 0;

	while (i < source.length) {
		if (masks[i]) {
			out.push(source[i]);
			i++;
			continue;
		}
		if (!isWordBoundary(source, i)) {
			out.push(source[i]);
			i++;
			continue;
		}
		const hit = trie.longestMatchAt(source, i);
		if (!hit) {
			out.push(source[i]);
			i++;
			continue;
		}
		const entity = aliasToEntity.get(hit.alias.toLowerCase());
		if (!entity) {
			out.push(source[i]);
			i++;
			continue;
		}
		const matchedText = source.slice(i, i + hit.length);
		const display = entity.name === matchedText ? `[[${entity.name}]]` : `[[${entity.name}|${matchedText}]]`;
		out.push(display);
		replacements++;
		i += hit.length;
	}

	return { output: out.join(""), replacements };
}

/**
 * Build a boolean mask of character offsets to skip (existing wikilinks,
 * code blocks, inline code, frontmatter block).
 */
function computeMasks(src: string): boolean[] {
	const mask = new Array<boolean>(src.length).fill(false);

	// Frontmatter block at top
	if (src.startsWith("---\n")) {
		const end = src.indexOf("\n---", 4);
		if (end !== -1) {
			for (let i = 0; i < end + 4; i++) mask[i] = true;
		}
	}

	// Fenced code blocks (``` ... ```)
	let inFence = false;
	let fenceStart = 0;
	for (let i = 0; i < src.length; i++) {
		if (src.startsWith("```", i) && (i === 0 || src[i - 1] === "\n")) {
			if (!inFence) {
				inFence = true;
				fenceStart = i;
			} else {
				for (let j = fenceStart; j < i + 3; j++) mask[j] = true;
				inFence = false;
			}
			i += 2;
		}
	}

	// Inline code (`...`)
	for (let i = 0; i < src.length; i++) {
		if (src[i] === "`") {
			const close = src.indexOf("`", i + 1);
			if (close === -1) break;
			for (let j = i; j <= close; j++) mask[j] = true;
			i = close;
		}
	}

	// Existing wikilinks [[...]]
	for (let i = 0; i < src.length - 1; i++) {
		if (src[i] === "[" && src[i + 1] === "[") {
			const close = src.indexOf("]]", i + 2);
			if (close === -1) break;
			for (let j = i; j < close + 2; j++) mask[j] = true;
			i = close + 1;
		}
	}

	// Markdown links [text](url) — skip the (url) part
	for (let i = 0; i < src.length; i++) {
		if (src[i] === "]" && src[i + 1] === "(") {
			const close = src.indexOf(")", i + 2);
			if (close === -1) break;
			for (let j = i + 1; j <= close; j++) mask[j] = true;
			i = close;
		}
	}

	return mask;
}
