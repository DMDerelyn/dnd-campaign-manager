import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type CampaignPlugin from "../../main";
import type { IndexedEntity } from "../../core/entity-index";
import { extractSessionLog, type TimelineEntry } from "./parser";

export const TIMELINE_VIEW_TYPE = "campaign-timeline";

interface SessionBucket {
	entity: IndexedEntity;
	number: number;
	date: string;
	entries: TimelineEntry[];
}

export class TimelineView extends ItemView {
	private detachIndex: (() => void) | null = null;
	private detachLeaf: (() => void) | null = null;
	private filter = "";
	private buckets: SessionBucket[] = [];
	private bucketsCampaign = "";

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CampaignPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return TIMELINE_VIEW_TYPE;
	}
	getDisplayText(): string {
		return "Campaign Timeline";
	}
	getIcon(): string {
		return "history";
	}

	async onOpen(): Promise<void> {
		await this.rebuildAndRender();
		this.detachIndex = this.plugin.entityIndex.onChange(() => {
			this.rebuildAndRender().catch((err) => console.warn("Timeline render:", err));
		});
		const ref = this.plugin.app.workspace.on("active-leaf-change", () => {
			this.rebuildAndRender().catch((err) => console.warn("Timeline render:", err));
		});
		this.plugin.registerEvent(ref);
		this.detachLeaf = () => this.plugin.app.workspace.offref(ref);
	}

	/** Refetch + cache session log buckets, then re-render. */
	private async rebuildAndRender(): Promise<void> {
		await this.rebuildBuckets();
		this.render();
	}

	private async rebuildBuckets(): Promise<void> {
		const activeRoot = this.plugin.getActiveCampaignRoot();
		this.bucketsCampaign = activeRoot;
		const sessions = this.plugin.byKindInActiveCampaign("session");
		const out: SessionBucket[] = [];
		for (const session of sessions) {
			const file = this.plugin.app.vault.getAbstractFileByPath(session.path);
			if (!(file instanceof TFile)) continue;
			const content = await this.plugin.app.vault.read(file);
			const entries = extractSessionLog(content);
			const num = typeof session.frontmatter.number === "number"
				? session.frontmatter.number
				: 0;
			const date = typeof session.frontmatter.date === "string"
				? session.frontmatter.date
				: "";
			out.push({ entity: session, number: num, date, entries });
		}
		out.sort((a, b) => {
			if (a.number !== b.number) return a.number - b.number;
			return a.date.localeCompare(b.date);
		});
		this.buckets = out;
	}

	async onClose(): Promise<void> {
		this.detachIndex?.();
		this.detachIndex = null;
		this.detachLeaf?.();
		this.detachLeaf = null;
	}

	private render(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("campaign-timeline");

		const toolbar = el.createDiv({ cls: "campaign-map-toolbar" });
		toolbar.createEl("span", {
			text: `Campaign: ${this.bucketsCampaign}`,
			cls: "campaign-init-campaign-label",
		});

		const filterInput = toolbar.createEl("input", {
			type: "text",
			cls: "campaign-timeline-filter",
			attr: { placeholder: "Filter entries (e.g. Goruk)" },
		});
		filterInput.value = this.filter;
		filterInput.addEventListener("input", () => {
			this.filter = filterInput.value.toLowerCase();
			this.renderList(listHost);
		});

		const listHost = el.createDiv({ cls: "campaign-timeline-list" });
		this.renderList(listHost);
	}

	private renderList(host: HTMLElement): void {
		host.empty();
		if (this.buckets.length === 0) {
			host.createEl("p", {
				text: "No sessions in this campaign. Create one with 'Campaign: Create Session'.",
				cls: "campaign-init-empty",
			});
			return;
		}

		const filter = this.filter;
		let shown = 0;
		for (const bucket of this.buckets) {
			const filtered = filter
				? bucket.entries.filter((e) => e.text.toLowerCase().includes(filter))
				: bucket.entries;
			if (filter && filtered.length === 0) continue;

			const section = host.createDiv({ cls: "campaign-timeline-session" });
			const header = section.createDiv({ cls: "campaign-timeline-session-header" });
			const title = header.createEl("a", {
				text: `Session ${bucket.number}: ${bucket.entity.name}`,
				cls: "campaign-timeline-session-title",
			});
			title.addEventListener("click", (e) => {
				e.preventDefault();
				const file = this.plugin.app.vault.getAbstractFileByPath(bucket.entity.path);
				if (file instanceof TFile) this.plugin.app.workspace.getLeaf(false).openFile(file);
			});
			if (bucket.date) {
				header.createEl("span", {
					text: bucket.date,
					cls: "campaign-timeline-session-date",
				});
			}

			if (filtered.length === 0) {
				section.createEl("p", {
					text: "No log entries yet.",
					cls: "campaign-timeline-empty-session",
				});
				continue;
			}
			const list = section.createEl("ul", { cls: "campaign-timeline-entries" });
			for (const entry of filtered) {
				const li = list.createEl("li");
				if (entry.timestamp) {
					li.createEl("span", {
						text: entry.timestamp,
						cls: "campaign-timeline-entry-ts",
					});
					li.createSpan({ text: " " });
				}
				li.createSpan({ text: entry.text });
				shown++;
			}
		}

		if (filter && shown === 0) {
			host.createEl("p", {
				text: `No log entries match "${filter}".`,
				cls: "campaign-init-empty",
			});
		}
	}
}
