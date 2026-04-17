import { ItemView, WorkspaceLeaf, TFile, Notice } from "obsidian";
import type CampaignPlugin from "../../main";
import { EntityPickerModal } from "../../ui/modals/entity-picker";
import { rollExpression } from "../slash/commands";

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
		const h = header.createEl("h3", { text: title });
		if (!this.sessionFile) h.style.color = "var(--text-muted)";

		const controls = header.createDiv({ cls: "campaign-sr-controls" });
		const pickBtn = controls.createEl("button", { text: "Pick Session", cls: "campaign-init-btn" });
		pickBtn.addEventListener("click", async () => {
			const sessions = this.plugin.entityIndex.byKind("session");
			if (sessions.length === 0) {
				new Notice(
					"No sessions found. Create one with Campaign: Create Session, or check Campaign Issues for validation errors.",
				);
				return;
			}
			const modal = new EntityPickerModal(
				this.app,
				this.plugin.entityIndex,
				["session"],
				"Pick a session\u2026",
			);
			const picked = await modal.pick();
			if (!picked) return;
			const file = this.app.vault.getAbstractFileByPath(picked.path);
			if (!(file instanceof TFile)) {
				new Notice(`Could not open ${picked.path}`);
				return;
			}
			this.setSessionFile(file);
			new Notice(`Loaded session: ${file.basename}`);
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

		if (!this.sessionFile) {
			panel.createEl("p", {
				text: "Pick a session above to enable Quick Insert.",
				cls: "campaign-init-empty",
			});
			return;
		}

		const grid = panel.createDiv({ cls: "campaign-sr-quick-grid" });

		const actions: { label: string; action: () => void | Promise<void> }[] = [
			{
				label: "Insert NPC Link",
				action: async () => {
					const entity = await this.plugin.promptEntityPicker();
					if (!entity) return;
					await this.appendToSessionLog(`- Mentioned [[${entity.name}]]`);
					new Notice(`Logged: ${entity.name}`);
				},
			},
			{
				label: "Insert Roll",
				action: async () => {
					const expr = await this.plugin.promptText("Dice expression (e.g., 1d20, 2d6+3)");
					if (!expr) return;
					const result = rollExpression(expr);
					if (result.rolls.length === 0) {
						new Notice(`Invalid dice expression: ${expr}`);
						return;
					}
					await this.appendToSessionLog(
						`- Rolled \`${expr} = ${result.total}\` (${result.rolls.join(", ")})`,
					);
					new Notice(`Rolled ${expr} = ${result.total}`);
				},
			},
			{
				label: "Insert Event",
				action: async () => {
					const text = await this.plugin.promptText("Event text");
					if (!text) return;
					await this.appendToSessionLog(`- ${text}`);
					new Notice("Event logged");
				},
			},
			{
				label: "Insert Loot",
				action: async () => {
					const text = await this.plugin.promptText("Loot description");
					if (!text) return;
					await this.appendToSessionLog(`- [ ] Loot: ${text}`);
					new Notice("Loot logged");
				},
			},
			{
				label: "Mark Secret Revealed",
				action: async () => {
					const text = await this.plugin.promptText("Secret revealed");
					if (!text) return;
					await this.appendToSessionLog(`> [!secret] Revealed: ${text}`);
					new Notice("Secret logged");
				},
			},
		];

		for (const a of actions) {
			const btn = grid.createEl("button", { text: a.label, cls: "campaign-sr-quick-btn" });
			btn.addEventListener("click", () => {
				Promise.resolve(a.action()).catch((e) =>
					new Notice(`Quick Insert failed: ${(e as Error).message}`),
				);
			});
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

			const insertBtn = row.createEl("button", { text: "Log", cls: "campaign-init-btn-sm" });
			insertBtn.addEventListener("click", async () => {
				if (!this.sessionFile) {
					new Notice("Pick a session first.");
					return;
				}
				await this.appendToSessionLog(`- Mentioned [[${npc.name}]]`);
				new Notice(`Logged: ${npc.name}`);
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
		const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
		await this.appendToSessionLog(`- **${ts}** \u2014 ${text}`);
	}

	/**
	 * Append a raw line to the Session log section. Creates the section if
	 * it doesn't exist. Safe to call without a timestamp wrapper.
	 */
	private async appendToSessionLog(line: string): Promise<void> {
		if (!this.sessionFile) return;
		const content = await this.app.vault.read(this.sessionFile);
		const logHeader = "## Session log";
		const idx = content.indexOf(logHeader);
		if (idx !== -1) {
			const insertAt = idx + logHeader.length;
			const updated = content.slice(0, insertAt) + `\n${line}` + content.slice(insertAt);
			await this.app.vault.modify(this.sessionFile, updated);
		} else {
			const suffix = content.endsWith("\n") ? "" : "\n";
			await this.app.vault.append(this.sessionFile, `${suffix}\n${logHeader}\n${line}\n`);
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
