import {
	EditorSuggest,
	type Editor,
	type EditorPosition,
	type EditorSuggestContext,
	type EditorSuggestTriggerInfo,
	type TFile,
} from "obsidian";
import type CampaignPlugin from "../../main";
import type { SlashCommand } from "./commands";

interface Match {
	command: SlashCommand;
	tail: string;
}

/**
 * EditorSuggest subclass that fires on `/` at line start or after whitespace.
 */
export class SlashSuggest extends EditorSuggest<Match> {
	constructor(
		private plugin: CampaignPlugin,
		private commands: SlashCommand[],
	) {
		super(plugin.app);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const before = line.slice(0, cursor.ch);
		const match = before.match(/(?:^|\s)\/([^/]*)$/);
		if (!match) return null;
		const query = match[1];
		const startCh = cursor.ch - query.length - 1;
		return {
			start: { line: cursor.line, ch: startCh },
			end: cursor,
			query,
		};
	}

	getSuggestions(context: EditorSuggestContext): Match[] {
		const raw = context.query;
		const q = raw.toLowerCase();
		return this.commands
			.map((command) => {
				if (q === "") return { command, tail: "" };
				if (command.trigger.startsWith(q)) return { command, tail: "" };
				if (q.startsWith(command.trigger + " ")) {
					return { command, tail: raw.slice(command.trigger.length + 1) };
				}
				if (q.startsWith(command.trigger)) {
					return { command, tail: raw.slice(command.trigger.length).trim() };
				}
				return null;
			})
			.filter((m): m is Match => m !== null);
	}

	renderSuggestion(match: Match, el: HTMLElement): void {
		el.addClass("campaign-slash-suggestion");
		el.createEl("span", { text: `/${match.command.trigger}`, cls: "campaign-slash-trigger" });
		el.createEl("span", { text: match.command.description, cls: "campaign-slash-desc" });
	}

	selectSuggestion(match: Match, _ev: MouseEvent | KeyboardEvent): void {
		const ctx = this.context;
		if (!ctx) return;
		const { editor, start, end } = ctx;
		match.command.run({
			plugin: this.plugin,
			editor,
			tail: match.tail,
			replace: (text) => editor.replaceRange(text, start, end),
		});
	}
}
