import { ItemView, WorkspaceLeaf, TFile, Setting, Notice } from "obsidian";
import type CampaignPlugin from "../../main";
import {
	type CombatState,
	type Combatant,
	type Condition,
	ALL_CONDITIONS,
	createCombatState,
	addCombatant,
	removeCombatant,
	nextTurn,
	prevTurn,
	adjustHP,
	toggleCondition,
	updateInitiative,
	rollInitiativeValue,
	currentCombatant,
} from "./turn-engine";
import { ulid } from "../../core/ulid";
import { EntityPickerModal } from "../../ui/modals/entity-picker";

export const INITIATIVE_VIEW_TYPE = "campaign-initiative";

export class InitiativeTrackerView extends ItemView {
	private state: CombatState = createCombatState();

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CampaignPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return INITIATIVE_VIEW_TYPE;
	}
	getDisplayText(): string {
		return "Initiative Tracker";
	}
	getIcon(): string {
		return "swords";
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	setCombatState(state: CombatState): void {
		this.state = state;
		this.render();
	}

	getCombatState(): CombatState {
		return this.state;
	}

	private update(next: CombatState): void {
		this.state = next;
		this.render();
	}

	private render(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("campaign-initiative");

		this.renderToolbar(el);

		if (this.state.combatants.length === 0) {
			el.createEl("p", {
				text: "No combatants. Add PCs from the index or create NPCs above.",
				cls: "campaign-init-empty",
			});
			return;
		}

		this.renderRoundInfo(el);
		this.renderCombatantList(el);
	}

	private renderToolbar(el: HTMLElement): void {
		const bar = el.createDiv({ cls: "campaign-init-toolbar" });

		const activeRoot = this.plugin.getActiveCampaignRoot();
		bar.createEl("div", {
			text: `Campaign: ${activeRoot}`,
			cls: "campaign-init-campaign-label",
		});

		const addPC = bar.createEl("button", { text: "Add PCs", cls: "campaign-init-btn" });
		addPC.addEventListener("click", () => this.addPCsFromIndex());

		const addNPC = bar.createEl("button", { text: "Add NPC", cls: "campaign-init-btn" });
		addNPC.addEventListener("click", () => this.addNPCFromIndex());

		const addCustom = bar.createEl("button", { text: "Add Custom", cls: "campaign-init-btn" });
		addCustom.addEventListener("click", () => this.addManualCombatant(false));

		const rollAll = bar.createEl("button", { text: "Roll All NPCs", cls: "campaign-init-btn" });
		rollAll.addEventListener("click", () => this.rollAllNPCs());

		if (this.state.combatants.length > 0) {
			const clear = bar.createEl("button", { text: "Clear", cls: "campaign-init-btn campaign-init-btn-danger" });
			clear.addEventListener("click", () => this.update(createCombatState()));
		}
	}

	private renderRoundInfo(el: HTMLElement): void {
		const info = el.createDiv({ cls: "campaign-init-round" });
		const cur = currentCombatant(this.state);

		const prevBtn = info.createEl("button", { text: "\u25C0", cls: "campaign-init-nav" });
		prevBtn.addEventListener("click", () => this.update(prevTurn(this.state)));

		info.createEl("span", {
			text: `Round ${this.state.round}`,
			cls: "campaign-init-round-num",
		});

		if (cur) {
			info.createEl("span", {
				text: ` — ${cur.name}'s turn`,
				cls: "campaign-init-current",
			});
		}

		const nextBtn = info.createEl("button", { text: "\u25B6", cls: "campaign-init-nav" });
		nextBtn.addEventListener("click", () => this.update(nextTurn(this.state)));
	}

	private renderCombatantList(el: HTMLElement): void {
		const list = el.createDiv({ cls: "campaign-init-list" });
		for (let i = 0; i < this.state.combatants.length; i++) {
			const c = this.state.combatants[i];
			const active = i === this.state.turnIndex;
			this.renderCombatantRow(list, c, active);
		}
	}

	private renderCombatantRow(parent: HTMLElement, c: Combatant, active: boolean): void {
		const row = parent.createDiv({
			cls: `campaign-init-row ${active ? "campaign-init-active" : ""} ${c.hp.current <= 0 ? "campaign-init-down" : ""}`,
		});

		const left = row.createDiv({ cls: "campaign-init-row-left" });
		const initInput = left.createEl("input", {
			type: "number",
			cls: "campaign-init-init-input",
			value: String(c.initiative),
		});
		initInput.style.width = "3em";
		initInput.addEventListener("change", () => {
			this.update(updateInitiative(this.state, c.id, parseInt(initInput.value, 10) || 0));
		});

		const nameEl = left.createEl("span", { text: c.name, cls: "campaign-init-name" });
		if (c.entityPath) {
			nameEl.addClass("campaign-init-name-link");
			nameEl.addEventListener("click", () => {
				const file = this.app.vault.getAbstractFileByPath(c.entityPath!);
				if (file instanceof TFile) this.app.workspace.getLeaf(false).openFile(file);
			});
		}

		if (c.isPC) {
			left.createEl("span", { text: " (PC)", cls: "campaign-init-tag" });
		}

		const mid = row.createDiv({ cls: "campaign-init-row-mid" });
		const hpBar = mid.createDiv({ cls: "campaign-init-hp-bar" });
		const pct = c.hp.max > 0 ? Math.max(0, c.hp.current / c.hp.max) * 100 : 0;
		const fill = hpBar.createDiv({ cls: "campaign-init-hp-fill" });
		fill.style.width = `${pct}%`;
		fill.style.backgroundColor = pct > 50 ? "var(--color-green)" : pct > 25 ? "var(--color-yellow)" : "var(--color-red)";

		const hpText = mid.createEl("span", {
			text: `${c.hp.current}/${c.hp.max}${c.hp.temp > 0 ? ` +${c.hp.temp}t` : ""} HP | AC ${c.ac}`,
			cls: "campaign-init-hp-text",
		});

		const hpControls = mid.createDiv({ cls: "campaign-init-hp-controls" });
		const dmgBtn = hpControls.createEl("button", { text: "-5", cls: "campaign-init-hp-btn" });
		dmgBtn.addEventListener("click", () => this.update(adjustHP(this.state, c.id, -5)));
		const dmg1 = hpControls.createEl("button", { text: "-1", cls: "campaign-init-hp-btn" });
		dmg1.addEventListener("click", () => this.update(adjustHP(this.state, c.id, -1)));
		const heal1 = hpControls.createEl("button", { text: "+1", cls: "campaign-init-hp-btn" });
		heal1.addEventListener("click", () => this.update(adjustHP(this.state, c.id, 1)));
		const heal5 = hpControls.createEl("button", { text: "+5", cls: "campaign-init-hp-btn" });
		heal5.addEventListener("click", () => this.update(adjustHP(this.state, c.id, 5)));

		const right = row.createDiv({ cls: "campaign-init-row-right" });
		if (c.conditions.length > 0) {
			const chips = right.createDiv({ cls: "campaign-init-conditions" });
			for (const cond of c.conditions) {
				const chip = chips.createEl("span", { text: cond, cls: "campaign-init-cond-chip" });
				chip.addEventListener("click", () => this.update(toggleCondition(this.state, c.id, cond)));
			}
		}

		const condBtn = right.createEl("button", { text: "+Cond", cls: "campaign-init-btn-sm" });
		condBtn.addEventListener("click", () => this.showConditionPicker(c));

		const removeBtn = right.createEl("button", { text: "\u2716", cls: "campaign-init-btn-sm campaign-init-btn-danger" });
		removeBtn.addEventListener("click", () => this.update(removeCombatant(this.state, c.id)));
	}

	private async addPCsFromIndex(): Promise<void> {
		const pcs = this.plugin.byKindInActiveCampaign("pc");
		if (pcs.length === 0) {
			const root = this.plugin.getActiveCampaignRoot();
			new Notice(
				`No PCs in active campaign (${root}). Create PCs with 'Campaign: Create PC' or open a file in a different campaign to switch.`,
			);
			return;
		}
		let s = this.state;
		let added = 0;
		for (const pc of pcs) {
			if (s.combatants.some((c) => c.entityPath === pc.path)) continue;
			const fm = pc.frontmatter;
			const hp = fm.hp as { current?: number; max?: number } | undefined;
			s = addCombatant(s, {
				id: ulid(),
				name: pc.name,
				entityPath: pc.path,
				initiative: 0,
				hp: {
					current: (hp?.current as number) ?? 10,
					max: (hp?.max as number) ?? 10,
					temp: 0,
				},
				ac: typeof fm.ac === "number" ? fm.ac : 10,
				isPC: true,
				conditions: [],
				notes: "",
			});
			added++;
		}
		this.update({ ...s, active: true });
		if (added === 0) new Notice("All PCs already in tracker.");
		else new Notice(`Added ${added} PC(s). Players should enter their own initiative, or edit the field.`);
	}

	private async addNPCFromIndex(): Promise<void> {
		const npcs = this.plugin.byKindInActiveCampaign("npc");
		if (npcs.length === 0) {
			new Notice("No NPCs in active campaign. Use 'Add Custom' for one-off enemies.");
			return;
		}
		const modal = new EntityPickerModal(
			this.app,
			this.plugin.entityIndex,
			["npc"],
			"Pick an NPC to add to combat\u2026",
		);
		const picked = await modal.pick();
		if (!picked) return;
		const root = this.plugin.getActiveCampaignRoot();
		if (!picked.path.startsWith(`${root}/`)) {
			new Notice(`That NPC isn't in the active campaign (${root}).`);
			return;
		}
		const fm = picked.frontmatter;
		const hp = fm.hp as { current?: number; max?: number } | undefined;
		const hpMax = typeof hp?.max === "number" ? hp.max : typeof fm.hp_max === "number" ? fm.hp_max : 10;
		this.update(
			addCombatant(this.state, {
				id: ulid(),
				name: picked.name,
				entityPath: picked.path,
				initiative: 0,
				hp: { current: hpMax, max: hpMax, temp: 0 },
				ac: typeof fm.ac === "number" ? fm.ac : 10,
				isPC: false,
				conditions: [],
				notes: "",
			}),
		);
		new Notice(`Added ${picked.name}. Click Roll All NPCs to roll initiative.`);
	}

	private addManualCombatant(isPC: boolean): void {
		const modal = new AddCombatantModal(this.app, isPC, (c) => {
			this.update(addCombatant(this.state, c));
		});
		modal.open();
	}

	private rollAllNPCs(): void {
		let s = this.state;
		let rolled = 0;
		for (const c of s.combatants) {
			if (!c.isPC) {
				s = updateInitiative(s, c.id, rollInitiativeValue());
				rolled++;
			}
		}
		this.update(s);
		if (rolled === 0) new Notice("No NPCs to roll.");
		else new Notice(`Rolled initiative for ${rolled} NPC(s).`);
	}

	private showConditionPicker(combatant: Combatant): void {
		const modal = new ConditionPickerModal(this.app, combatant.conditions, (cond) => {
			this.update(toggleCondition(this.state, combatant.id, cond));
		});
		modal.open();
	}
}

import { Modal, App } from "obsidian";

class AddCombatantModal extends Modal {
	private name = "";
	private hp = 10;
	private ac = 10;
	private initiative = 0;

	constructor(
		app: App,
		private isPC: boolean,
		private onSubmit: (c: Combatant) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.createEl("h3", { text: this.isPC ? "Add PC" : "Add NPC" });

		new Setting(this.contentEl).setName("Name").addText((t) =>
			t.onChange((v) => (this.name = v)),
		);
		new Setting(this.contentEl).setName("HP").addText((t) =>
			t.setValue("10").onChange((v) => (this.hp = parseInt(v, 10) || 10)),
		);
		new Setting(this.contentEl).setName("AC").addText((t) =>
			t.setValue("10").onChange((v) => (this.ac = parseInt(v, 10) || 10)),
		);
		new Setting(this.contentEl).setName("Initiative").addText((t) =>
			t.setValue("0").onChange((v) => (this.initiative = parseInt(v, 10) || 0)),
		);

		new Setting(this.contentEl).addButton((b) =>
			b
				.setButtonText("Add")
				.setCta()
				.onClick(() => {
					if (!this.name.trim()) return;
					this.onSubmit({
						id: ulid(),
						name: this.name.trim(),
						initiative: this.initiative,
						hp: { current: this.hp, max: this.hp, temp: 0 },
						ac: this.ac,
						isPC: this.isPC,
						conditions: [],
						notes: "",
					});
					this.close();
				}),
		);
	}
}

class ConditionPickerModal extends Modal {
	constructor(
		app: App,
		private existing: Condition[],
		private onPick: (c: Condition) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.createEl("h3", { text: "Toggle Condition" });
		const grid = this.contentEl.createDiv({ cls: "campaign-cond-grid" });
		for (const cond of ALL_CONDITIONS) {
			const btn = grid.createEl("button", {
				text: cond,
				cls: `campaign-cond-btn ${this.existing.includes(cond) ? "campaign-cond-active" : ""}`,
			});
			btn.addEventListener("click", () => {
				this.onPick(cond);
				this.close();
			});
		}
	}
}
