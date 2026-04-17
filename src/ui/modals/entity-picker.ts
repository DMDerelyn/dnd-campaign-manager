import { FuzzySuggestModal } from "obsidian";
import type { App } from "obsidian";
import type { EntityKind } from "../../schemas";
import type { EntityIndex, IndexedEntity } from "../../core/entity-index";

export class EntityPickerModal extends FuzzySuggestModal<IndexedEntity> {
	private resolver: ((e: IndexedEntity | undefined) => void) | null = null;
	private chosen: IndexedEntity | undefined = undefined;

	constructor(
		app: App,
		private index: EntityIndex,
		private kinds?: EntityKind[],
		placeholder = "Pick a campaign entity\u2026",
	) {
		super(app);
		this.setPlaceholder(placeholder);
	}

	getItems(): IndexedEntity[] {
		const kinds: EntityKind[] = this.kinds ?? [
			"pc", "npc", "quest", "location", "session", "faction", "item",
		];
		const all: IndexedEntity[] = [];
		for (const kind of kinds) all.push(...this.index.byKind(kind));
		return all;
	}

	getItemText(item: IndexedEntity): string {
		return `[${item.kind}] ${item.name}`;
	}

	onChooseItem(item: IndexedEntity): void {
		this.chosen = item;
		if (this.resolver) {
			this.resolver(item);
			this.resolver = null;
		}
	}

	onClose(): void {
		// Defer so onChooseItem (which fires in the same tick) wins if the user picked.
		setTimeout(() => {
			if (this.resolver) {
				this.resolver(this.chosen);
				this.resolver = null;
			}
		}, 0);
	}

	pick(): Promise<IndexedEntity | undefined> {
		return new Promise((resolve) => {
			this.resolver = resolve;
			this.open();
		});
	}
}
