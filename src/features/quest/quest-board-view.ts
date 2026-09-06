import { ItemView, WorkspaceLeaf, TFile, Notice } from "obsidian";
import type CampaignPlugin from "../../main";
import type { IndexedEntity } from "../../core/entity-index";
import type { QuestState } from "../../schemas";

export const QUEST_BOARD_VIEW_TYPE = "campaign-quest-board";

const VISIBLE_STATES: ReadonlySet<QuestState> = new Set(["hook", "active"]);
const SPREAD_MIN_WIDTH = 860;

export class QuestBoardView extends ItemView {
	private detachIndex: (() => void) | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private dragPath: string | null = null;

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
		this.detachIndex = this.plugin.entityIndex.onChange(() => this.render());

		// Re-render on width changes so we can swap between spread/column.
		this.resizeObserver = new ResizeObserver(() => this.render());
		this.resizeObserver.observe(this.contentEl);
	}

	async onClose(): Promise<void> {
		this.detachIndex?.();
		this.detachIndex = null;
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("campaign-quest-board");

		const visible = this.collectVisibleQuests();

		if (visible.length === 0) {
			this.renderEmpty(contentEl);
			return;
		}

		const wide = contentEl.clientWidth >= SPREAD_MIN_WIDTH;
		if (wide) this.renderSpread(contentEl, visible);
		else this.renderColumn(contentEl, visible);
	}

	private collectVisibleQuests(): IndexedEntity[] {
		const order = this.plugin.settings.questOrder ?? {};
		const NEW_BUCKET = Number.MAX_SAFE_INTEGER;
		return this.plugin
			.byKindInActiveCampaign("quest")
			.filter((q) => VISIBLE_STATES.has(normalizeState(q.frontmatter.state)))
			.sort((a, b) => {
				const ao = order[a.path] ?? NEW_BUCKET;
				const bo = order[b.path] ?? NEW_BUCKET;
				if (ao !== bo) return ao - bo;
				return a.name.localeCompare(b.name);
			});
	}

	private renderEmpty(parent: HTMLElement): void {
		const empty = parent.createDiv({ cls: "campaign-quest-empty" });
		const page = empty.createDiv({ cls: "campaign-quest-vellum" });
		page.createEl("p", {
			text: "The tavern is quiet tonight…",
			cls: "campaign-quest-empty-line",
		});
		page.createEl("p", {
			text: "No contracts are pinned to the ledger. Pour a drink and wait — someone always comes through the door.",
			cls: "campaign-quest-empty-sub",
		});
		const btn = page.createEl("button", {
			text: "Post a contract",
			cls: "campaign-quest-empty-btn",
		});
		btn.addEventListener("click", () => {
			void (async () => {
				const name = await this.plugin.promptText("New quest title");
				if (!name) return;
				const file = await this.plugin.createEntity("quest", name);
				await this.app.workspace.getLeaf(false).openFile(file);
			})();
		});
	}

	private renderColumn(parent: HTMLElement, quests: IndexedEntity[]): void {
		const stage = parent.createDiv({ cls: "campaign-quest-stage" });
		const column = stage.createDiv({ cls: "campaign-quest-column" });
		this.renderPageHeader(column, "Active Contracts", quests.length);
		for (const q of quests) this.renderEntry(column, q, /*compact*/ true);
	}

	private renderSpread(parent: HTMLElement, quests: IndexedEntity[]): void {
		const stage = parent.createDiv({ cls: "campaign-quest-stage" });
		const spread = stage.createDiv({ cls: "campaign-quest-spread" });

		const mid = Math.ceil(quests.length / 2);
		const left = quests.slice(0, mid);
		const right = quests.slice(mid);

		const leftPage = spread.createDiv({
			cls: "campaign-quest-page campaign-quest-page-left",
		});
		this.renderPageHeader(leftPage, "Active Contracts", quests.length);
		for (const q of left) this.renderEntry(leftPage, q, /*compact*/ false);

		spread.createDiv({ cls: "campaign-quest-spine" });

		const rightPage = spread.createDiv({
			cls: "campaign-quest-page campaign-quest-page-right",
		});
		this.renderPageHeader(rightPage, `Entries — ${quests.length}`, quests.length);
		for (const q of right) this.renderEntry(rightPage, q, /*compact*/ false);
	}

	private renderPageHeader(parent: HTMLElement, label: string, _count: number): void {
		const header = parent.createDiv({ cls: "campaign-quest-page-header" });
		header.createDiv({ cls: "campaign-quest-page-rule" });
		header.createSpan({ text: label, cls: "campaign-quest-page-label" });
		header.createDiv({ cls: "campaign-quest-page-rule" });
	}

	private renderEntry(
		parent: HTMLElement,
		quest: IndexedEntity,
		compact: boolean,
	): void {
		const article = parent.createEl("article", {
			cls: `campaign-quest-entry${compact ? " is-compact" : ""}`,
		});
		article.draggable = true;
		article.setAttr("data-quest-path", quest.path);

		article.addEventListener("dragstart", (e) => this.onDragStart(e, quest.path));
		article.addEventListener("dragover", (e) => this.onDragOver(e, quest.path));
		article.addEventListener("drop", (e) => this.onDrop(e, quest.path));
		article.addEventListener("dragend", () => this.onDragEnd());
		article.addEventListener("click", (e) => {
			// Avoid opening the note when the click came from the seal.
			if ((e.target as HTMLElement).closest(".campaign-quest-seal")) return;
			this.openQuest(quest.path);
		});

		// Section sign in the gutter.
		const gutter = article.createDiv({ cls: "campaign-quest-gutter" });
		gutter.setAttr("aria-hidden", "true");
		gutter.createSpan({ text: "§", cls: "campaign-quest-gutter-mark" });

		// Body: title, reward, hook prose, footer.
		const body = article.createDiv({ cls: "campaign-quest-body" });

		const head = body.createDiv({ cls: "campaign-quest-head" });
		head.createEl("h3", { text: quest.name, cls: "campaign-quest-title" });

		const reward = formatReward(quest.frontmatter.rewards);
		if (reward) {
			const meta = head.createDiv({ cls: "campaign-quest-meta" });
			meta.createSpan({ text: "reward", cls: "campaign-quest-label" });
			meta.createSpan({ text: reward, cls: "campaign-quest-reward" });
		}

		const hook = typeof quest.frontmatter.hook === "string"
			? quest.frontmatter.hook.trim()
			: "";
		if (hook) {
			body.createEl("p", { text: hook, cls: "campaign-quest-hook" });
		}

		const foot = body.createDiv({ cls: "campaign-quest-foot" });
		const deadline = typeof quest.frontmatter.deadline === "string"
			? quest.frontmatter.deadline.trim()
			: "";
		if (deadline) {
			const deadlineEl = foot.createSpan({ cls: "campaign-quest-deadline" });
			deadlineEl.createSpan({ text: "by", cls: "campaign-quest-label" });
			deadlineEl.appendText(` ${deadline}`);
		} else {
			foot.createSpan({ cls: "campaign-quest-deadline campaign-quest-deadline-empty" });
		}
		foot.createSpan({
			text: noteLabel(quest.path),
			cls: "campaign-quest-note",
			attr: { title: quest.path },
		});

		// Wax seal — marks the quest complete.
		const sealWrap = article.createDiv({ cls: "campaign-quest-seal-wrap" });
		const seal = sealWrap.createEl("button", {
			cls: "campaign-quest-seal",
			attr: {
				"aria-label": `Mark ${quest.name} complete`,
				"title": "Seal entry — marks complete",
				"type": "button",
			},
		});
		const sealInner = seal.createSpan({ cls: "campaign-quest-seal-inner" });
		sealInner.createSpan({ text: "❖", cls: "campaign-quest-seal-glyph" });
		seal.addEventListener("click", (e) => {
			e.stopPropagation();
			this.completeQuest(quest.path).catch((err) => {
				console.error("Quest complete failed:", err);
				new Notice(`Could not mark complete: ${(err as Error).message}`);
			});
		});
	}

	private openQuest(path: string): void {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			void this.app.workspace.getLeaf(false).openFile(file);
		}
	}

	private async completeQuest(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		await this.app.fileManager.processFrontMatter(
			file,
			(fm: Record<string, unknown>) => {
				fm.state = "completed";
				fm.updated = new Date().toISOString();
			},
		);
	}

	// ——— Drag-to-reorder ————————————————————————————————————

	private onDragStart(e: DragEvent, path: string): void {
		this.dragPath = path;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", path);
		}
		(e.currentTarget as HTMLElement).addClass("is-dragging");
	}

	private onDragOver(e: DragEvent, overPath: string): void {
		if (!this.dragPath || this.dragPath === overPath) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
	}

	private onDrop(e: DragEvent, overPath: string): void {
		e.preventDefault();
		const moved = this.dragPath;
		this.dragPath = null;
		if (!moved || moved === overPath) return;

		const visible = this.collectVisibleQuests().map((q) => q.path);
		const from = visible.indexOf(moved);
		const to = visible.indexOf(overPath);
		if (from < 0 || to < 0) return;

		const reordered = [...visible];
		const [m] = reordered.splice(from, 1);
		reordered.splice(to, 0, m);

		this.persistOrder(reordered).catch((err) => {
			console.error("Quest reorder save failed:", err);
		});
	}

	private onDragEnd(): void {
		this.dragPath = null;
		this.contentEl
			.querySelectorAll(".campaign-quest-entry.is-dragging")
			.forEach((el) => (el as HTMLElement).removeClass("is-dragging"));
	}

	private async persistOrder(orderedPaths: string[]): Promise<void> {
		const next: Record<string, number> = {};
		orderedPaths.forEach((p, i) => (next[p] = i));
		this.plugin.settings.questOrder = next;
		await this.plugin.saveSettings();
		this.render();
	}
}

function normalizeState(raw: unknown): QuestState {
	if (raw === "active" || raw === "completed" || raw === "failed" || raw === "abandoned") {
		return raw;
	}
	return "hook";
}

function formatReward(raw: unknown): string {
	if (!Array.isArray(raw)) return "";
	const parts: string[] = [];
	for (const item of raw) {
		if (typeof item !== "string") continue;
		const trimmed = stripWikilink(item.trim());
		if (trimmed) parts.push(trimmed);
	}
	return parts.join(" · ");
}

function stripWikilink(s: string): string {
	const m = s.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
	if (!m) return s;
	return (m[2] ?? m[1]).trim();
}

function noteLabel(path: string): string {
	const base = path.split("/").pop() ?? path;
	return base.replace(/\.md$/i, "");
}
