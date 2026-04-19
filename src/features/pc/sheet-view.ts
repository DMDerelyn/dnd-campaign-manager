import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type CampaignPlugin from "../../main";
import type { IndexedEntity } from "../../core/entity-index";

export const PC_SHEET_VIEW_TYPE = "campaign-pc-sheet";

export class PCSheetView extends ItemView {
	private entity: IndexedEntity | null = null;
	private detach: (() => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CampaignPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return PC_SHEET_VIEW_TYPE;
	}
	getDisplayText(): string {
		return this.entity ? `PC: ${this.entity.name}` : "PC sheet";
	}
	getIcon(): string {
		return "user";
	}

	async onOpen(): Promise<void> {
		this.render();
		this.detach = this.plugin.entityIndex.onChange(() => {
			if (this.entity) {
				this.entity = this.plugin.entityIndex.getByPath(this.entity.path) ?? null;
			}
			this.render();
		});
	}

	async onClose(): Promise<void> {
		this.detach?.();
		this.detach = null;
	}

	setEntity(entity: IndexedEntity): void {
		this.entity = entity;
		this.render();
	}

	private render(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("campaign-pc-sheet");

		const header = el.createDiv({ cls: "campaign-pc-header" });
		const pickBtn = header.createEl("button", { text: "Pick PC", cls: "campaign-init-btn" });
		pickBtn.addEventListener("click", async () => {
			const pcs = this.plugin.entityIndex.byKind("pc");
			if (pcs.length === 0) return;
			const picked = await this.plugin.promptEntityPicker();
			if (picked && picked.kind === "pc") this.setEntity(picked);
		});

		const importBtn = header.createEl("button", { text: "Import from DDB", cls: "campaign-init-btn" });
		importBtn.addEventListener("click", () => {
			new DDBImportModal(this.plugin).open();
		});

		if (!this.entity) {
			el.createEl("p", { text: "No PC selected. Use Pick PC or Import from DDB.", cls: "campaign-init-empty" });
			return;
		}

		const fm = this.entity.frontmatter;
		this.renderName(el, fm);
		this.renderStats(el, fm);
		this.renderCombat(el, fm);
		this.renderDetails(el, fm);
	}

	private renderName(el: HTMLElement, fm: Record<string, unknown>): void {
		const section = el.createDiv({ cls: "campaign-pc-section" });
		section.createEl("h2", { text: String(this.entity?.name ?? "") });

		const meta: string[] = [];
		if (fm.race) meta.push(String(fm.race));
		if (fm.class) meta.push(`${fm.class} ${fm.level ?? ""}`);
		if (fm.background) meta.push(String(fm.background));
		section.createEl("p", { text: meta.join(" | "), cls: "campaign-pc-meta" });

		if (typeof fm.dndbeyond_url === "string" && /^https?:\/\//i.test(fm.dndbeyond_url)) {
			const url = fm.dndbeyond_url;
			const link = section.createEl("a", { text: "View on D&D Beyond", cls: "campaign-sr-entity-link" });
			link.setAttribute("href", url);
			link.setAttribute("target", "_blank");
			link.setAttribute("rel", "noopener noreferrer");
			link.addEventListener("click", (e) => {
				e.preventDefault();
				window.open(url, "_blank", "noopener,noreferrer");
			});
		}
	}

	private renderStats(el: HTMLElement, fm: Record<string, unknown>): void {
		const stats = fm.stats as Record<string, number> | undefined;
		if (!stats) return;
		const section = el.createDiv({ cls: "campaign-pc-section" });
		section.createEl("h4", { text: "Ability Scores" });
		const grid = section.createDiv({ cls: "campaign-pc-stats-grid" });
		for (const key of ["str", "dex", "con", "int", "wis", "cha"]) {
			const val = stats[key] ?? 10;
			const mod = Math.floor((val - 10) / 2);
			const cell = grid.createDiv({ cls: "campaign-pc-stat-cell" });
			cell.createEl("div", { text: key.toUpperCase(), cls: "campaign-pc-stat-label" });
			cell.createEl("div", { text: String(val), cls: "campaign-pc-stat-value" });
			cell.createEl("div", { text: `${mod >= 0 ? "+" : ""}${mod}`, cls: "campaign-pc-stat-mod" });
		}
	}

	private renderCombat(el: HTMLElement, fm: Record<string, unknown>): void {
		const section = el.createDiv({ cls: "campaign-pc-section" });
		section.createEl("h4", { text: "Combat" });
		const table = section.createEl("table", { cls: "campaign-sr-info-table" });

		const hp = fm.hp as { current?: number; max?: number; temp?: number } | undefined;
		const initBonus = typeof fm.initiative_bonus === "number" ? fm.initiative_bonus : 0;
		const fields: [string, string][] = [
			["HP", hp ? `${hp.current ?? 0} / ${hp.max ?? 0}${(hp.temp ?? 0) > 0 ? ` (+${hp.temp} temp)` : ""}` : "\u2014"],
			["AC", String(fm.ac ?? "\u2014")],
			["Speed", `${fm.speed ?? 30} ft`],
			["Initiative", `${initBonus >= 0 ? "+" : ""}${initBonus}`],
		];
		for (const [label, value] of fields) {
			const tr = table.createEl("tr");
			tr.createEl("td", { text: label, cls: "campaign-sr-info-label" });
			tr.createEl("td", { text: value });
		}
	}

	private renderDetails(el: HTMLElement, fm: Record<string, unknown>): void {
		const section = el.createDiv({ cls: "campaign-pc-section" });
		section.createEl("h4", { text: "Details" });

		const openBtn = section.createEl("button", { text: "Open full note", cls: "campaign-init-btn" });
		openBtn.addEventListener("click", () => {
			if (this.entity) {
				const file = this.app.vault.getAbstractFileByPath(this.entity.path);
				if (file instanceof TFile) this.app.workspace.getLeaf(false).openFile(file);
			}
		});

		const spellSlots = fm.spell_slots as Record<string, number> | undefined;
		if (spellSlots && Object.keys(spellSlots).length > 0) {
			section.createEl("h5", { text: "Spell Slots" });
			const slotList = section.createEl("ul");
			for (const [key, val] of Object.entries(spellSlots)) {
				if (val > 0) {
					slotList.createEl("li", { text: `${key.replace("_", " ")}: ${val}` });
				}
			}
		}
	}
}

import { Modal, Setting, Notice } from "obsidian";
import { fetchDDBCharacter } from "./ddb-import/url-scraper";
import { normalizeDDBCharacter, type NormalizedPC } from "./ddb-import/normalize";

class DDBImportModal extends Modal {
	constructor(private plugin: CampaignPlugin) {
		super(plugin.app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "Import from D&D Beyond" });

		contentEl.createEl("p", {
			text: "Paste a D&D Beyond character URL. The character must be set to public on D&D Beyond for the import to work.",
		});

		const input = contentEl.createEl("input", {
			type: "text",
			cls: "campaign-sr-capture-input campaign-modal-input-full",
			attr: { placeholder: "https://www.dndbeyond.com/characters/12345678" },
		});
		input.focus();

		new Setting(contentEl)
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText("Import")
					.setCta()
					.onClick(async () => {
						const val = input.value.trim();
						if (!val) return;
						try {
							const raw = await fetchDDBCharacter(val);
							const normalized = normalizeDDBCharacter(raw, val);
							await this.createPCFile(normalized);
							new Notice(`Imported ${normalized.aliases[0] ?? "PC"} from D&D Beyond.`);
							this.close();
						} catch (err) {
							new Notice(`Import failed: ${(err as Error).message}`);
						}
					}),
			);
	}

	private async createPCFile(pc: NormalizedPC): Promise<void> {
		const name = pc.aliases[0] ?? "Imported PC";
		const file = await this.plugin.createEntity("pc", name);
		const yaml = pcToYaml(pc);
		await this.app.vault.modify(file, yaml + `\n# ${name}\n\n## Backstory\n\n## Notes\n`);
		this.plugin.scheduleFrontmatterNormalization(file);
	}
}

function pcToYaml(pc: NormalizedPC): string {
	const lines = [
		"---",
		`id: ${pc.id}`,
		`kind: pc`,
		`aliases: [${pc.aliases.map(quoteYaml).join(", ")}]`,
		`visibility: both`,
		`tags: [pc]`,
		`player: "${escapeYaml(pc.player)}"`,
		`class: "${escapeYaml(pc.class)}"`,
		pc.subclass ? `subclass: "${escapeYaml(pc.subclass)}"` : null,
		`level: ${pc.level}`,
		`race: "${escapeYaml(pc.race)}"`,
		pc.background ? `background: "${escapeYaml(pc.background)}"` : null,
		`hp:`,
		`  current: ${pc.hp.current}`,
		`  max: ${pc.hp.max}`,
		`  temp: ${pc.hp.temp}`,
		`ac: ${pc.ac}`,
		`speed: ${pc.speed}`,
		`initiative_bonus: ${pc.initiative_bonus}`,
		`stats:`,
		`  str: ${pc.stats.str}`,
		`  dex: ${pc.stats.dex}`,
		`  con: ${pc.stats.con}`,
		`  int: ${pc.stats.int}`,
		`  wis: ${pc.stats.wis}`,
		`  cha: ${pc.stats.cha}`,
		`saves: ${JSON.stringify(pc.saves)}`,
		`skills: {}`,
		`spell_slots: ${JSON.stringify(pc.spell_slots)}`,
		`inventory: []`,
		pc.dndbeyond_url ? `dndbeyond_url: "${escapeYaml(pc.dndbeyond_url)}"` : null,
		pc.dndbeyond_imported_at ? `dndbeyond_imported_at: "${pc.dndbeyond_imported_at}"` : null,
		`created: ${new Date().toISOString()}`,
		`updated: ${new Date().toISOString()}`,
		"---",
	];
	return lines.filter((l) => l !== null).join("\n");
}

function escapeYaml(s: string): string {
	return s
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t")
		.replace(/\0/g, "")
		.replace(/^!/, "\\!");
}

function quoteYaml(s: string): string {
	return `"${escapeYaml(s)}"`;
}
