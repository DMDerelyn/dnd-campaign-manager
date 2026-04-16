import { ItemView, WorkspaceLeaf, TFile, Notice } from "obsidian";
import type CampaignPlugin from "../../main";
import type { IndexedEntity } from "../../core/entity-index";

export const MAP_VIEW_TYPE = "campaign-map";

interface Pin {
	x: number;
	y: number;
	target: string;
	label: string;
}

interface FogPolygon {
	points: [number, number][];
}

export class MapView extends ItemView {
	private canvas: HTMLCanvasElement | null = null;
	private img: HTMLImageElement | null = null;
	private location: IndexedEntity | null = null;
	private detach: (() => void) | null = null;

	private panX = 0;
	private panY = 0;
	private zoom = 1;
	private isPanning = false;
	private lastMouse = { x: 0, y: 0 };

	private fogMode = false;
	private fogBrushRadius = 40;
	private revealedPolygons: FogPolygon[] = [];
	private pins: Pin[] = [];

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CampaignPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return MAP_VIEW_TYPE;
	}
	getDisplayText(): string {
		return this.location ? `Map: ${this.location.name}` : "Campaign Map";
	}
	getIcon(): string {
		return "map";
	}

	async onOpen(): Promise<void> {
		this.renderUI();
		this.detach = this.plugin.entityIndex.onChange(() => this.refreshLocation());
	}

	async onClose(): Promise<void> {
		this.detach?.();
		this.detach = null;
	}

	setLocation(entity: IndexedEntity): void {
		this.location = entity;
		this.loadMapData();
		this.loadImage();
	}

	private renderUI(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("campaign-map-view");

		const toolbar = el.createDiv({ cls: "campaign-map-toolbar" });

		const pickBtn = toolbar.createEl("button", { text: "Pick Location", cls: "campaign-init-btn" });
		pickBtn.addEventListener("click", async () => {
			const picked = await this.plugin.promptEntityPicker();
			if (picked && picked.kind === "location") this.setLocation(picked);
		});

		const fogToggle = toolbar.createEl("button", {
			text: "Fog: OFF",
			cls: "campaign-init-btn",
		});
		fogToggle.addEventListener("click", () => {
			this.fogMode = !this.fogMode;
			fogToggle.textContent = this.fogMode ? "Fog: REVEAL" : "Fog: OFF";
		});

		const saveBtn = toolbar.createEl("button", { text: "Save Fog/Pins", cls: "campaign-init-btn" });
		saveBtn.addEventListener("click", () => this.saveFogAndPins());

		const resetZoom = toolbar.createEl("button", { text: "Reset View", cls: "campaign-init-btn" });
		resetZoom.addEventListener("click", () => {
			this.panX = 0;
			this.panY = 0;
			this.zoom = 1;
			this.draw();
		});

		this.canvas = el.createEl("canvas", { cls: "campaign-map-canvas" });
		this.canvas.width = 800;
		this.canvas.height = 600;

		this.canvas.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
		this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
		this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
		this.canvas.addEventListener("mouseup", () => this.onMouseUp());
		this.canvas.addEventListener("dblclick", (e) => this.onDblClick(e));

		if (!this.location) {
			el.createEl("p", {
				text: "Pick a location with a map_image field to display its map.",
				cls: "campaign-init-empty",
			});
		}
	}

	private loadMapData(): void {
		if (!this.location) return;
		const fm = this.location.frontmatter;

		this.revealedPolygons = [];
		if (Array.isArray(fm.fog_revealed)) {
			for (const poly of fm.fog_revealed as FogPolygon[]) {
				if (Array.isArray(poly.points)) {
					this.revealedPolygons.push(poly);
				}
			}
		}

		this.pins = [];
		if (Array.isArray(fm.pins)) {
			for (const p of fm.pins as Pin[]) {
				if (typeof p.x === "number" && typeof p.y === "number") {
					this.pins.push(p);
				}
			}
		}
	}

	private loadImage(): void {
		if (!this.location) return;
		const fm = this.location.frontmatter;
		const mapImage = fm.map_image;
		if (typeof mapImage !== "string" || !mapImage) return;

		const file = this.app.vault.getAbstractFileByPath(mapImage);
		if (!(file instanceof TFile)) return;

		const uri = this.app.vault.getResourcePath(file);
		const img = new Image();
		img.onload = () => {
			this.img = img;
			if (this.canvas) {
				this.canvas.width = Math.min(1200, img.naturalWidth);
				this.canvas.height = Math.min(900, img.naturalHeight);
			}
			this.draw();
		};
		img.src = uri;
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

		if (this.img) {
			ctx.drawImage(this.img, 0, 0);
		}

		this.drawFog(ctx);
		this.drawPins(ctx);

		ctx.restore();
	}

	private drawFog(ctx: CanvasRenderingContext2D): void {
		if (!this.img) return;
		const iw = this.img.naturalWidth;
		const ih = this.img.naturalHeight;

		ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
		ctx.fillRect(0, 0, iw, ih);

		ctx.globalCompositeOperation = "destination-out";
		for (const poly of this.revealedPolygons) {
			if (poly.points.length < 3) continue;
			ctx.beginPath();
			ctx.moveTo(poly.points[0][0], poly.points[0][1]);
			for (let i = 1; i < poly.points.length; i++) {
				ctx.lineTo(poly.points[i][0], poly.points[i][1]);
			}
			ctx.closePath();
			ctx.fill();
		}
		ctx.globalCompositeOperation = "source-over";
	}

	private drawPins(ctx: CanvasRenderingContext2D): void {
		for (const pin of this.pins) {
			ctx.beginPath();
			ctx.arc(pin.x, pin.y, 8, 0, 2 * Math.PI);
			ctx.fillStyle = "#e44";
			ctx.fill();
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 2;
			ctx.stroke();

			if (pin.label) {
				ctx.fillStyle = "#fff";
				ctx.font = "12px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText(pin.label, pin.x, pin.y - 12);
			}
		}
	}

	private toMapCoords(e: MouseEvent): { x: number; y: number } {
		if (!this.canvas) return { x: 0, y: 0 };
		const rect = this.canvas.getBoundingClientRect();
		const sx = this.canvas.width / rect.width;
		const sy = this.canvas.height / rect.height;
		return {
			x: ((e.clientX - rect.left) * sx - this.panX) / this.zoom,
			y: ((e.clientY - rect.top) * sy - this.panY) / this.zoom,
		};
	}

	private onWheel(e: WheelEvent): void {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		this.zoom = Math.max(0.1, Math.min(10, this.zoom * delta));
		this.draw();
	}

	private onMouseDown(e: MouseEvent): void {
		if (this.fogMode && e.button === 0) {
			this.revealAt(e);
			return;
		}
		if (e.button === 0) {
			this.isPanning = true;
			this.lastMouse = { x: e.clientX, y: e.clientY };
		}
	}

	private onMouseMove(e: MouseEvent): void {
		if (this.fogMode && e.buttons === 1) {
			this.revealAt(e);
			return;
		}
		if (this.isPanning) {
			const dx = e.clientX - this.lastMouse.x;
			const dy = e.clientY - this.lastMouse.y;
			this.panX += dx;
			this.panY += dy;
			this.lastMouse = { x: e.clientX, y: e.clientY };
			this.draw();
		}
	}

	private onMouseUp(): void {
		this.isPanning = false;
	}

	private onDblClick(e: MouseEvent): void {
		if (this.fogMode) return;
		const { x, y } = this.toMapCoords(e);
		const existingPin = this.pins.find(
			(p) => Math.hypot(p.x - x, p.y - y) < 15,
		);
		if (existingPin?.target) {
			const file = this.app.metadataCache.getFirstLinkpathDest(
				existingPin.target.replace(/^\[\[(.+?)(\|.+)?\]\]$/, "$1"),
				"",
			);
			if (file) this.app.workspace.getLeaf(false).openFile(file);
			return;
		}
		const rawLabel = prompt("Pin label (leave blank to cancel):");
		if (rawLabel === null) return;
		const label = rawLabel.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 100);
		this.pins.push({ x: Math.round(x), y: Math.round(y), target: "", label });
		this.draw();
	}

	private revealAt(e: MouseEvent): void {
		const { x, y } = this.toMapCoords(e);
		const r = this.fogBrushRadius / this.zoom;
		const steps = 12;
		const pts: [number, number][] = [];
		for (let i = 0; i < steps; i++) {
			const a = (2 * Math.PI * i) / steps;
			pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
		}
		this.revealedPolygons.push({ points: pts });
		this.draw();
	}

	private async saveFogAndPins(): Promise<void> {
		if (!this.location) return;
		const file = this.app.vault.getAbstractFileByPath(this.location.path);
		if (!(file instanceof TFile)) return;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm.fog_revealed = this.revealedPolygons;
			fm.pins = this.pins;
		});
		new Notice("Fog and pins saved to frontmatter.");
	}

	private refreshLocation(): void {
		if (this.location) {
			this.location = this.plugin.entityIndex.getByPath(this.location.path) ?? null;
		}
	}
}
