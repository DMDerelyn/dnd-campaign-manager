import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type { EntityIndex } from "./entity-index";

export const DIAGNOSTICS_VIEW_TYPE = "campaign-diagnostics";

export class DiagnosticsView extends ItemView {
	private detach: (() => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private index: EntityIndex,
	) {
		super(leaf);
	}

	getViewType(): string {
		return DIAGNOSTICS_VIEW_TYPE;
	}
	getDisplayText(): string {
		return "Campaign issues";
	}
	getIcon(): string {
		return "alert-triangle";
	}

	async onOpen(): Promise<void> {
		this.render();
		this.detach = this.index.onChange(() => this.render());
	}

	async onClose(): Promise<void> {
		this.detach?.();
		this.detach = null;
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("campaign-diagnostics");

		const header = contentEl.createEl("div", { cls: "campaign-diag-header" });
		const diags = this.index.allDiagnostics();
		header.createEl("h3", { text: `Campaign issues (${diags.length})` });

		if (diags.length === 0) {
			contentEl.createEl("p", {
				text: "No schema issues detected.",
				cls: "campaign-diag-empty",
			});
			return;
		}

		for (const diag of diags) {
			const card = contentEl.createEl("div", { cls: "campaign-diag-card" });
			const title = card.createEl("a", {
				text: diag.path,
				cls: "campaign-diag-file",
			});
			title.addEventListener("click", (e) => {
				e.preventDefault();
				const file = this.app.vault.getAbstractFileByPath(diag.path);
				if (file instanceof TFile) this.app.workspace.getLeaf(false).openFile(file);
			});
			const list = card.createEl("ul", { cls: "campaign-diag-list" });
			for (const issue of diag.issues) {
				const li = list.createEl("li");
				if (issue.path) {
					li.createEl("code", { text: issue.path });
					li.createSpan({ text: ": " });
				}
				li.createSpan({ text: issue.message });
			}
		}
	}
}
