import {
	App,
	FuzzySuggestModal,
	MarkdownView,
	Modal,
	Notice,
	Platform,
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
import { isPathExcluded } from "./core/template-path";
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
import {
	PCSheetView,
	PC_SHEET_VIEW_TYPE,
} from "./features/pc/sheet-view";
import {
	MapView,
	MAP_VIEW_TYPE,
} from "./features/map/map-view";
import { exportStaticSite } from "./features/publishing/exporter";
import { gitPublish } from "./features/publishing/git-publisher";
import {
	initializeCampaignVault,
	ENTITY_TEMPLATES,
	populateTemplate,
} from "./features/vault-init/init";
import {
	addSecret,
	revealSecret,
	getOrCreateSecretsFile,
	parseSecrets,
} from "./features/secrets/secrets";
import { renderStatblock } from "./features/statblock/renderer";
import { generateName } from "./features/names/generator";
import {
	TimelineView,
	TIMELINE_VIEW_TYPE,
} from "./features/timeline/timeline-view";

export default class CampaignPlugin extends Plugin {
	settings!: CampaignSettings;
	entityIndex!: EntityIndex;
	resolver!: EntityResolver;
	eventBus = new EventBus<CampaignEvents>();
	templater!: TemplaterBridge;
	dataview!: DataviewBridge;
	private normalizationTimers = new Set<number>();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.templater = new TemplaterBridge(this.app);
		this.dataview = new DataviewBridge(this.app);

		this.entityIndex = new EntityIndex(
			this.app,
			undefined,
			(path) => this.isPathExcluded(path),
		);
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
		this.registerView(
			PC_SHEET_VIEW_TYPE,
			(leaf) => new PCSheetView(leaf, this),
		);
		this.registerView(
			MAP_VIEW_TYPE,
			(leaf) => new MapView(leaf, this),
		);
		this.registerView(
			TIMELINE_VIEW_TYPE,
			(leaf) => new TimelineView(leaf, this),
		);

		this.registerEditorSuggest(new SlashSuggest(this, buildSlashCommands()));

		this.registerMarkdownCodeBlockProcessor("campaign-statblock", renderStatblock);

		this.addSettingTab(new CampaignSettingTab(this.app, this));

		this.addRibbonIcon("scroll", "Open quest board", () => this.activateQuestBoard());
		this.addRibbonIcon("swords", "Open initiative tracker", () => this.activateView(INITIATIVE_VIEW_TYPE));
		this.addRibbonIcon("play-circle", "Start session", () => enterSessionLayout(this));

		this.registerCommands();
		this.registerVaultListeners();

		this.app.workspace.onLayoutReady(() => {
			this.entityIndex.rebuildAll();
		});
	}

	async onunload(): Promise<void> {
		for (const id of this.normalizationTimers) window.clearTimeout(id);
		this.normalizationTimers.clear();
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) ?? {};
		if (typeof saved === "object" && saved !== null) {
			delete (saved as Record<string, unknown>)["__proto__"];
			delete (saved as Record<string, unknown>)["constructor"];
			delete (saved as Record<string, unknown>)["prototype"];
		}
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	isPathExcluded(path: string): boolean {
		return isPathExcluded(
			path,
			this.app,
			this.templater,
			this.settings.excludedFolders,
		);
	}

	/**
	 * Determine the active campaign root. Prefers the campaign that contains
	 * the active file (auto-detected from path: `Campaigns/<name>/...`), and
	 * falls back to the configured default in settings.
	 */
	getActiveCampaignRoot(): string {
		const file = this.app.workspace.getActiveFile();
		if (file) {
			const match = file.path.match(/^(Campaigns\/[^/]+)\//);
			if (match) return match[1];
		}
		return this.settings.campaignRoot;
	}

	/** Resolve a relative folder path against the active campaign root. */
	resolvePath(relative: string): string {
		return normalizePath(`${this.getActiveCampaignRoot()}/${relative}`);
	}

	/**
	 * Publish always targets the explicitly-selected campaign
	 * (`settings.campaignRoot`), not the file-context auto-detect — a user
	 * who has just switched campaigns expects the export to land in the
	 * new campaign's folder regardless of which file happens to be open.
	 * Also scopes content to that campaign so multi-campaign vaults don't
	 * cross-contaminate.
	 */
	private publishContext(): {
		campaignRoot: string;
		outputPath: string;
		isExcluded: (path: string) => boolean;
	} {
		const campaignRoot = this.settings.campaignRoot;
		const outputPath = normalizePath(`${campaignRoot}/${this.settings.publishFolder}`);
		const prefix = `${campaignRoot}/`;
		const isExcluded = (p: string): boolean => {
			if (this.isPathExcluded(p)) return true;
			if (!p.startsWith(prefix)) return true;
			return false;
		};
		return { campaignRoot, outputPath, isExcluded };
	}

	/** List all campaigns by scanning Campaigns/ for subfolders. */
	listCampaigns(): string[] {
		const root = this.app.vault.getAbstractFileByPath("Campaigns");
		if (!root || !("children" in root)) return [];
		const folders: string[] = [];
		for (const child of (root as { children: unknown[] }).children) {
			if (child && typeof child === "object" && "path" in child && "children" in child) {
				folders.push((child as { path: string }).path);
			}
		}
		return folders.sort();
	}

	/** Entities of a kind, filtered to the active campaign's folder tree. */
	byKindInActiveCampaign(kind: EntityKind) {
		const root = this.getActiveCampaignRoot();
		return this.entityIndex.byKind(kind).filter((e) => e.path.startsWith(`${root}/`));
	}

	async createEntity(kind: EntityKind, name: string): Promise<TFile> {
		const folder = this.resolvePath(this.settings.folders[kind]);
		await this.ensureFolder(folder);
		const safe = sanitizeFilename(name) || `New ${kind}`;
		const path = normalizePath(`${folder}/${safe}.md`);

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) return existing;

		const builtIn = ENTITY_TEMPLATES[kind];
		const content = builtIn
			? populateTemplate(builtIn, safe)
			: this.stubFrontmatter(kind, safe);
		const file = await this.app.vault.create(path, content);
		this.scheduleFrontmatterNormalization(file);
		new Notice(`Created ${kind}: ${safe}`);
		return file;
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

	/**
	 * Another plugin (Templater's "Folder Templates", Core Templates, etc.)
	 * may prepend content to newly-created files. We can't know when they
	 * are "done", so we re-check at several intervals and strip any content
	 * before the first line-start --- delimiter whenever we see it.
	 */
	scheduleFrontmatterNormalization(file: TFile): void {
		const intervals = [0, 250, 700, 1500, 3000];
		for (const delay of intervals) {
			const id = window.setTimeout(() => {
				this.normalizationTimers.delete(id);
				this.normalizeEntityFrontmatter(file).catch((err) =>
					console.warn("normalizeEntityFrontmatter:", err),
				);
			}, delay);
			this.normalizationTimers.add(id);
		}
	}

	async normalizeEntityFrontmatter(file: TFile): Promise<void> {
		await this.app.vault.process(file, (actual) => {
			if (actual.startsWith("---")) return actual;
			const match = actual.match(/^---\s*$/m);
			if (!match || match.index === undefined || match.index === 0) return actual;
			return actual.slice(match.index);
		});
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
			name: "Open quest board",
			callback: () => this.activateQuestBoard(),
		});
		this.addCommand({
			id: "open-diagnostics",
			name: "Open campaign issues",
			callback: () => this.activateDiagnostics(),
		});
		this.addCommand({
			id: "init-campaign-vault",
			name: "Initialize campaign vault",
			callback: async () => {
				const name = await this.promptText("Campaign name (e.g., Curse of Strahd)");
				if (!name) return;
				this.settings.campaignRoot = `Campaigns/${sanitizeFilename(name)}`;
				this.settings.publishTitle = name;
				await this.saveSettings();
				await initializeCampaignVault(this.app, this.settings, name);
			},
		});
		this.addCommand({
			id: "switch-active-campaign",
			name: "Switch active campaign (default)",
			callback: async () => {
				const campaigns = this.listCampaigns();
				if (campaigns.length === 0) {
					new Notice("No campaigns found. Run 'Initialize campaign vault' first.");
					return;
				}
				const picked = await this.pickFromList("Pick default campaign", campaigns);
				if (!picked) return;
				this.settings.campaignRoot = picked;
				await this.saveSettings();
				new Notice(`Default campaign set to: ${picked}`);
			},
		});
		this.addCommand({
			id: "open-initiative-tracker",
			name: "Open initiative tracker",
			callback: () => this.activateView(INITIATIVE_VIEW_TYPE),
		});
		this.addCommand({
			id: "start-session",
			name: "Start session (layout)",
			callback: () => enterSessionLayout(this),
		});
		this.addCommand({
			id: "open-npc-graph",
			name: "Open NPC relationship graph",
			callback: () => this.activateView(NPC_GRAPH_VIEW_TYPE),
		});
		this.addCommand({
			id: "open-pc-sheet",
			name: "Open PC sheet",
			callback: () => this.activateView(PC_SHEET_VIEW_TYPE),
		});
		this.addCommand({
			id: "open-map",
			name: "Open campaign map",
			callback: () => this.activateView(MAP_VIEW_TYPE),
		});
		this.addCommand({
			id: "open-timeline",
			name: "Open campaign timeline",
			callback: () => this.activateView(TIMELINE_VIEW_TYPE),
		});
		this.addCommand({
			id: "publish-export",
			name: "Publish: Export static site",
			callback: async () => {
				const ctx = this.publishContext();
				const result = await exportStaticSite(this.app, this.entityIndex, {
					outputPath: ctx.outputPath,
					title: this.settings.publishTitle,
					includeGM: false,
					isExcluded: ctx.isExcluded,
				});
				new Notice(
					`Exported ${result.filesExported} page(s) to ${ctx.outputPath}, skipped ${result.filesSkipped} GM-only.`,
				);
			},
		});
		this.addCommand({
			id: "publish-export-gm",
			name: "Publish: Export static site (include GM content)",
			callback: async () => {
				const ctx = this.publishContext();
				const result = await exportStaticSite(this.app, this.entityIndex, {
					outputPath: ctx.outputPath,
					title: this.settings.publishTitle,
					includeGM: true,
					isExcluded: ctx.isExcluded,
				});
				new Notice(
					`Exported ${result.filesExported} page(s) to ${ctx.outputPath} (GM content included).`,
				);
			},
		});
		// Git push relies on Node's child_process; it only works on desktop.
		if (!Platform.isMobile) {
			this.addCommand({
				id: "publish-git-push",
				name: "Publish: Export and git push",
				callback: async () => {
					try {
						const ctx = this.publishContext();
						await exportStaticSite(this.app, this.entityIndex, {
							outputPath: ctx.outputPath,
							title: this.settings.publishTitle,
							includeGM: false,
							isExcluded: ctx.isExcluded,
						});
						const out = await gitPublish(this.app, {
							repoPath: ctx.outputPath,
							remoteName: this.settings.gitRemote,
							branch: this.settings.gitBranch,
							commitMessage: "",
						});
						new Notice(`Published and pushed. ${out}`);
					} catch (err) {
						new Notice(`Publish failed: ${(err as Error).message}`);
					}
				},
			});
		}
		this.addCommand({
			id: "secrets-add",
			name: "Secrets: Add a secret or clue to the pool",
			callback: async () => {
				const text = await this.promptText("What secret or clue should the players eventually discover?");
				if (!text) return;
				const root = this.getActiveCampaignRoot();
				try {
					await addSecret(this.app, root, text);
					new Notice(`Added to secrets pool.`);
				} catch (err) {
					new Notice(`Add failed: ${(err as Error).message}`);
				}
			},
		});
		this.addCommand({
			id: "secrets-reveal",
			name: "Secrets: Reveal a secret to the players",
			callback: async () => {
				const root = this.getActiveCampaignRoot();
				try {
					const file = await getOrCreateSecretsFile(this.app, root);
					const content = await this.app.vault.read(file);
					const unrevealed = parseSecrets(content).filter((s) => !s.revealed);
					if (unrevealed.length === 0) {
						new Notice("No unrevealed secrets. Add some first.");
						return;
					}
					const picked = await this.pickFromList(
						"Pick a secret to reveal",
						unrevealed.map((s) => s.text),
					);
					if (!picked) return;
					const sessionFile = this.app.workspace.getActiveFile();
					const sessionRef = sessionFile ? `[[${sessionFile.basename}]]` : "this session";
					await revealSecret(this.app, root, picked, sessionRef);
					new Notice(`Revealed: ${picked}`);
				} catch (err) {
					new Notice(`Reveal failed: ${(err as Error).message}`);
				}
			},
		});
		this.addCommand({
			id: "secrets-open",
			name: "Secrets: Open pool file",
			callback: async () => {
				const root = this.getActiveCampaignRoot();
				const file = await getOrCreateSecretsFile(this.app, root);
				await this.app.workspace.getLeaf(false).openFile(file);
			},
		});
		this.addCommand({
			id: "fix-frontmatter-current-file",
			name: "Fix frontmatter position (current file)",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view?.file) return false;
				if (checking) return true;
				this.normalizeEntityFrontmatter(view.file)
					.then(() => new Notice("Frontmatter normalized."))
					.catch((err) => new Notice(`Fix failed: ${(err as Error).message}`));
				return true;
			},
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
					const options = kind === "npc"
						? { suggestLabel: "Generate name", suggest: () => generateName().full }
						: undefined;
					const name = await this.promptText(`New ${kind} name`, options);
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

	pickFromList(placeholder: string, items: string[]): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new ListPickerModal(this.app, placeholder, items, resolve);
			modal.open();
		});
	}

	generateNPCName(): string {
		return generateName().full;
	}

	promptText(
		placeholder: string,
		options?: { suggestLabel?: string; suggest?: () => string },
	): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new PromptModal(
				this.app,
				placeholder,
				(v) => resolve(v),
				options,
			);
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

class ListPickerModal extends FuzzySuggestModal<string> {
	constructor(
		app: App,
		placeholder: string,
		private items: string[],
		private resolve: (v: string | null) => void,
	) {
		super(app);
		this.setPlaceholder(placeholder);
	}
	getItems(): string[] { return this.items; }
	getItemText(item: string): string { return item; }
	onChooseItem(item: string): void { this.resolve(item); }
	onClose(): void { this.resolve(null); }
}

class PromptModal extends Modal {
	private value = "";
	constructor(
		app: App,
		private placeholder: string,
		private resolve: (v: string | null) => void,
		private options?: { suggestLabel?: string; suggest?: () => string },
	) {
		super(app);
	}
	onOpen(): void {
		this.contentEl.createEl("h3", { text: this.placeholder });
		const input = this.contentEl.createEl("input", {
			type: "text",
			cls: "campaign-modal-input-full",
		});
		input.focus();

		// Stop Enter/Escape from bubbling into the editor below. Without
		// preventDefault + stopPropagation, pressing Enter in this input
		// also inserts a newline at the active editor's cursor once the
		// modal closes, corrupting the frontmatter of the file the user
		// was editing when they invoked the command.
		const handle = (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
			}
			if (e.key === "Enter") {
				this.value = input.value.trim();
				this.close();
			} else if (e.key === "Escape") {
				this.close();
			}
		};
		input.addEventListener("keydown", handle);
		// Also swallow keypress and keyup so the sequence doesn't leak
		// to the editor behind the modal after it closes.
		const swallow = (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
			}
		};
		input.addEventListener("keypress", swallow);
		input.addEventListener("keyup", swallow);

		const setting = new Setting(this.contentEl);
		if (this.options?.suggest) {
			const suggest = this.options.suggest;
			setting.addButton((b) =>
				b
					.setButtonText(this.options?.suggestLabel ?? "Suggest")
					.onClick(() => {
						input.value = suggest();
						input.focus();
					}),
			);
		}
		setting
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
