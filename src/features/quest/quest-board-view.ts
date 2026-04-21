import { ItemView, WorkspaceLeaf, TFile, Notice } from "obsidian";
import type CampaignPlugin from "../../main";
import type { IndexedEntity } from "../../core/entity-index";
import type { QuestState } from "../../schemas";

export const QUEST_BOARD_VIEW_TYPE = "campaign-quest-board";

const STATE_ORDER: QuestState[] = [
	"hook",
	"active",
	"completed",
	"failed",
	"abandoned",
];

const STATE_SET: ReadonlySet<string> = new Set(STATE_ORDER);

interface Objective {
	text: string;
	done: boolean;
}

export class QuestBoardView extends ItemView {
	private detach: (() => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CampaignPlugin,
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
		this.detach = this.plugin.entityIndex.onChange(() => this.render());
	}

	async onClose(): Promise<void> {
		this.detach?.();
		this.detach = null;
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("campaign-quest-board");

		const quests = this.plugin.entityIndex.byKind("quest");
		contentEl.createEl("h3", { text: `Quest board (${quests.length})` });

		if (quests.length === 0) {
			const empty = contentEl.createDiv({ cls: "campaign-quest-empty" });
			empty.createEl("p", {
				text: "No quests yet.",
				cls: "campaign-init-empty",
			});
			const btn = empty.createEl("button", {
				text: "Create a quest",
				cls: "campaign-init-btn",
			});
			btn.addEventListener("click", async () => {
				const name = await this.plugin.promptText("New quest name");
				if (!name) return;
				const file = await this.plugin.createEntity("quest", name);
				await this.app.workspace.getLeaf(false).openFile(file);
			});
			return;
		}

		const grouped = groupByState(quests);

		for (const state of STATE_ORDER) {
			const bucket = grouped.get(state) ?? [];
			if (bucket.length === 0) continue;
			const section = contentEl.createEl("section", { cls: "campaign-quest-section" });
			section.createEl("h4", { text: `${state} (${bucket.length})`, cls: `campaign-quest-state-${state}` });
			const list = section.createEl("ul", { cls: "campaign-quest-list" });
			for (const q of bucket) {
				this.renderQuestRow(list, q);
			}
		}
	}

	private renderQuestRow(list: HTMLElement, q: IndexedEntity): void {
		const li = list.createEl("li", { cls: "campaign-quest-row" });

		const head = li.createDiv({ cls: "campaign-quest-head" });

		const link = head.createEl("a", { text: q.name, cls: "campaign-quest-link" });
		link.addEventListener("click", (e) => {
			e.preventDefault();
			const file = this.app.vault.getAbstractFileByPath(q.path);
			if (file instanceof TFile) {
				this.app.workspace.getLeaf(false).openFile(file);
			}
		});

		const currentState = normalizeState(q.frontmatter.state);
		const select = head.createEl("select", { cls: "campaign-quest-state-select" });
		for (const s of STATE_ORDER) {
			const opt = select.createEl("option", { text: s, value: s });
			if (s === currentState) opt.selected = true;
		}
		select.addEventListener("change", () => {
			const next = select.value;
			if (!STATE_SET.has(next)) return;
			this.setQuestState(q.path, next as QuestState).catch((err) => {
				console.error("Quest state update failed:", err);
				new Notice(`Could not update state: ${(err as Error).message}`);
			});
		});

		const deadline = typeof q.frontmatter.deadline === "string"
			? q.frontmatter.deadline.trim()
			: "";
		if (deadline) {
			const overdue = isOverdue(deadline);
			head.createEl("span", {
				text: `due ${deadline}`,
				cls: `campaign-quest-deadline${overdue ? " campaign-quest-deadline-overdue" : ""}`,
			});
		}

		const giver = q.frontmatter.giver;
		if (typeof giver === "string" && giver.trim().length > 0) {
			li.createEl("div", {
				text: `giver: ${stripLink(giver)}`,
				cls: "campaign-quest-giver",
			});
		}

		const objectives = parseObjectives(q.frontmatter.objectives);
		if (objectives.length > 0) {
			const objList = li.createEl("ul", { cls: "campaign-quest-objectives" });
			objectives.forEach((obj, idx) => {
				const row = objList.createEl("li", { cls: "campaign-quest-objective" });
				const cb = row.createEl("input", { type: "checkbox" });
				cb.checked = obj.done;
				const label = row.createEl("span", {
					text: obj.text,
					cls: obj.done ? "campaign-quest-objective-done" : undefined,
				});
				cb.addEventListener("change", () => {
					this.toggleObjective(q.path, idx, cb.checked).catch((err) => {
						console.error("Objective toggle failed:", err);
						new Notice(`Could not update objective: ${(err as Error).message}`);
						// Revert the visible state — the index change will
						// re-render authoritatively, but do it now for feel.
						cb.checked = !cb.checked;
						if (cb.checked) label.addClass("campaign-quest-objective-done");
						else label.removeClass("campaign-quest-objective-done");
					});
				});
			});
		}
	}

	private async setQuestState(path: string, next: QuestState): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm.state = next;
			fm.updated = new Date().toISOString();
		});
	}

	private async toggleObjective(path: string, index: number, done: boolean): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			const current = parseObjectives(fm.objectives);
			if (index < 0 || index >= current.length) return;
			current[index] = { text: current[index].text, done };
			fm.objectives = current;
			fm.updated = new Date().toISOString();
		});
	}
}

function groupByState(quests: IndexedEntity[]): Map<QuestState, IndexedEntity[]> {
	const map = new Map<QuestState, IndexedEntity[]>();
	for (const q of quests) {
		const state = normalizeState(q.frontmatter.state);
		const bucket = map.get(state);
		if (bucket) bucket.push(q);
		else map.set(state, [q]);
	}
	return map;
}

function normalizeState(raw: unknown): QuestState {
	if (typeof raw === "string" && STATE_SET.has(raw)) return raw as QuestState;
	return "hook";
}

function parseObjectives(raw: unknown): Objective[] {
	if (!Array.isArray(raw)) return [];
	const out: Objective[] = [];
	for (const item of raw) {
		if (item && typeof item === "object" && "text" in item) {
			const rec = item as Record<string, unknown>;
			const text = typeof rec.text === "string" ? rec.text : "";
			if (!text) continue;
			out.push({ text, done: rec.done === true });
		} else if (typeof item === "string" && item.trim().length > 0) {
			// Tolerate a plain-string objective form.
			out.push({ text: item, done: false });
		}
	}
	return out;
}

function isOverdue(deadline: string): boolean {
	// Compare YYYY-MM-DD lexically; any ISO date prefix compares correctly.
	const today = new Date().toISOString().slice(0, 10);
	const d = deadline.slice(0, 10);
	return /^\d{4}-\d{2}-\d{2}$/.test(d) && d < today;
}

function stripLink(s: string): string {
	return s.replace(/^\[\[(.+?)(\|.+)?\]\]$/, "$1");
}
