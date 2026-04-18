import { PluginSettingTab, Setting, App } from "obsidian";
import type CampaignPlugin from "./main";
import type { EntityKind } from "./schemas";
import { type ThemeId, THEME_LABELS, applyTheme } from "./ui/themes";

export interface CampaignSettings {
	folders: Record<EntityKind, string>;
	campaignRoot: string;
	enableAutolinkOnSave: boolean;
	strictValidation: boolean;
	publishFolder: string;
	publishTitle: string;
	gitRemote: string;
	gitBranch: string;
	theme: ThemeId;
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
	campaignRoot: "Campaigns/My Campaign",
	enableAutolinkOnSave: false,
	strictValidation: false,
	publishFolder: "_site",
	publishTitle: "My Campaign",
	gitRemote: "origin",
	gitBranch: "main",
	theme: "default",
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

		containerEl.createEl("h2", { text: "D&D Campaign Manager settings" });

		const deviceNote = containerEl.createDiv({ cls: "campaign-dep-status" });
		deviceNote.createEl("p", {
			text: "Optimized for desktop and tablet. Mobile is usable for quick additions and references (slash commands, secrets, quick notes, statblocks, quest board, timeline), but canvas views (Campaign Map, NPC Relationship Graph) and multi-panel layouts are not ideal on small touch screens.",
			cls: "campaign-dep-note",
		});

		containerEl.createEl("h3", { text: "Theme" });
		new Setting(containerEl)
			.setName("D&D Theme")
			.setDesc("Visual theme for plugin views (Initiative Tracker, Quest Board, Session Runner, etc.). Does not affect your regular notes.")
			.addDropdown((d) => {
				for (const [id, label] of Object.entries(THEME_LABELS)) {
					d.addOption(id, label);
				}
				d.setValue(this.plugin.settings.theme);
				d.onChange(async (v) => {
					this.plugin.settings.theme = v as ThemeId;
					applyTheme(this.plugin.settings.theme);
					await this.plugin.saveSettings();
				});
			});

		const depStatus = containerEl.createDiv({ cls: "campaign-dep-status" });
		const tmpl = this.plugin.templater.isAvailable();
		const dv = this.plugin.dataview.isAvailable();
		depStatus.createEl("p", {
			text: `Templater (optional): ${tmpl ? "detected" : "not installed"} · Dataview (optional): ${dv ? "detected" : "not installed"}`,
			cls: dv ? "campaign-ok" : "campaign-warn",
		});
		depStatus.createEl("p", {
			text: "Dataview is recommended for entity queries in notes. Templater is no longer required \u2014 the plugin uses built-in templates.",
			cls: "campaign-dep-note",
		});

		containerEl.createEl("h3", { text: "Campaign folder" });
		const active = this.plugin.getActiveCampaignRoot();
		const activeNote = containerEl.createDiv({ cls: "campaign-dep-note" });
		activeNote.createEl("p", {
			text: `Active campaign (auto-detected from current file or default): ${active}`,
			cls: active !== this.plugin.settings.campaignRoot ? "campaign-warn" : "campaign-ok",
		});
		new Setting(containerEl)
			.setName("Default campaign root")
			.setDesc("Used when no campaign file is currently open. New entities go here unless you're editing a file inside another campaign. Use 'Switch Active Campaign' command to change.")
			.addText((t) =>
				t.setValue(this.plugin.settings.campaignRoot).onChange(async (v) => {
					this.plugin.settings.campaignRoot = v.trim();
					await this.plugin.saveSettings();
				}),
			);

		containerEl.createEl("h3", { text: "Entity subfolders" });
		containerEl.createEl("p", { text: `These are relative to ${this.plugin.settings.campaignRoot}/`, cls: "setting-item-description" });
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

		containerEl.createEl("h3", { text: "Validation" });
		new Setting(containerEl)
			.setName("Strict validation")
			.setDesc("Show a notice when opening a file with schema errors.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.strictValidation).onChange(async (v) => {
					this.plugin.settings.strictValidation = v;
					await this.plugin.saveSettings();
				}),
			);

		containerEl.createEl("h3", { text: "Auto-link" });
		new Setting(containerEl)
			.setName("Auto-link on save")
			.setDesc("Rewrite known entity names as wikilinks each time a file is saved. Off by default — use the command instead.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enableAutolinkOnSave).onChange(async (v) => {
					this.plugin.settings.enableAutolinkOnSave = v;
					await this.plugin.saveSettings();
				}),
			);

		containerEl.createEl("h3", { text: "Publishing" });
		new Setting(containerEl)
			.setName("Export folder")
			.setDesc("Folder within the vault where the static site is exported.")
			.addText((t) =>
				t.setValue(this.plugin.settings.publishFolder).onChange(async (v) => {
					this.plugin.settings.publishFolder = v.trim();
					await this.plugin.saveSettings();
				}),
			);
		new Setting(containerEl)
			.setName("Site title")
			.setDesc("Title for the published campaign site.")
			.addText((t) =>
				t.setValue(this.plugin.settings.publishTitle).onChange(async (v) => {
					this.plugin.settings.publishTitle = v.trim();
					await this.plugin.saveSettings();
				}),
			);
		new Setting(containerEl)
			.setName("Git remote")
			.setDesc("Git remote name for auto-push (e.g., origin).")
			.addText((t) =>
				t.setValue(this.plugin.settings.gitRemote).onChange(async (v) => {
					this.plugin.settings.gitRemote = v.trim();
					await this.plugin.saveSettings();
				}),
			);
		new Setting(containerEl)
			.setName("Git branch")
			.setDesc("Branch to push to (e.g., main).")
			.addText((t) =>
				t.setValue(this.plugin.settings.gitBranch).onChange(async (v) => {
					this.plugin.settings.gitBranch = v.trim();
					await this.plugin.saveSettings();
				}),
			);
	}
}
