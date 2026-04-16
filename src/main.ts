import {
	App,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	Setting,
	TFile,
	WorkspaceLeaf,
	normalizePath,
} from "obsidian";
import {
	CampaignSettingTab,
	DEFAULT_SETTINGS,
	type CampaignSettings,
} from "./settings";
import { EntityIndex, wireEntityIndex } from "./core/entity-index";
import { EntityResolver } from "./core/entity-resolver";
import { EventBus, type CampaignEvents } from "./core/event-bus";
import { DiagnosticsView, DIAGNOSTICS_VIEW_TYPE } from "./core/diagnostics-view";
import {
	QuestBoardView,
	QUEST_BOARD_VIEW_TYPE,
} from "./features/quest/quest-board-view";
import { SlashSuggest } from "./features/slash/slash-suggest";
import { buildSlashCommands } from "./features/slash/commands";
import { autolink } from "./features/autolink/linker";
import { TemplaterBridge } from "./integrations/templater-api";
import { DataviewBridge } from "./integrations/dataview-api";
import { EntityPickerModal } from "./ui/modals/entity-picker";
import { ulid } from "./core/ulid";
import { validateFrontmatter, type EntityKind } from "./schemas";
import {
	InitiativeTrackerView,
	INITIATIVE_VIEW_TYPE,
} from "./features/initiative/tracker-view";
import {
	SessionRunnerView,
	SESSION_RUNNER_VIEW_TYPE,
} from "./features/session-runner/session-view";
import { enterSessionLayout } from "./features/session-runner/layout";
import {
	NPCGraphView,
	NPC_GRAPH_VIEW_TYPE,
} from "./features/npc/relationship-graph";

export default class CampaignPlugin extends Plugin {
	settings!: CampaignSettings;
	entityIndex!: EntityIndex;
	resolver!: EntityResolver;
	eventBus = new EventBus<CampaignEvents>();
	templater!: TemplaterBridge;
	dataview!: DataviewBridge;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.templater = new TemplaterBridge(this.app);
		this.dataview = new DataviewBridge(this.app);

		this.entityIndex = new EntityIndex(this.app);
		this.resolver = new EntityResolver(this.app, this.entityIndex);

		this.registerView(
			DIAGNOSTICS_VIEW_TYPE,
			(leaf) => new DiagnosticsView(leaf, this.entityIndex),
		);
		this.registerView(
			QUEST_BOARD_VIEW_TYPE,
			(leaf) => new QuestBoardView(leaf, this.entityIndex),
		);
		this.registerView(
			INITIATIVE_VIEW_TYPE,
			(leaf) => new InitiativeTrackerView(leaf, this),
		);
		this.registerView(
			SESSION_RUNNER_VIEW_TYPE,
			(leaf) => new SessionRunnerView(leaf, this),
		);
		this.registerView(
			NPC_GRAPH_VIEW_TYPE,
			(leaf) => new NPCGraphView(leaf, this),
		);

		this.registerEditorSuggest(new SlashSuggest(this, buildSlashCommands()));

		this.addSettingTab(new CampaignSettingTab(this.app, this));

		this.addRibbonIcon("scroll", "Open Quest Board", () => this.activateQuestBoard());
		this.addRibbonIcon("swords", "Initiative Tracker", () => this.activateView(INITIATIVE_VIEW_TYPE));
		this.addRibbonIcon("play-circle", "Start Session", () => enterSessionLayout(this));

		this.registerCommands();
		this.registerVaultListeners();

		this.app.workspace.onLayoutReady(() => {
			this.entityIndex.rebuildAll();
		});
	}

	async onunload(): Promise<void> {
		// View leaves detach themselves via onClose.
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Create a new entity of the given kind. Uses Templater if available;
	 * otherwise writes a minimal frontmatter stub so validation still passes.
	 */
	async createEntity(kind: EntityKind, name: string): Promise<TFile> {
		const folder = this.settings.folders[kind];
		await this.ensureFolder(folder);
		const safe = sanitizeFilename(name) || `New ${kind}`;
		const path = normalizePath(`${folder}/${safe}.md`);

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) return existing;

		const template = await this.findTemplate(kind);
		if (template && this.templater.isAvailable()) {
			try {
				return await this.templater.createFromTemplate(template, folder, safe);
			} catch (err) {
				console.warn("Templater creation failed, falling back to stub:", err);
			}
		}

		const stub = this.stubFrontmatter(kind, safe);
		return this.app.vault.create(path, stub);
	}

	async promptEntityPicker() {
		return new EntityPickerModal(this.app, this.entityIndex).pick();
	}

	private async ensureFolder(path: string): Promise<void> {
		if (!path) return;
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing) return;
		await this.app.vault.createFolder(path);
	}

	private async findTemplate(kind: EntityKind): Promise<TFile | null> {
		const candidates = [
			`Templates/Campaign/${kind}.md`,
			`Templates/${kind}.md`,
			`templates/${kind}.md`,
		];
		for (const c of candidates) {
			const f = this.app.vault.getAbstractFileByPath(c);
			if (f instanceof TFile) return f;
		}
		return null;
	}

	private stubFrontmatter(kind: EntityKind, name: string): string {
		const now = new Date().toISOString();
		const base = [
			"---",
			`id: ${ulid()}`,
			`kind: ${kind}`,
			"aliases: []",
			"visibility: gm",
			`tags: [${kind}]`,
			`created: ${now}`,
			`updated: ${now}`,
		];
		const extras = kindStub(kind);
		return [...base, ...extras, "---", "", `# ${name}`, ""].join("\n");
	}

	private registerCommands(): void {
		this.addCommand({
			id: "open-quest-board",
			name: "Open Quest Board",
			callback: () => this.activateQuestBoard(),
		});
		this.addCommand({
			id: "open-diagnostics",
			name: "Open Campaign Issues",
			callback: () => this.activateDiagnostics(),
		});
		this.addCommand({
			id: "open-initiative-tracker",
			name: "Open Initiative Tracker",
			callback: () => this.activateView(INITIATIVE_VIEW_TYPE),
		});
		this.addCommand({
			id: "start-session",
			name: "Start Session (layout)",
			callback: () => enterSessionLayout(this),
		});
		this.addCommand({
			id: "open-npc-graph",
			name: "Open NPC Relationship Graph",
			callback: () => this.activateView(NPC_GRAPH_VIEW_TYPE),
		});
		this.addCommand({
			id: "autolink-current-file",
			name: "Auto-link entities in current file",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view?.file) return false;
				if (checking) return true;
				this.runAutolink(view.file).catch((e) => {
					console.error(e);
					new Notice(`Auto-link failed: ${(e as Error).message}`);
				});
				return true;
			},
		});
		for (const kind of ["pc", "npc", "quest", "location", "session", "faction", "item"] as const) {
			this.addCommand({
				id: `create-${kind}`,
				name: `Create ${kind.toUpperCase()}`,
				callback: async () => {
					const name = await this.prompt(`New ${kind} name`);
					if (!name) return;
					const file = await this.createEntity(kind, name);
					await this.app.workspace.getLeaf(false).openFile(file);
				},
			});
		}
	}

	private async runAutolink(file: TFile): Promise<void> {
		const src = await this.app.vault.read(file);
		const plan = autolink(this.entityIndex, src);
		if (plan.replacements === 0) {
			new Notice("Auto-link: nothing to change.");
			return;
		}
		await this.app.vault.modify(file, plan.output);
		new Notice(`Auto-link: ${plan.replacements} replacement(s).`);
	}

	private registerVaultListeners(): void {
		for (const ref of wireEntityIndex(this.app, this.entityIndex)) {
			this.registerEvent(ref);
		}

		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (!this.settings.strictValidation || !file) return;
				const cache = this.app.metadataCache.getFileCache(file);
				const fm = cache?.frontmatter;
				if (!fm || typeof fm.kind !== "string") return;
				const v = validateFrontmatter(fm);
				if (!v.ok) {
					new Notice(`Campaign schema issues in ${file.name}: ${v.issues.length}`);
				}
			}),
		);
	}

	private async activateQuestBoard(): Promise<void> {
		await this.activateView(QUEST_BOARD_VIEW_TYPE);
	}
	private async activateDiagnostics(): Promise<void> {
		await this.activateView(DIAGNOSTICS_VIEW_TYPE);
	}
	private async activateView(type: string): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(type);
		let leaf: WorkspaceLeaf | null;
		if (existing.length > 0) {
			leaf = existing[0];
		} else {
			leaf = this.app.workspace.getRightLeaf(false);
			if (leaf) await leaf.setViewState({ type, active: true });
		}
		if (leaf) this.app.workspace.revealLeaf(leaf);
	}

	private prompt(placeholder: string): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new PromptModal(this.app, placeholder, (v) => resolve(v));
			modal.open();
		});
	}
}

function sanitizeFilename(name: string): string {
	return name
		.replace(/[\x00-\x1f\x7f\\/:*?"<>|]/g, "-")
		.replace(/\s+/g, " ")
		.trim();
}

function kindStub(kind: EntityKind): string[] {
	switch (kind) {
		case "pc":
			return [
				"class: Fighter",
				"level: 1",
				"race: Human",
				"hp:",
				"  current: 10",
				"  max: 10",
				"ac: 10",
				"stats:",
				"  str: 10",
				"  dex: 10",
				"  con: 10",
				"  int: 10",
				"  wis: 10",
				"  cha: 10",
			];
		case "npc":
			return ["disposition: neutral", "status: alive"];
		case "quest":
			return ["state: hook", "objectives: []"];
		case "location":
			return ["type: poi"];
		case "session":
			return ["number: 1", `date: ${new Date().toISOString().slice(0, 10)}`];
		case "faction":
			return ["influence: 5"];
		case "item":
			return ["rarity: common"];
	}
}

class PromptModal extends Modal {
	private value = "";
	constructor(
		app: App,
		private placeholder: string,
		private resolve: (v: string | null) => void,
	) {
		super(app);
	}
	onOpen(): void {
		this.contentEl.createEl("h3", { text: this.placeholder });
		const input = this.contentEl.createEl("input", { type: "text" });
		input.style.width = "100%";
		input.focus();
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.value = input.value.trim();
				this.close();
			} else if (e.key === "Escape") {
				this.close();
			}
		});
		new Setting(this.contentEl)
			.addButton((b) =>
				b.setButtonText("Cancel").onClick(() => this.close()),
			)
			.addButton((b) =>
				b
					.setButtonText("OK")
					.setCta()
					.onClick(() => {
						this.value = input.value.trim();
						this.close();
					}),
			);
	}
	onClose(): void {
		this.resolve(this.value || null);
	}
}
