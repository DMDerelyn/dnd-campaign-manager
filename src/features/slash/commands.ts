import type { Editor } from "obsidian";
import type CampaignPlugin from "../../main";
import type { EntityKind } from "../../schemas";

export interface SlashCommand {
	trigger: string;
	description: string;
	/** Execute replaces the `/trigger...` text that was matched. */
	run(args: SlashArgs): Promise<void> | void;
}

export interface SlashArgs {
	plugin: CampaignPlugin;
	editor: Editor;
	/** Raw text the user typed after the trigger, e.g. "Goruk name=Goruk". */
	tail: string;
	/** Replace the matched `/trigger tail` span with given text. */
	replace(text: string): void;
}

const KIND_TRIGGERS: Record<string, EntityKind> = {
	"add npc": "npc",
	"add pc": "pc",
	"add quest": "quest",
	"add location": "location",
	"add faction": "faction",
	"add item": "item",
};

export function buildSlashCommands(): SlashCommand[] {
	const entityCommands: SlashCommand[] = Object.entries(KIND_TRIGGERS).map(
		([trigger, kind]) => ({
			trigger,
			description: `Create a new ${kind} entity and insert a link`,
			async run({ plugin, tail, replace }) {
				let name = tail.trim();
				if (!name) {
					name = await plugin.promptText(`New ${kind} name`) ?? "";
					if (!name) {
						replace("");
						return;
					}
				}
				replace(`[[${name}]]`);
				await plugin.createEntity(kind, name);
			},
		}),
	);

	const rollCommand: SlashCommand = {
		trigger: "roll",
		description: "Roll dice (e.g. /roll 2d6+3)",
		run({ tail, replace }) {
			const expr = tail.trim() || "1d20";
			const result = rollExpression(expr);
			replace(`\`${expr} = ${result.total}\` (${result.rolls.join(", ")})`);
		},
	};

	const linkCommand: SlashCommand = {
		trigger: "link",
		description: "Insert a wikilink picked from the campaign index",
		run({ plugin, replace }) {
			plugin.promptEntityPicker().then((entity) => {
				if (entity) replace(`[[${entity.name}]]`);
				else replace("");
			});
		},
	};

	const logCommand: SlashCommand = {
		trigger: "log event",
		description: "Insert a timestamped event line",
		run({ tail, replace }) {
			const text = tail.trim();
			const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
			replace(`- **${ts}** — ${text}`);
		},
	};

	return [...entityCommands, rollCommand, linkCommand, logCommand];
}

export function rollExpression(expr: string): { total: number; rolls: number[] } {
	const match = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
	if (!match) return { total: 0, rolls: [] };
	const count = parseInt(match[1], 10);
	const sides = parseInt(match[2], 10);
	const mod = match[3] ? parseInt(match[3], 10) : 0;
	const rolls: number[] = [];
	for (let i = 0; i < count; i++) {
		rolls.push(1 + Math.floor(Math.random() * sides));
	}
	const total = rolls.reduce((a, b) => a + b, 0) + mod;
	return { total, rolls };
}
