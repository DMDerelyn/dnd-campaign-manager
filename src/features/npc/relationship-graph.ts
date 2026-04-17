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

	private zoom = 1;
	private panX = 0;
	private panY = 0;
	private isPanning = false;
	private panStart = { x: 0, y: 0 };

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
		const npcs = this.plugin.byKindInActiveCampaign("npc");
		const factions = this.plugin.byKindInActiveCampaign("faction");
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

		const linkFields: Array<{ field: string; label: string }> = [
			{ field: "friends", label: "friend" },
			{ field: "enemies", label: "enemy" },
			{ field: "rivals", label: "rival" },
			{ field: "family", label: "family" },
			{ field: "factions", label: "member" },
			{ field: "allies", label: "ally" },
			{ field: "members", label: "member" },
		];

		for (const e of all) {
			const fm = e.frontmatter;

			for (const { field, label } of linkFields) {
				const value = fm[field];
				if (!Array.isArray(value)) continue;
				for (const v of value) {
					const targetPath = resolveLink(v, nameToPath);
					if (targetPath && pathSet.has(targetPath)) {
						this.edges.push({ from: e.path, to: targetPath, label });
					}
				}
			}

			if (typeof fm.leader === "string") {
				const targetPath = resolveLink(fm.leader, nameToPath);
				if (targetPath && pathSet.has(targetPath)) {
					this.edges.push({ from: e.path, to: targetPath, label: "leader" });
				}
			}
		}
	}

	private renderCanvas(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("campaign-npc-graph");

		const toolbar = el.createDiv({ cls: "campaign-map-toolbar" });
		const activeRoot = this.plugin.getActiveCampaignRoot();
		toolbar.createEl("span", {
			text: `Campaign: ${activeRoot}`,
			cls: "campaign-init-campaign-label",
		});
		const resetBtn = toolbar.createEl("button", { text: "Reset View", cls: "campaign-init-btn" });
		resetBtn.addEventListener("click", () => {
			this.zoom = 1;
			this.panX = 0;
			this.panY = 0;
			this.draw();
		});

		if (this.nodes.length === 0) {
			const help = el.createDiv({ cls: "campaign-graph-empty" });
			help.createEl("p", { text: "No NPCs or factions found in this campaign." });
			help.createEl("p", {
				text: "To draw relationships on the graph, open an NPC and use the Properties panel (visible at the top of the note in Live Preview):",
			});
			const list = help.createEl("ol");
			list.createEl("li", {
				text: "Click '+ Add property' on the NPC's Properties panel.",
			});
			list.createEl("li", {
				text: "Name it one of: friends, enemies, rivals, family, factions.",
			});
			list.createEl("li", {
				text: "Set the property type to 'List'.",
			});
			list.createEl("li", {
				text: "Add entries by typing the other NPC's name \u2014 Obsidian autocompletes wikilinks.",
			});
			help.createEl("p", {
				text: "Each field renders as a different edge color: friends (grey), enemies (red), family/rivals (grey), allies (green). Factions also support leader, allies, and enemies.",
			});
			return;
		}

		this.canvas = el.createEl("canvas", { cls: "campaign-graph-canvas" });
		this.canvas.width = 800;
		this.canvas.height = 600;

		this.canvas.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
		this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
		this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
		this.canvas.addEventListener("mouseup", () => this.onMouseUp());
		this.canvas.addEventListener("mouseleave", () => this.onMouseUp());
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

		ctx.save();
		ctx.translate(this.panX, this.panY);
		ctx.scale(this.zoom, this.zoom);

		const nodeByPath = new Map<string, GraphNode>();
		for (const n of this.nodes) nodeByPath.set(n.entity.path, n);

		ctx.lineWidth = 1.5;
		for (const edge of this.edges) {
			const from = nodeByPath.get(edge.from);
			const to = nodeByPath.get(edge.to);
			if (!from || !to) continue;

			const color = edge.label === "enemy" || edge.label === "rival"
				? "#e55"
				: edge.label === "friend" || edge.label === "family" || edge.label === "ally"
					? "#5a5"
					: "#999";
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
			const label = node.entity.name.length > 16
				? node.entity.name.slice(0, 15) + "\u2026"
				: node.entity.name;
			ctx.fillText(label, node.x, node.y + r + 14);
		}

		ctx.restore();
	}

	private hitTest(wx: number, wy: number): GraphNode | null {
		for (const n of this.nodes) {
			const dx = wx - n.x;
			const dy = wy - n.y;
			const hitR = n.entity.kind === "npc" ? 18 : 14;
			if (dx * dx + dy * dy < hitR * hitR) return n;
		}
		return null;
	}

	/** Convert a mouse event to canvas pixel coordinates. */
	private canvasCoords(e: MouseEvent): { x: number; y: number } {
		if (!this.canvas) return { x: 0, y: 0 };
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
			y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
		};
	}

	/** Convert canvas pixels to world coordinates (undo pan + zoom). */
	private toWorld(px: number, py: number): { x: number; y: number } {
		return {
			x: (px - this.panX) / this.zoom,
			y: (py - this.panY) / this.zoom,
		};
	}

	private onWheel(e: WheelEvent): void {
		e.preventDefault();
		const { x: cx, y: cy } = this.canvasCoords(e);
		const before = this.toWorld(cx, cy);
		const factor = e.deltaY > 0 ? 0.9 : 1.1;
		this.zoom = Math.max(0.2, Math.min(5, this.zoom * factor));
		const after = this.toWorld(cx, cy);
		this.panX += (after.x - before.x) * this.zoom;
		this.panY += (after.y - before.y) * this.zoom;
		this.draw();
	}

	private onMouseDown(e: MouseEvent): void {
		const canvasPt = this.canvasCoords(e);
		const world = this.toWorld(canvasPt.x, canvasPt.y);
		const hit = this.hitTest(world.x, world.y);
		if (hit) {
			this.dragNode = hit;
			this.offsetX = world.x - hit.x;
			this.offsetY = world.y - hit.y;
		} else {
			this.isPanning = true;
			this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
		}
	}

	private onMouseMove(e: MouseEvent): void {
		if (this.dragNode) {
			const canvasPt = this.canvasCoords(e);
			const world = this.toWorld(canvasPt.x, canvasPt.y);
			this.dragNode.x = world.x - this.offsetX;
			this.dragNode.y = world.y - this.offsetY;
			this.draw();
		} else if (this.isPanning) {
			this.panX = e.clientX - this.panStart.x;
			this.panY = e.clientY - this.panStart.y;
			this.draw();
		}
	}

	private onMouseUp(): void {
		this.dragNode = null;
		this.isPanning = false;
	}

	private onDblClick(e: MouseEvent): void {
		const canvasPt = this.canvasCoords(e);
		const world = this.toWorld(canvasPt.x, canvasPt.y);
		const hit = this.hitTest(world.x, world.y);
		if (hit) {
			const file = this.app.vault.getAbstractFileByPath(hit.entity.path);
			if (file instanceof TFile) this.app.workspace.getLeaf(false).openFile(file);
		}
	}
}

function resolveLink(val: unknown, nameToPath: Map<string, string>): string | undefined {
	if (typeof val !== "string") return undefined;
	const bracketed = val.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
	const name = (bracketed ? bracketed[1] : val).trim().toLowerCase();
	if (!name) return undefined;
	return nameToPath.get(name);
}
