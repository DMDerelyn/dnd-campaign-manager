import { Notice, TFile } from "obsidian";
import type { Editor } from "obsidian";
import type CampaignPlugin from "../../main";
import type { EntityKind, QuestState } from "../../schemas";
import { EntityPickerModal } from "../../ui/modals/entity-picker";

const QUEST_STATES: QuestState[] = [
	"hook",
	"active",
	"completed",
	"failed",
	"abandoned",
];
const QUEST_STATE_SET: ReadonlySet<string> = new Set(QUEST_STATES);

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
					const options = kind === "npc"
						? {
								suggestLabel: "Generate name",
								suggest: () => plugin.generateNPCName(),
							}
						: undefined;
					name = (await plugin.promptText(`New ${kind} name`, options)) ?? "";
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

	const questStateCommand: SlashCommand = {
		trigger: "quest state",
		description: "Change a quest's state (hook/active/completed/failed/abandoned)",
		async run({ plugin, tail, replace }) {
			replace("");
			const parsed = parseQuestStateTail(tail);
			const quest = parsed.name
				? (plugin.entityIndex
						.byKind("quest")
						.find((q) => q.name.toLowerCase() === parsed.name.toLowerCase())
					?? await new EntityPickerModal(
						plugin.app,
						plugin.entityIndex,
						["quest"],
						`No quest named "${parsed.name}" — pick one…`,
					).pick())
				: await new EntityPickerModal(
					plugin.app,
					plugin.entityIndex,
					["quest"],
					"Pick a quest…",
				).pick();
			if (!quest) return;

			const state = parsed.state
				?? (await plugin.pickFromList(
					`New state for "${quest.name}"`,
					QUEST_STATES as unknown as string[],
				));
			if (!state || !QUEST_STATE_SET.has(state)) return;

			const file = plugin.app.vault.getAbstractFileByPath(quest.path);
			if (!(file instanceof TFile)) {
				new Notice(`Could not open ${quest.path}`);
				return;
			}
			try {
				await plugin.app.fileManager.processFrontMatter(file, (fm) => {
					fm.state = state;
					fm.updated = new Date().toISOString();
				});
				new Notice(`${quest.name} → ${state}`);
			} catch (err) {
				new Notice(`Could not update quest: ${(err as Error).message}`);
			}
		},
	};

	return [...entityCommands, rollCommand, linkCommand, logCommand, questStateCommand];
}

/**
 * Accept `"<name> <state>"`, `"<state>"`, or `""`. State must be one of
 * QUEST_STATES; anything else is treated as part of the name.
 */
function parseQuestStateTail(tail: string): { name: string; state: QuestState | null } {
	const trimmed = tail.trim();
	if (!trimmed) return { name: "", state: null };
	const lastSpace = trimmed.lastIndexOf(" ");
	if (lastSpace === -1) {
		// Single token — could be a state OR a name.
		if (QUEST_STATE_SET.has(trimmed.toLowerCase())) {
			return { name: "", state: trimmed.toLowerCase() as QuestState };
		}
		return { name: trimmed, state: null };
	}
	const maybeState = trimmed.slice(lastSpace + 1).toLowerCase();
	if (QUEST_STATE_SET.has(maybeState)) {
		return {
			name: trimmed.slice(0, lastSpace).trim(),
			state: maybeState as QuestState,
		};
	}
	return { name: trimmed, state: null };
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
