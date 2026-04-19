import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type { EntityIndex, IndexedEntity } from "../../core/entity-index";
import type { QuestState } from "../../schemas";

export const QUEST_BOARD_VIEW_TYPE = "campaign-quest-board";

const STATE_ORDER: QuestState[] = [
	"hook",
	"active",
	"completed",
	"failed",
	"abandoned",
];

export class QuestBoardView extends ItemView {
	private detach: (() => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private index: EntityIndex,
	) {
		super(leaf);
	}

	getViewType(): string {
		return QUEST_BOARD_VIEW_TYPE;
	}
	getDisplayText(): string {
		return "Quest board";
	}
	getIcon(): string {
		return "scroll";
	}

	async onOpen(): Promise<void> {
		this.render();
		this.detach = this.index.onChange(() => this.render());
	}

	async onClose(): Promise<void> {
		this.detach?.();
		this.detach = null;
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("campaign-quest-board");

		const quests = this.index.byKind("quest");
		contentEl.createEl("h3", { text: `Quest board (${quests.length})` });

		const grouped = groupByState(quests);

		for (const state of STATE_ORDER) {
			const bucket = grouped.get(state) ?? [];
			if (bucket.length === 0) continue;
			const section = contentEl.createEl("section", { cls: "campaign-quest-section" });
			section.createEl("h4", { text: `${state} (${bucket.length})`, cls: `campaign-quest-state-${state}` });
			const list = section.createEl("ul", { cls: "campaign-quest-list" });
			for (const q of bucket) {
				const li = list.createEl("li");
				const link = li.createEl("a", { text: q.name, cls: "campaign-quest-link" });
				link.addEventListener("click", (e) => {
					e.preventDefault();
					const file = this.app.vault.getAbstractFileByPath(q.path);
					if (file instanceof TFile) {
						this.app.workspace.getLeaf(false).openFile(file);
					}
				});
				const giver = q.frontmatter.giver;
				if (typeof giver === "string") {
					li.createEl("span", { text: ` — giver: ${stripLink(giver)}`, cls: "campaign-quest-giver" });
				}
			}
		}
	}
}

function groupByState(quests: IndexedEntity[]): Map<QuestState, IndexedEntity[]> {
	const map = new Map<QuestState, IndexedEntity[]>();
	for (const q of quests) {
		const state = (q.frontmatter.state as QuestState) ?? "hook";
		const bucket = map.get(state);
		if (bucket) bucket.push(q);
		else map.set(state, [q]);
	}
	return map;
}

function stripLink(s: string): string {
	return s.replace(/^\[\[(.+?)(\|.+)?\]\]$/, "$1");
}
