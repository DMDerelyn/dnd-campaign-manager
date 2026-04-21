import { FuzzySuggestModal, TFile, TFolder } from "obsidian";
import type { App } from "obsidian";
import type CampaignPlugin from "../../main";
import type { IndexedEntity } from "../../core/entity-index";
import { resolveCampaignSubfolder } from "../../core/path-safety";

export type MapPickerItem =
	| { kind: "location"; entity: IndexedEntity; label: string }
	| { kind: "image"; path: string; label: string };

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);
const MAX_BREADCRUMB_DEPTH = 8;

export class MapPickerModal extends FuzzySuggestModal<MapPickerItem> {
	private resolver: ((item: MapPickerItem | undefined) => void) | null = null;
	private chosen: MapPickerItem | undefined = undefined;

	constructor(
		app: App,
		private plugin: CampaignPlugin,
	) {
		super(app);
		this.setPlaceholder("Pick a map\u2026");
	}

	getItems(): MapPickerItem[] {
		const items: MapPickerItem[] = [];
		const claimedImagePaths = new Set<string>();

		const locations = this.plugin.byKindInActiveCampaign("location");
		const locationItems: MapPickerItem[] = [];
		for (const entity of locations) {
			const mapImage = entity.frontmatter.map_image;
			if (typeof mapImage !== "string" || !mapImage) continue;
			claimedImagePaths.add(mapImage);
			const breadcrumb = this.buildBreadcrumb(entity);
			const missing = !(this.app.vault.getAbstractFileByPath(mapImage) instanceof TFile);
			const label = missing ? `${breadcrumb} \u2014 (no image file found)` : breadcrumb;
			locationItems.push({ kind: "location", entity, label });
		}
		locationItems.sort((a, b) => a.label.localeCompare(b.label));
		items.push(...locationItems);

		const folderPath = this.resolveMapsFolder();
		const folder = folderPath
			? this.app.vault.getAbstractFileByPath(folderPath)
			: null;
		const imageItems: MapPickerItem[] = [];
		if (folder instanceof TFolder) {
			this.collectImages(folder, claimedImagePaths, imageItems);
		}
		imageItems.sort((a, b) => a.label.localeCompare(b.label));
		items.push(...imageItems);

		return items;
	}

	getItemText(item: MapPickerItem): string {
		return item.label;
	}

	onChooseItem(item: MapPickerItem): void {
		this.chosen = item;
		if (this.resolver) {
			this.resolver(item);
			this.resolver = null;
		}
	}

	onClose(): void {
		setTimeout(() => {
			if (this.resolver) {
				this.resolver(this.chosen);
				this.resolver = null;
			}
		}, 0);
	}

	pick(): Promise<MapPickerItem | undefined> {
		return new Promise((resolve) => {
			this.resolver = resolve;
			this.open();
		});
	}

	private resolveMapsFolder(): string | null {
		const root = this.plugin.getActiveCampaignRoot();
		if (!root) return null;
		return resolveCampaignSubfolder(root, this.plugin.settings.mapsFolder);
	}

	private collectImages(
		folder: TFolder,
		claimed: Set<string>,
		out: MapPickerItem[],
	): void {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				this.collectImages(child, claimed, out);
				continue;
			}
			if (!(child instanceof TFile)) continue;
			const ext = child.extension.toLowerCase();
			if (!IMAGE_EXTS.has(ext)) continue;
			if (claimed.has(child.path)) continue;
			out.push({
				kind: "image",
				path: child.path,
				label: `Unattached \u25b8 ${child.name}`,
			});
		}
	}

	private buildBreadcrumb(entity: IndexedEntity): string {
		const chain = [entity.name];
		const seen = new Set<string>([entity.path]);
		let current: IndexedEntity | undefined = entity;
		for (let i = 0; i < MAX_BREADCRUMB_DEPTH; i++) {
			const parentLink = current?.frontmatter.parent;
			if (typeof parentLink !== "string" || !parentLink) break;
			const parentName = parentLink.replace(/^\[\[(.+?)(\|.+)?\]\]$/, "$1").trim();
			if (!parentName) break;
			const parentEntity = this.plugin.entityIndex.getByAlias(parentName);
			if (!parentEntity || seen.has(parentEntity.path)) break;
			seen.add(parentEntity.path);
			chain.unshift(parentEntity.name);
			current = parentEntity;
		}
		return chain.join(" \u25b8 ");
	}
}
