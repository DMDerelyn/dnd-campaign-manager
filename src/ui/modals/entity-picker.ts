import { FuzzySuggestModal } from "obsidian";
import type { App } from "obsidian";
import type { EntityIndex, IndexedEntity } from "../../core/entity-index";

export class EntityPickerModal extends FuzzySuggestModal<IndexedEntity> {
	private resolver: ((e: IndexedEntity | undefined) => void) | null = null;

	constructor(
		app: App,
		private index: EntityIndex,
	) {
		super(app);
		this.setPlaceholder("Pick a campaign entity…");
	}

	getItems(): IndexedEntity[] {
		const all: IndexedEntity[] = [];
		for (const kind of ["pc", "npc", "quest", "location", "session", "faction", "item"] as const) {
			all.push(...this.index.byKind(kind));
		}
		return all;
	}

	getItemText(item: IndexedEntity): string {
		return `[${item.kind}] ${item.name}`;
	}

	onChooseItem(item: IndexedEntity): void {
		this.resolver?.(item);
		this.resolver = null;
	}

	onClose(): void {
		if (this.resolver) {
			this.resolver(undefined);
			this.resolver = null;
		}
	}

	pick(): Promise<IndexedEntity | undefined> {
		return new Promise((resolve) => {
			this.resolver = resolve;
			this.open();
		});
	}
}
