import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type CampaignPlugin from "../../main";
import type { IndexedEntity } from "../../core/entity-index";

export const NPC_GRAPH_VIEW_TYPE = "campaign-npc-graph";

interface GraphNode {
	entity: IndexedEntity;
	x: number;
	y: number;
}

interface GraphEdge {
	from: string;
	to: string;
	label: string;
}

export class NPCGraphView extends ItemView {
	private detach: (() => void) | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private nodes: GraphNode[] = [];
	private edges: GraphEdge[] = [];
	private dragNode: GraphNode | null = null;
	private offsetX = 0;
	private offsetY = 0;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CampaignPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return NPC_GRAPH_VIEW_TYPE;
	}
	getDisplayText(): string {
		return "NPC Relationships";
	}
	getIcon(): string {
		return "network";
	}

	async onOpen(): Promise<void> {
		this.buildGraph();
		this.renderCanvas();
		this.detach = this.plugin.entityIndex.onChange(() => {
			this.buildGraph();
			this.draw();
		});
	}

	async onClose(): Promise<void> {
		this.detach?.();
		this.detach = null;
	}

	private buildGraph(): void {
		const npcs = this.plugin.entityIndex.byKind("npc");
		const factions = this.plugin.entityIndex.byKind("faction");
		const all = [...npcs, ...factions];

		const pathSet = new Set(all.map((e) => e.path));
		this.nodes = [];
		this.edges = [];

		const cx = 400;
		const cy = 300;
		const radius = Math.min(250, all.length * 30);
		const step = all.length > 0 ? (2 * Math.PI) / all.length : 0;

		for (let i = 0; i < all.length; i++) {
			const e = all[i];
			this.nodes.push({
				entity: e,
				x: cx + radius * Math.cos(i * step),
				y: cy + radius * Math.sin(i * step),
			});
		}

		const nameToPath = new Map<string, string>();
		for (const e of all) {
			nameToPath.set(e.name.toLowerCase(), e.path);
			for (const a of e.aliases) nameToPath.set(a.toLowerCase(), e.path);
		}

		for (const e of all) {
			const fm = e.frontmatter;

			if (Array.isArray(fm.relationships)) {
				for (const rel of fm.relationships as Array<{ target?: string; kind?: string }>) {
					const targetPath = resolveLink(rel.target, nameToPath);
					if (targetPath && pathSet.has(targetPath)) {
						this.edges.push({
							from: e.path,
							to: targetPath,
							label: typeof rel.kind === "string" ? rel.kind : "",
						});
					}
				}
			}

			if (Array.isArray(fm.factions)) {
				for (const f of fm.factions as string[]) {
					const targetPath = resolveLink(f, nameToPath);
					if (targetPath && pathSet.has(targetPath)) {
						this.edges.push({ from: e.path, to: targetPath, label: "member" });
					}
				}
			}

			if (typeof fm.leader === "string") {
				const targetPath = resolveLink(fm.leader, nameToPath);
				if (targetPath && pathSet.has(targetPath)) {
					this.edges.push({ from: e.path, to: targetPath, label: "leader" });
				}
			}

			if (Array.isArray(fm.allies)) {
				for (const a of fm.allies as string[]) {
					const targetPath = resolveLink(a, nameToPath);
					if (targetPath && pathSet.has(targetPath)) {
						this.edges.push({ from: e.path, to: targetPath, label: "ally" });
					}
				}
			}

			if (Array.isArray(fm.enemies)) {
				for (const a of fm.enemies as string[]) {
					const targetPath = resolveLink(a, nameToPath);
					if (targetPath && pathSet.has(targetPath)) {
						this.edges.push({ from: e.path, to: targetPath, label: "enemy" });
					}
				}
			}
		}
	}

	private renderCanvas(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("campaign-npc-graph");

		if (this.nodes.length === 0) {
			el.createEl("p", { text: "No NPCs or factions to graph.", cls: "campaign-init-empty" });
			return;
		}

		this.canvas = el.createEl("canvas", { cls: "campaign-graph-canvas" });
		this.canvas.width = 800;
		this.canvas.height = 600;

		this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
		this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
		this.canvas.addEventListener("mouseup", () => this.onMouseUp());
		this.canvas.addEventListener("dblclick", (e) => this.onDblClick(e));

		this.draw();
	}

	private draw(): void {
		if (!this.canvas) return;
		const ctx = this.canvas.getContext("2d");
		if (!ctx) return;

		const w = this.canvas.width;
		const h = this.canvas.height;
		ctx.clearRect(0, 0, w, h);

		const nodeByPath = new Map<string, GraphNode>();
		for (const n of this.nodes) nodeByPath.set(n.entity.path, n);

		ctx.lineWidth = 1;
		for (const edge of this.edges) {
			const from = nodeByPath.get(edge.from);
			const to = nodeByPath.get(edge.to);
			if (!from || !to) continue;

			const color = edge.label === "enemy" ? "#e55" : edge.label === "ally" ? "#5a5" : "#888";
			ctx.strokeStyle = color;
			ctx.beginPath();
			ctx.moveTo(from.x, from.y);
			ctx.lineTo(to.x, to.y);
			ctx.stroke();

			if (edge.label) {
				const mx = (from.x + to.x) / 2;
				const my = (from.y + to.y) / 2;
				ctx.fillStyle = color;
				ctx.font = "10px sans-serif";
				ctx.fillText(edge.label, mx + 2, my - 2);
			}
		}

		for (const node of this.nodes) {
			const isNPC = node.entity.kind === "npc";
			const r = isNPC ? 18 : 14;

			ctx.beginPath();
			ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
			ctx.fillStyle = isNPC ? "#4488cc" : "#cc8844";
			ctx.fill();
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 2;
			ctx.stroke();

			ctx.fillStyle = "#fff";
			ctx.font = "11px sans-serif";
			ctx.textAlign = "center";
			const label = node.entity.name.length > 12
				? node.entity.name.slice(0, 11) + "\u2026"
				: node.entity.name;
			ctx.fillText(label, node.x, node.y + r + 14);
		}
	}

	private hitTest(mx: number, my: number): GraphNode | null {
		for (const n of this.nodes) {
			const dx = mx - n.x;
			const dy = my - n.y;
			if (dx * dx + dy * dy < 400) return n;
		}
		return null;
	}

	private canvasCoords(e: MouseEvent): { x: number; y: number } {
		if (!this.canvas) return { x: 0, y: 0 };
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
			y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
		};
	}

	private onMouseDown(e: MouseEvent): void {
		const { x, y } = this.canvasCoords(e);
		const hit = this.hitTest(x, y);
		if (hit) {
			this.dragNode = hit;
			this.offsetX = x - hit.x;
			this.offsetY = y - hit.y;
		}
	}

	private onMouseMove(e: MouseEvent): void {
		if (!this.dragNode) return;
		const { x, y } = this.canvasCoords(e);
		this.dragNode.x = x - this.offsetX;
		this.dragNode.y = y - this.offsetY;
		this.draw();
	}

	private onMouseUp(): void {
		this.dragNode = null;
	}

	private onDblClick(e: MouseEvent): void {
		const { x, y } = this.canvasCoords(e);
		const hit = this.hitTest(x, y);
		if (hit) {
			const file = this.app.vault.getAbstractFileByPath(hit.entity.path);
			if (file instanceof TFile) this.app.workspace.getLeaf(false).openFile(file);
		}
	}
}

function resolveLink(val: unknown, nameToPath: Map<string, string>): string | undefined {
	if (typeof val !== "string") return undefined;
	const name = val.replace(/^\[\[(.+?)(\|.+)?\]\]$/, "$1").toLowerCase();
	return nameToPath.get(name);
}
