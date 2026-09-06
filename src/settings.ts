import { Notice, PluginSettingTab, Setting, App } from "obsidian";
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
	agentGuide: {
		emitClaudeMd: false,
		autoExportIndex: false,
		indexScope: "all",
	},
};

const KINDS: EntityKind[] = ["pc", "npc", "quest", "location", "session", "faction", "item"];

export class CampaignSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: CampaignPlugin,
	) {
		super(app, plugin);
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
