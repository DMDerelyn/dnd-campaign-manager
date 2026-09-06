import { TFile, normalizePath } from "obsidian";
import type { App } from "obsidian";

export { parseSecrets } from "./parser";
export type { SecretEntry } from "./parser";

/**
 * Secrets & Clues pool per Sly Flourish's Return of the Lazy Dungeon Master.
 *
 * Stored as a simple markdown file per campaign at
 * `<campaignRoot>/Secrets.md` with GFM task-list syntax:
 *   - [ ] unrevealed secret
 *   - [x] revealed secret — Session N
 *
 * Plain markdown so DMs can edit by hand in Live Preview (checking a box
 * manually marks it revealed).
 */
export const SECRETS_FILENAME = "Secrets.md";

function secretsPath(campaignRoot: string): string {
	return normalizePath(`${campaignRoot}/${SECRETS_FILENAME}`);
}

export async function getOrCreateSecretsFile(
	app: App,
	campaignRoot: string,
): Promise<TFile> {
	const path = secretsPath(campaignRoot);
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) return existing;
	const initial = `# Secrets & Clues

> *Sly Flourish's Lazy DM pool. Add secrets you want the players to eventually discover. Check them off as they do. Unrevealed secrets roll forward to the next session.*

## Unrevealed

## Revealed
`;
	return app.vault.create(path, initial);
}

export async function addSecret(
	app: App,
	campaignRoot: string,
	text: string,
): Promise<void> {
	const sanitized = text.replace(/\s+/g, " ").trim();
	if (!sanitized) throw new Error("Secret text is empty.");
	const file = await getOrCreateSecretsFile(app, campaignRoot);
	const line = `- [ ] ${sanitized}`;
	const header = "## Unrevealed";
	await app.vault.process(file, (content) => {
		const idx = content.indexOf(header);
		if (idx === -1) {
			const suffix = content.endsWith("\n") ? "" : "\n";
			return `${content}${suffix}\n${header}\n${line}\n`;
		}
		const insertAt = idx + header.length;
		return content.slice(0, insertAt) + `\n${line}` + content.slice(insertAt);
	});
}

/**
 * Mark a specific unrevealed secret revealed. Moves its line from the
 * Unrevealed section to the Revealed section, tagging it with the session
 * reference so the DM can see when each clue surfaced.
 */
export async function revealSecret(
	app: App,
	campaignRoot: string,
	text: string,
	sessionRef: string,
): Promise<void> {
	const file = await getOrCreateSecretsFile(app, campaignRoot);
	let missing = false;
	await app.vault.process(file, (content) => {
		const lines = content.split("\n");
		const targetIdx = lines.findIndex((l) => {
			const m = l.match(/^\s*-\s*\[\s\]\s*(.+?)\s*$/);
			return m !== null && m[1] === text;
		});
		if (targetIdx === -1) {
			missing = true;
			return content;
		}
		lines.splice(targetIdx, 1);
		const revealedHeader = lines.findIndex((l) => l.match(/^## Revealed\b/i));
		const newLine = `- [x] ${text} \u2014 ${sessionRef}`;
		if (revealedHeader === -1) {
			lines.push("", "## Revealed", newLine);
		} else {
			lines.splice(revealedHeader + 1, 0, newLine);
		}
		return lines.join("\n");
	});
	if (missing) throw new Error("Could not find that secret as unrevealed.");
}