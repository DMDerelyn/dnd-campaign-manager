import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from "obsidian";
import type CampaignPlugin from "../../main";
import type { IndexedEntity } from "../../core/entity-index";

export const SESSION_RUNNER_VIEW_TYPE = "campaign-session-runner";

export class SessionRunnerView extends ItemView {
	private sessionFile: TFile | null = null;
	private detach: (() => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CampaignPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return SESSION_RUNNER_VIEW_TYPE;
	}
	getDisplayText(): string {
		return "Session Runner";
	}
	getIcon(): string {
		return "play-circle";
	}

	async onOpen(): Promise<void> {
		this.render();
		this.detach = this.plugin.entityIndex.onChange(() => this.render());
	}

	async onClose(): Promise<void> {
		this.detach?.();
		this.detach = null;
	}

	setSessionFile(file: TFile): void {
		this.sessionFile = file;
		this.render();
	}

	private render(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("campaign-session-runner");

		this.renderHeader(el);
		this.renderQuickInsert(el);
		this.renderSessionInfo(el);
		this.renderNPCPanel(el);
		this.renderNoteCapture(el);
	}

	private renderHeader(el: HTMLElement): void {
		const header = el.createDiv({ cls: "campaign-sr-header" });
		const title = this.sessionFile?.basename ?? "No session loaded";
		header.createEl("h3", { text: title });

		const controls = header.createDiv({ cls: "campaign-sr-controls" });
		const pickBtn = controls.createEl("button", { text: "Pick Session", cls: "campaign-init-btn" });
		pickBtn.addEventListener("click", async () => {
			const sessions = this.plugin.entityIndex.byKind("session");
			if (sessions.length === 0) return;
			const picked = await this.plugin.promptEntityPicker();
			if (picked && picked.kind === "session") {
				const file = this.app.vault.getAbstractFileByPath(picked.path);
				if (file instanceof TFile) this.setSessionFile(file);
			}
		});

		const openBtn = controls.createEl("button", { text: "Open in Editor", cls: "campaign-init-btn" });
		openBtn.addEventListener("click", () => {
			if (this.sessionFile) {
				this.app.workspace.getLeaf("split").openFile(this.sessionFile);
			}
		});
	}

	private renderQuickInsert(el: HTMLElement): void {
		const panel = el.createDiv({ cls: "campaign-sr-quick" });
		panel.createEl("h4", { text: "Quick Insert" });
		const grid = panel.createDiv({ cls: "campaign-sr-quick-grid" });

		const actions: { label: string; action: () => void }[] = [
			{
				label: "Insert NPC Link",
				action: async () => {
					const entity = await this.plugin.promptEntityPicker();
					if (entity) this.insertIntoActiveEditor(`[[${entity.name}]]`);
				},
			},
			{
				label: "Insert Roll",
				action: () => this.insertIntoActiveEditor("`dice: 1d20`"),
			},
			{
				label: "Insert Event",
				action: () => {
					const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
					this.insertIntoActiveEditor(`\n- **${ts}** — `);
				},
			},
			{
				label: "Insert Loot",
				action: () => this.insertIntoActiveEditor("\n- [ ] Loot: "),
			},
			{
				label: "Mark Secret Revealed",
				action: () => this.insertIntoActiveEditor("\n> [!secret] Revealed: "),
			},
		];

		for (const a of actions) {
			const btn = grid.createEl("button", { text: a.label, cls: "campaign-sr-quick-btn" });
			btn.addEventListener("click", a.action);
		}
	}

	private renderSessionInfo(el: HTMLElement): void {
		if (!this.sessionFile) return;
		const entity = this.plugin.entityIndex.getByPath(this.sessionFile.path);
		if (!entity) return;

		const fm = entity.frontmatter;
		const info = el.createDiv({ cls: "campaign-sr-info" });
		info.createEl("h4", { text: "Session Info" });

		const fields: [string, unknown][] = [
			["Number", fm.number],
			["Date", fm.date],
			["In-game date", fm.in_game_date],
			["XP", fm.xp],
		];
		const table = info.createEl("table", { cls: "campaign-sr-info-table" });
		for (const [label, value] of fields) {
			if (value === undefined || value === null || value === "") continue;
			const tr = table.createEl("tr");
			tr.createEl("td", { text: label, cls: "campaign-sr-info-label" });
			tr.createEl("td", { text: String(value) });
		}

		const pcsPresent = fm.pcs_present;
		if (Array.isArray(pcsPresent) && pcsPresent.length > 0) {
			info.createEl("h5", { text: "PCs Present" });
			const pcList = info.createEl("ul");
			for (const pc of pcsPresent) {
				const li = pcList.createEl("li");
				this.renderEntityLink(li, String(pc));
			}
		}

		const strongStart = fm.strong_start;
		if (typeof strongStart === "string" && strongStart.length > 0) {
			info.createEl("h5", { text: "Strong Start" });
			info.createEl("p", { text: strongStart, cls: "campaign-sr-strong-start" });
		}
	}

	private renderNPCPanel(el: HTMLElement): void {
		const npcs = this.plugin.entityIndex.byKind("npc");
		if (npcs.length === 0) return;

		const panel = el.createDiv({ cls: "campaign-sr-npcs" });
		panel.createEl("h4", { text: `NPCs (${npcs.length})` });
		const list = panel.createDiv({ cls: "campaign-sr-npc-list" });
		for (const npc of npcs.slice(0, 20)) {
			const row = list.createDiv({ cls: "campaign-sr-npc-row" });
			const link = row.createEl("a", { text: npc.name, cls: "campaign-sr-npc-link" });
			link.addEventListener("click", (e) => {
				e.preventDefault();
				const file = this.app.vault.getAbstractFileByPath(npc.path);
				if (file instanceof TFile) this.app.workspace.getLeaf(false).openFile(file);
			});

			const disp = npc.frontmatter.disposition;
			if (typeof disp === "string") {
				row.createEl("span", { text: disp, cls: `campaign-sr-disp campaign-sr-disp-${disp}` });
			}

			const insertBtn = row.createEl("button", { text: "Insert", cls: "campaign-init-btn-sm" });
			insertBtn.addEventListener("click", () => {
				this.insertIntoActiveEditor(`[[${npc.name}]]`);
			});
		}
	}

	private renderNoteCapture(el: HTMLElement): void {
		const panel = el.createDiv({ cls: "campaign-sr-capture" });
		panel.createEl("h4", { text: "Quick Note" });

		const textarea = panel.createEl("textarea", {
			cls: "campaign-sr-capture-input",
			attr: { rows: "3", placeholder: "Type a note and press Enter to append to session..." },
		});
		textarea.addEventListener("keydown", async (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				const text = textarea.value.trim();
				if (!text || !this.sessionFile) return;
				await this.appendToSessionFile(text);
				textarea.value = "";
			}
		});
	}

	private async appendToSessionFile(text: string): Promise<void> {
		if (!this.sessionFile) return;
		const content = await this.app.vault.read(this.sessionFile);
		const logHeader = "## Session log";
		const idx = content.indexOf(logHeader);
		if (idx !== -1) {
			const insertAt = idx + logHeader.length;
			const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
			const line = `\n- **${ts}** — ${text}`;
			const updated = content.slice(0, insertAt) + line + content.slice(insertAt);
			await this.app.vault.modify(this.sessionFile, updated);
		} else {
			const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
			await this.app.vault.append(this.sessionFile, `\n- **${ts}** — ${text}`);
		}
	}

	private insertIntoActiveEditor(text: string): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			const editor = view.editor;
			editor.replaceSelection(text);
			editor.focus();
		}
	}

	private renderEntityLink(parent: HTMLElement, wikilink: string): void {
		const name = wikilink.replace(/^\[\[(.+?)(\|.+)?\]\]$/, "$1");
		const link = parent.createEl("a", { text: name, cls: "campaign-sr-entity-link" });
		link.addEventListener("click", (e) => {
			e.preventDefault();
			const file = this.app.metadataCache.getFirstLinkpathDest(name, "");
			if (file) this.app.workspace.getLeaf(false).openFile(file);
		});
	}
}
