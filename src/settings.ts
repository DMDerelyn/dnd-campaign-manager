import {
	Notice,
	PluginSettingTab,
	Setting,
	type App,
	type SettingDefinitionItem,
} from "obsidian";
import type CampaignPlugin from "./main";
import type { EntityKind } from "./schemas";
import { resolveCampaignSubfolder } from "./core/path-safety";

export interface CampaignSettings {
	folders: Record<EntityKind, string>;
	mapsFolder: string;
	campaignRoot: string;
	enableAutolinkOnSave: boolean;
	strictValidation: boolean;
	excludedFolders: string[];
	questOrder: Record<string, number>;
	agentGuide: {
		/** Also write a short CLAUDE.md that points at AGENTS.md. */
		emitClaudeMd: boolean;
		/** Re-export campaign-index.json whenever the entity index changes. */
		autoExportIndex: boolean;
		/** `player` drops gm-only entities from the exported index. */
		indexScope: "all" | "player";
	};
}

export const DEFAULT_SETTINGS: CampaignSettings = {
	folders: {
		pc: "PCs",
		npc: "NPCs",
		quest: "Quests",
		location: "Locations",
		session: "Sessions",
		faction: "Factions",
		item: "Items",
	},
	mapsFolder: "Maps",
	campaignRoot: "Campaigns/My Campaign",
	enableAutolinkOnSave: false,
	strictValidation: false,
	excludedFolders: [],
	questOrder: {},
	agentGuide: {
		emitClaudeMd: false,
		autoExportIndex: false,
		indexScope: "all",
	},
};

const KINDS: EntityKind[] = ["pc", "npc", "quest", "location", "session", "faction", "item"];

/** Read a dotted path (max two levels here) out of the settings object. */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
	return path.split(".").reduce<unknown>((acc, part) => {
		return acc && typeof acc === "object"
			? (acc as Record<string, unknown>)[part]
			: undefined;
	}, obj);
}

/** Write a dotted path back into the settings object. */
function setByPath(
	obj: Record<string, unknown>,
	path: string,
	value: unknown,
): void {
	const parts = path.split(".");
	const last = parts.pop();
	if (last === undefined) return;
	let cur = obj;
	for (const part of parts) {
		cur = cur[part] as Record<string, unknown>;
	}
	cur[last] = value;
}

export class CampaignSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: CampaignPlugin,
	) {
		super(app, plugin);
	}

	/**
	 * Declarative settings for Obsidian 1.13+ (makes the settings searchable).
	 * {@link display} below is kept for older clients down to `minAppVersion`
	 * and must stay in sync with this.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		const p = this.plugin;
		const tmpl = p.templater.isAvailable() ? "detected" : "not installed";
		const dv = p.dataview.isAvailable() ? "detected" : "not installed";
		const active = p.getActiveCampaignRoot();

		return [
			{
				name: "Device support",
				desc: "Optimized for desktop and tablet. Mobile handles quick additions and references, but canvas views and multi-panel layouts are not ideal on small touch screens.",
			},
			{
				name: "Optional plugins",
				desc: `Templater: ${tmpl} · Dataview: ${dv}. Dataview is recommended for entity queries in notes; Templater is no longer required.`,
			},
			{
				type: "group",
				heading: "Campaign folder",
				items: [
					{
						name: "Active campaign",
						desc: `Auto-detected from the current file, or the default: ${active}`,
					},
					{
						name: "Default campaign root",
						desc: "Used when no campaign file is open. New entities go here unless you're editing a file inside another campaign.",
						control: {
							type: "text",
							key: "campaignRoot",
							placeholder: "Campaigns/My Campaign",
						},
					},
				],
			},
			{
				type: "group",
				heading: "Entity subfolders",
				items: KINDS.map((kind) => ({
					name: kind.toUpperCase(),
					desc: `Subfolder for ${kind} entities, relative to the campaign root.`,
					control: { type: "text", key: `folders.${kind}` },
				})),
			},
			{
				name: "Maps",
				desc: "Subfolder where raw map images live. Must be a relative path inside the campaign folder.",
				control: {
					type: "text",
					key: "mapsFolder",
					validate: (value: string) => {
						const trimmed = value.trim();
						return trimmed && resolveCampaignSubfolder("_", trimmed) === null
							? "Maps folder must be a relative path inside the campaign (no '..' or absolute paths)."
							: undefined;
					},
				},
			},
			{
				type: "group",
				heading: "Validation",
				items: [
					{
						name: "Strict validation",
						desc: "Show a notice when opening a file with schema errors.",
						control: { type: "toggle", key: "strictValidation" },
					},
					{
						name: "Excluded folders",
						desc: "Folders the plugin should ignore entirely — not indexed as entities, not shown in Campaign Issues. One folder per line. Template folders are always excluded.",
						control: {
							type: "textarea",
							key: "excludedFolders",
							placeholder: "Legacy\nImported/Old Vault\nArchive/2023",
						},
					},
				],
			},
			{
				name: "Auto-link on save",
				desc: "Rewrite known entity names as wikilinks each time a file is saved. Off by default — use the command instead.",
				control: { type: "toggle", key: "enableAutolinkOnSave" },
			},
			{
				type: "group",
				heading: "Agent integration",
				items: [
					{
						name: "About",
						desc: "Generate an AGENTS.md at the campaign root that explains the folder layout, frontmatter schema, and search recipes to a coding assistant. A hand-authored AGENTS.md or CLAUDE.md is never overwritten — a '.generated.md' sibling is written instead.",
					},
					{
						name: "Also write CLAUDE.md",
						desc: "Write a short CLAUDE.md next to AGENTS.md that points assistants at the full guide.",
						control: { type: "toggle", key: "agentGuide.emitClaudeMd" },
					},
					{
						name: "Generate agent guide now",
						desc: "Write AGENTS.md (and CLAUDE.md, if enabled) for the active campaign.",
						action: () => void this.plugin.generateAgentGuide(),
					},
					{
						name: "Index scope",
						desc: "All includes every entity. Player omits entities not marked visible to players.",
						control: {
							type: "dropdown",
							key: "agentGuide.indexScope",
							options: { all: "All", player: "Player" },
						},
					},
					{
						name: "Auto-export the campaign index",
						desc: "Rewrite campaign-index.json a few seconds after the entity index changes. Off by default.",
						control: { type: "toggle", key: "agentGuide.autoExportIndex" },
					},
					{
						name: "Export campaign index now",
						desc: "Write campaign-index.json for the active campaign.",
						action: () => void this.plugin.exportCampaignIndex(),
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === "excludedFolders") {
			return this.plugin.settings.excludedFolders.join("\n");
		}
		return getByPath(this.plugin.settings as unknown as Record<string, unknown>, key);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === "excludedFolders") {
			this.plugin.settings.excludedFolders = String(value)
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line.length > 0);
			await this.plugin.saveSettings();
			this.plugin.entityIndex.rebuildAll();
			return;
		}
		const stored =
			key === "campaignRoot" ||
			key === "mapsFolder" ||
			key.startsWith("folders.")
				? String(value).trim()
				: value;
		setByPath(this.plugin.settings as unknown as Record<string, unknown>, key, stored);
		await this.plugin.saveSettings();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const deviceNote = containerEl.createDiv({ cls: "campaign-dep-status" });
		deviceNote.createEl("p", {
			text: "Optimized for desktop and tablet. Mobile is usable for quick additions and references (slash commands, secrets, quick notes, statblocks, quest board, timeline), but canvas views (Campaign Map, NPC Relationship Graph) and multi-panel layouts are not ideal on small touch screens.",
			cls: "campaign-dep-note",
		});

		const depStatus = containerEl.createDiv({ cls: "campaign-dep-status" });
		const tmpl = this.plugin.templater.isAvailable();
		const dv = this.plugin.dataview.isAvailable();
		depStatus.createEl("p", {
			text: `Templater (optional): ${tmpl ? "detected" : "not installed"} \u00B7 Dataview (optional): ${dv ? "detected" : "not installed"}`,
			cls: dv ? "campaign-ok" : "campaign-warn",
		});
		depStatus.createEl("p", {
			text: "Dataview is recommended for entity queries in notes. Templater is no longer required \u2014 the plugin uses built-in templates.",
			cls: "campaign-dep-note",
		});

		new Setting(containerEl).setName("Campaign folder").setHeading();
		const active = this.plugin.getActiveCampaignRoot();
		const activeNote = containerEl.createDiv({ cls: "campaign-dep-note" });
		activeNote.createEl("p", {
			text: `Active campaign (auto-detected from current file or default): ${active}`,
			cls: active !== this.plugin.settings.campaignRoot ? "campaign-warn" : "campaign-ok",
		});
		new Setting(containerEl)
			.setName("Default campaign root")
			.setDesc("Used when no campaign file is currently open. New entities go here unless you're editing a file inside another campaign. Use 'Switch active campaign' to change.")
			.addText((t) =>
				t.setValue(this.plugin.settings.campaignRoot).onChange(async (v) => {
					this.plugin.settings.campaignRoot = v.trim();
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName("Entity subfolders").setHeading();
		containerEl.createEl("p", {
			text: `Relative to ${this.plugin.settings.campaignRoot}/`,
			cls: "setting-item-description",
		});
		for (const kind of KINDS) {
			new Setting(containerEl)
				.setName(kind.toUpperCase())
				.setDesc(`Subfolder for ${kind} entities`)
				.addText((t) =>
					t
						.setValue(this.plugin.settings.folders[kind])
						.onChange(async (v) => {
							this.plugin.settings.folders[kind] = v.trim();
							await this.plugin.saveSettings();
						}),
				);
		}
		new Setting(containerEl)
			.setName("Maps")
			.setDesc("Subfolder where raw map images live. Drop image files here to pick them directly from the map view. Must be a relative path inside the campaign folder.")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.mapsFolder)
					.onChange(async (v) => {
						const trimmed = v.trim();
						if (trimmed && resolveCampaignSubfolder("_", trimmed) === null) {
							new Notice("Maps folder must be a relative path inside the campaign (no '..' or absolute paths).");
							return;
						}
						this.plugin.settings.mapsFolder = trimmed;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("Validation").setHeading();
		new Setting(containerEl)
			.setName("Strict validation")
			.setDesc("Show a notice when opening a file with schema errors.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.strictValidation).onChange(async (v) => {
					this.plugin.settings.strictValidation = v;
					await this.plugin.saveSettings();
				}),
			);
		new Setting(containerEl)
			.setName("Excluded folders")
			.setDesc(
				"Folders the plugin should ignore entirely. Files inside these folders will not appear in Campaign Issues and will not be indexed as entities. One folder per line. Template folders are always excluded automatically, so you do not need to list them here.",
			)
			.addTextArea((t) => {
				t.setPlaceholder("Legacy\nImported/Old Vault\nArchive/2023");
				t.setValue(this.plugin.settings.excludedFolders.join("\n"));
				t.inputEl.rows = 5;
				t.inputEl.addClass("campaign-excluded-folders-input");
				t.onChange(async (v) => {
					this.plugin.settings.excludedFolders = v
						.split(/\r?\n/)
						.map((line) => line.trim())
						.filter((line) => line.length > 0);
					await this.plugin.saveSettings();
					this.plugin.entityIndex.rebuildAll();
				});
			});

		new Setting(containerEl).setName("Auto-link").setHeading();
		new Setting(containerEl)
			.setName("Auto-link on save")
			.setDesc("Rewrite known entity names as wikilinks each time a file is saved. Off by default \u2014 use the command instead.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableAutolinkOnSave).onChange(async (v) => {
					this.plugin.settings.enableAutolinkOnSave = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName("Agent integration").setHeading();
		containerEl.createEl("p", {
			text: "Generate an AGENTS.md at the campaign root that explains the folder layout, frontmatter schema, and search recipes to a coding assistant (Claude Code, Codex, and similar). Run the 'Generate agent guide' command to write or refresh it.",
			cls: "setting-item-description",
		});
		containerEl.createEl("p", {
			text: "A hand-authored AGENTS.md or CLAUDE.md is never overwritten: if one exists that this plugin did not create, the guide is written to a '.generated.md' sibling instead.",
			cls: "setting-item-description",
		});
		new Setting(containerEl)
			.setName("Also write CLAUDE.md")
			.setDesc("Write a short CLAUDE.md next to AGENTS.md that points assistants at the full guide.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.agentGuide.emitClaudeMd).onChange(async (v) => {
					this.plugin.settings.agentGuide.emitClaudeMd = v;
					await this.plugin.saveSettings();
				}),
			);
		new Setting(containerEl)
			.setName("Generate agent guide now")
			.setDesc("Write AGENTS.md (and CLAUDE.md, if enabled) for the active campaign.")
			.addButton((b) =>
				b.setButtonText("Generate").onClick(() => this.plugin.generateAgentGuide()),
			);

		containerEl.createEl("p", {
			text: "The campaign index is a machine-readable campaign-index.json listing every entity (id, kind, name, path, aliases, visibility, tags, links) so an assistant can load one file instead of scanning the vault. It is written to the active campaign (the one containing the open file, or the default).",
			cls: "setting-item-description",
		});
		new Setting(containerEl)
			.setName("Index scope")
			.setDesc("All includes every entity. Player omits entities not marked visible to players (visibility set to player or both).")
			.addDropdown((d) =>
				d
					.addOption("all", "All")
					.addOption("player", "Player")
					.setValue(this.plugin.settings.agentGuide.indexScope)
					.onChange(async (v) => {
						this.plugin.settings.agentGuide.indexScope =
							v === "player" ? "player" : "all";
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Auto-export the campaign index")
			.setDesc("Rewrite campaign-index.json a few seconds after the entity index changes. Off by default.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.agentGuide.autoExportIndex).onChange(async (v) => {
					this.plugin.settings.agentGuide.autoExportIndex = v;
					await this.plugin.saveSettings();
				}),
			);
		new Setting(containerEl)
			.setName("Export campaign index now")
			.setDesc("Write campaign-index.json for the active campaign.")
			.addButton((b) =>
				b.setButtonText("Export").onClick(() => this.plugin.exportCampaignIndex()),
			);

	}
}
