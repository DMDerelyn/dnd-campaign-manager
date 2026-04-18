import { MarkdownPostProcessorContext } from "obsidian";
import { parseYaml } from "obsidian";
import {
	normalizeStatblock,
	abilityMod,
	type StatblockData,
	type StatblockAction,
} from "./normalize";

export { normalizeStatblock } from "./normalize";
export type { StatblockData, StatblockAction } from "./normalize";

export function renderStatblock(
	source: string,
	el: HTMLElement,
	_ctx: MarkdownPostProcessorContext,
): void {
	let parsed: unknown;
	try {
		parsed = parseYaml(source);
	} catch (err) {
		renderError(el, `Invalid YAML: ${(err as Error).message}`);
		return;
	}

	const data = normalizeStatblock(parsed);
	if (typeof data === "string") {
		renderError(el, data);
		return;
	}

	renderBlock(el, data);
}

function renderError(el: HTMLElement, message: string): void {
	const box = el.createDiv({ cls: "campaign-statblock-error" });
	box.createEl("strong", { text: "Statblock error: " });
	box.createSpan({ text: message });
}

function renderBlock(el: HTMLElement, data: StatblockData): void {
	const block = el.createDiv({ cls: "campaign-statblock" });

	block.createEl("div", { text: data.name, cls: "campaign-statblock-name" });
	const subtitle = [data.size, data.type, data.alignment].filter(Boolean).join(", ");
	if (subtitle) {
		block.createEl("div", { text: subtitle, cls: "campaign-statblock-sub" });
	}

	const sep1 = block.createEl("div", { cls: "campaign-statblock-rule" });
	sep1.setAttribute("role", "separator");

	const topAttrs = block.createDiv({ cls: "campaign-statblock-attrs" });
	if (data.ac !== undefined) renderAttr(topAttrs, "Armor Class", String(data.ac));
	if (data.hp !== undefined) renderAttr(topAttrs, "Hit Points", String(data.hp));
	if (data.speed) renderAttr(topAttrs, "Speed", data.speed);

	if (data.stats) {
		block.createEl("div", { cls: "campaign-statblock-rule" });
		const table = block.createEl("table", { cls: "campaign-statblock-stats" });
		const head = table.createEl("tr");
		const body = table.createEl("tr");
		for (const key of ["str", "dex", "con", "int", "wis", "cha"] as const) {
			const score = data.stats[key];
			head.createEl("th", { text: key.toUpperCase() });
			if (typeof score === "number") {
				body.createEl("td", { text: `${score} (${abilityMod(score)})` });
			} else {
				body.createEl("td", { text: "\u2014" });
			}
		}
	}

	const midAttrs = block.createDiv({ cls: "campaign-statblock-attrs" });
	const midPairs: [string, string | undefined][] = [
		["Saving Throws", normalizeList(data.saves)],
		["Skills", normalizeList(data.skills)],
		["Damage Vulnerabilities", data.damage_vulnerabilities],
		["Damage Resistances", data.damage_resistances],
		["Damage Immunities", data.damage_immunities],
		["Condition Immunities", data.condition_immunities],
		["Senses", data.senses],
		["Languages", data.languages],
		["Challenge", data.cr !== undefined ? String(data.cr) : undefined],
	];
	let anyMid = false;
	for (const [label, value] of midPairs) {
		if (!value) continue;
		renderAttr(midAttrs, label, value);
		anyMid = true;
	}
	if (!anyMid) midAttrs.remove();

	renderActionSection(block, "Traits", data.traits);
	renderActionSection(block, "Actions", data.actions);
	renderActionSection(block, "Bonus Actions", data.bonus_actions);
	renderActionSection(block, "Reactions", data.reactions);
	renderActionSection(block, "Legendary Actions", data.legendary_actions);

	if (data.description) {
		block.createEl("div", { cls: "campaign-statblock-rule" });
		block.createEl("p", { text: data.description, cls: "campaign-statblock-desc" });
	}
}

function renderAttr(parent: HTMLElement, label: string, value: string): void {
	const row = parent.createDiv({ cls: "campaign-statblock-attr-row" });
	row.createEl("strong", { text: `${label} ` });
	row.createSpan({ text: value });
}

function renderActionSection(
	parent: HTMLElement,
	title: string,
	actions: StatblockAction[] | undefined,
): void {
	if (!actions || actions.length === 0) return;
	parent.createEl("h4", { text: title, cls: "campaign-statblock-section" });
	for (const a of actions) {
		const p = parent.createEl("p", { cls: "campaign-statblock-action" });
		p.createEl("em", { text: `${a.name}. ` });
		p.createSpan({ text: a.text });
	}
}

function normalizeList(value: string | string[] | undefined): string | undefined {
	if (!value) return undefined;
	if (Array.isArray(value)) return value.join(", ");
	return value;
}
