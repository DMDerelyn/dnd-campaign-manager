import { ItemView, WorkspaceLeaf, TFile, Notice } from "obsidian";
import type CampaignPlugin from "../../main";
import type { IndexedEntity } from "../../core/entity-index";
import { MapPickerModal } from "../../ui/modals/map-picker";
import { onClick } from "../../core/format";

export const MAP_VIEW_TYPE = "campaign-map";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);
const MAX_FOG_DIMENSION = 1536;

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

	private fogMode: "off" | "reveal" | "erase" = "off";
	private fogBrushRadius = 40;
	private revealedPolygons: FogPolygon[] = [];
	private pins: Pin[] = [];
	private playerMode = false;
	private fogToggleBtn: HTMLButtonElement | null = null;
	private emptyStateEl: HTMLElement | null = null;
	private drawScheduled = false;
	private fogCanvas: HTMLCanvasElement | null = null;
	private activeTouches = new Map<number, { x: number; y: number }>();
	private pinchStart: { dist: number; zoom: number; panX: number; panY: number; mapX: number; mapY: number } | null = null;

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
		return this.location ? `Map: ${this.location.name}` : "Campaign map";
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
		this.img = null;
		this.fogCanvas = null;
	}

	setLocation(entity: IndexedEntity): void {
		this.location = entity;
		this.panX = 0;
		this.panY = 0;
		this.zoom = 1;
		if (this.emptyStateEl) {
			this.emptyStateEl.remove();
			this.emptyStateEl = null;
		}
		this.loadMapData();
		this.loadImage();
	}

	private renderUI(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("campaign-map-view");

		const toolbar = el.createDiv({ cls: "campaign-map-toolbar" });

		const pickBtn = toolbar.createEl("button", { text: "Pick Map", cls: "campaign-init-btn" });
		onClick(pickBtn, async () => {
			const picked = await new MapPickerModal(this.app, this.plugin).pick();
			if (!picked) return;
			if (picked.kind === "location") {
				this.setLocation(picked.entity);
			} else {
				await this.attachImageToNewLocation(picked.path);
			}
		});

		const fogToggle = toolbar.createEl("button", {
			text: "Fog: OFF",
			cls: "campaign-init-btn",
		});
		this.fogToggleBtn = fogToggle;
		fogToggle.addEventListener("click", () => {
			this.fogMode =
				this.fogMode === "off" ? "reveal" : this.fogMode === "reveal" ? "erase" : "off";
			this.updateFogButton();
		});

		const saveBtn = toolbar.createEl("button", { text: "Save Fog/Pins", cls: "campaign-init-btn" });
		saveBtn.addEventListener("click", () => void this.saveFogAndPins());

		const resetZoom = toolbar.createEl("button", { text: "Reset View", cls: "campaign-init-btn" });
		resetZoom.addEventListener("click", () => {
			this.panX = 0;
			this.panY = 0;
			this.zoom = 1;
			this.draw();
		});

		const playerBtn = toolbar.createEl("button", { text: "Player Mode", cls: "campaign-init-btn" });
		playerBtn.addEventListener("click", () => this.setPlayerMode(true));

		this.canvas = el.createEl("canvas", { cls: "campaign-map-canvas" });
		this.canvas.width = 800;
		this.canvas.height = 600;

		this.registerDomEvent(this.canvas, "wheel", (e) => this.onWheel(e), { passive: false });
		this.registerDomEvent(this.canvas, "mousedown", (e) => this.onMouseDown(e));
		this.registerDomEvent(this.canvas, "mousemove", (e) => this.onMouseMove(e));
		this.registerDomEvent(this.canvas, "mouseup", () => this.onMouseUp());
		this.registerDomEvent(this.canvas, "dblclick", (e) => this.onDblClick(e));
		this.registerDomEvent(this.canvas, "touchstart", (e) => this.onTouchStart(e), { passive: false });
		this.registerDomEvent(this.canvas, "touchmove", (e) => this.onTouchMove(e), { passive: false });
		this.registerDomEvent(this.canvas, "touchend", (e) => this.onTouchEnd(e));
		this.registerDomEvent(this.canvas, "touchcancel", (e) => this.onTouchEnd(e));

		const exitBtn = el.createEl("button", {
			text: "Exit Player Mode",
			cls: "campaign-map-exit-player",
		});
		exitBtn.addEventListener("click", () => this.setPlayerMode(false));

		if (!this.location) {
			this.emptyStateEl = el.createEl("p", {
				text: "Pick a map from the Maps folder or an existing location.",
				cls: "campaign-init-empty",
			});
		}

		this.registerDomEvent(this.contentEl, "keydown", (ev) => {
			if (this.playerMode && ev.key === "Escape") this.setPlayerMode(false);
		});
	}

	private async attachImageToNewLocation(imagePath: string): Promise<void> {
		const root = this.plugin.getActiveCampaignRoot();
		if (!root || !imagePath.startsWith(`${root}/`)) {
			new Notice("Map image must live inside the active campaign.");
			return;
		}
		const basename = imagePath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "New Map";
		const raw = await this.plugin.promptText("Location name for this map", {
			suggestLabel: "Use filename",
			suggest: () => basename,
		});
		if (raw === null) return;
		const name = raw.trim() || basename;

		const file = await this.plugin.createEntity("location", name);
		await this.app.fileManager.processFrontMatter(
			file,
			(fm: Record<string, unknown>) => {
				fm.map_image = imagePath;
			},
		);

		const entity = await this.waitForIndexed(file.path);
		if (!entity) {
			new Notice(`Created "${name}" but index hasn't picked it up yet. Pick it from the list to load.`);
			return;
		}
		this.setLocation(entity);
		new Notice(`Created location "${name}" for this map.`);
	}

	private waitForIndexed(path: string, timeoutMs = 3000): Promise<IndexedEntity | null> {
		return new Promise((resolve) => {
			const existing = this.plugin.entityIndex.getByPath(path);
			if (existing) {
				resolve(existing);
				return;
			}
			let settled = false;
			const finish = (value: IndexedEntity | null) => {
				if (settled) return;
				settled = true;
				unsubscribe();
				window.clearTimeout(timer);
				resolve(value);
			};
			const unsubscribe = this.plugin.entityIndex.onChange(() => {
				const hit = this.plugin.entityIndex.getByPath(path);
				if (hit) finish(hit);
			});
			const timer = window.setTimeout(() => finish(null), timeoutMs);
		});
	}

	private loadMapData(): void {
		if (!this.location) return;
		const fm = this.location.frontmatter;

		this.invalidateFog();
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
		if (!IMAGE_EXTS.has(file.extension.toLowerCase())) {
			new Notice(`map_image is not an image file: ${mapImage}`);
			return;
		}

		const uri = this.app.vault.getResourcePath(file);
		const img = new Image();
		img.onload = () => {
			this.img = img;
			this.invalidateFog();
			if (this.canvas) {
				this.canvas.width = Math.min(1200, img.naturalWidth);
				this.canvas.height = Math.min(900, img.naturalHeight);
			}
			this.draw();
		};
		img.src = uri;
	}

	private draw(): void {
		if (this.drawScheduled) return;
		this.drawScheduled = true;
		window.requestAnimationFrame(() => {
			this.drawScheduled = false;
			this.drawNow();
		});
	}

	private drawNow(): void {
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
		const fog = this.getFogCanvas();
		if (!fog || !this.img) return;
		ctx.drawImage(fog, 0, 0, this.img.naturalWidth, this.img.naturalHeight);
	}

	private invalidateFog(): void {
		this.fogCanvas = null;
	}

	private getFogCanvas(): HTMLCanvasElement | null {
		if (this.fogCanvas) return this.fogCanvas;
		if (!this.img) return null;
		const iw = this.img.naturalWidth;
		const ih = this.img.naturalHeight;
		const fogScale = Math.min(1, MAX_FOG_DIMENSION / Math.max(iw, ih));
		const fw = Math.max(1, Math.round(iw * fogScale));
		const fh = Math.max(1, Math.round(ih * fogScale));
		const layer = createEl("canvas");
		layer.width = fw;
		layer.height = fh;
		const lctx = layer.getContext("2d");
		if (!lctx) return null;

		lctx.fillStyle = "rgba(0, 0, 0, 0.85)";
		lctx.fillRect(0, 0, fw, fh);

		lctx.globalCompositeOperation = "destination-out";
		for (const poly of this.revealedPolygons) {
			if (poly.points.length < 3) continue;
			lctx.beginPath();
			lctx.moveTo(poly.points[0][0] * fogScale, poly.points[0][1] * fogScale);
			for (let i = 1; i < poly.points.length; i++) {
				lctx.lineTo(poly.points[i][0] * fogScale, poly.points[i][1] * fogScale);
			}
			lctx.closePath();
			lctx.fill();
		}
		this.fogCanvas = layer;
		return layer;
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

			if (pin.label && !this.playerMode) {
				ctx.fillStyle = "#fff";
				ctx.font = "12px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText(pin.label, pin.x, pin.y - 12);
			}
		}
	}

	private toMapCoords(p: { clientX: number; clientY: number }): { x: number; y: number } {
		const canvas = this.clientToCanvas(p);
		return {
			x: (canvas.x - this.panX) / this.zoom,
			y: (canvas.y - this.panY) / this.zoom,
		};
	}

	private clientToCanvas(p: { clientX: number; clientY: number }): { x: number; y: number } {
		if (!this.canvas) return { x: 0, y: 0 };
		const rect = this.canvas.getBoundingClientRect();
		const sx = this.canvas.width / rect.width;
		const sy = this.canvas.height / rect.height;
		return { x: (p.clientX - rect.left) * sx, y: (p.clientY - rect.top) * sy };
	}

	private onWheel(e: WheelEvent): void {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		this.zoomAroundClient(e.clientX, e.clientY, this.zoom * delta);
	}

	private zoomAroundClient(clientX: number, clientY: number, target: number): void {
		const cursor = this.clientToCanvas({ clientX, clientY });
		const mapX = (cursor.x - this.panX) / this.zoom;
		const mapY = (cursor.y - this.panY) / this.zoom;
		const newZoom = Math.max(0.1, Math.min(10, target));
		if (newZoom === this.zoom) return;
		this.panX = cursor.x - mapX * newZoom;
		this.panY = cursor.y - mapY * newZoom;
		this.zoom = newZoom;
		this.draw();
	}

	private onTouchStart(e: TouchEvent): void {
		e.preventDefault();
		for (let i = 0; i < e.changedTouches.length; i++) {
			const t = e.changedTouches[i];
			this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
		}
		if (this.activeTouches.size >= 2) {
			this.beginPinch();
			this.isPanning = false;
			return;
		}
		if (this.activeTouches.size === 1) {
			const t = this.firstTouch();
			if (!this.playerMode) {
				if (this.fogMode === "reveal") { this.revealAt(t); return; }
				if (this.fogMode === "erase") { this.eraseAt(t); return; }
			}
			this.isPanning = true;
			this.lastMouse = { x: t.clientX, y: t.clientY };
		}
	}

	private onTouchMove(e: TouchEvent): void {
		e.preventDefault();
		for (let i = 0; i < e.changedTouches.length; i++) {
			const t = e.changedTouches[i];
			if (this.activeTouches.has(t.identifier)) {
				this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
			}
		}
		if (this.activeTouches.size >= 2 && this.pinchStart) {
			const pts = [...this.activeTouches.values()].slice(0, 2);
			const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
			if (distance <= 0) return;
			const scale = distance / this.pinchStart.dist;
			const newZoom = Math.max(0.1, Math.min(10, this.pinchStart.zoom * scale));
			const midClientX = (pts[0].x + pts[1].x) / 2;
			const midClientY = (pts[0].y + pts[1].y) / 2;
			const midCanvas = this.clientToCanvas({ clientX: midClientX, clientY: midClientY });
			this.panX = midCanvas.x - this.pinchStart.mapX * newZoom;
			this.panY = midCanvas.y - this.pinchStart.mapY * newZoom;
			this.zoom = newZoom;
			this.draw();
			return;
		}
		if (this.activeTouches.size === 1) {
			const t = this.firstTouch();
			if (!this.playerMode) {
				if (this.fogMode === "reveal") { this.revealAt(t); return; }
				if (this.fogMode === "erase") { this.eraseAt(t); return; }
			}
			if (this.isPanning) {
				const dx = t.clientX - this.lastMouse.x;
				const dy = t.clientY - this.lastMouse.y;
				this.panX += dx;
				this.panY += dy;
				this.lastMouse = { x: t.clientX, y: t.clientY };
				this.draw();
			}
		}
	}

	private onTouchEnd(e: TouchEvent): void {
		for (let i = 0; i < e.changedTouches.length; i++) {
			this.activeTouches.delete(e.changedTouches[i].identifier);
		}
		if (this.activeTouches.size < 2) this.pinchStart = null;
		if (this.activeTouches.size === 0) {
			this.isPanning = false;
		} else if (this.activeTouches.size === 1) {
			const t = this.firstTouch();
			this.lastMouse = { x: t.clientX, y: t.clientY };
			this.isPanning = true;
		}
	}

	private beginPinch(): void {
		const pts = [...this.activeTouches.values()].slice(0, 2);
		if (pts.length < 2) return;
		const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
		if (dist <= 0) return;
		const midClientX = (pts[0].x + pts[1].x) / 2;
		const midClientY = (pts[0].y + pts[1].y) / 2;
		const midCanvas = this.clientToCanvas({ clientX: midClientX, clientY: midClientY });
		this.pinchStart = {
			dist,
			zoom: this.zoom,
			panX: this.panX,
			panY: this.panY,
			mapX: (midCanvas.x - this.panX) / this.zoom,
			mapY: (midCanvas.y - this.panY) / this.zoom,
		};
	}

	private firstTouch(): { clientX: number; clientY: number } {
		const [t] = this.activeTouches.values();
		return { clientX: t.x, clientY: t.y };
	}

	private onMouseDown(e: MouseEvent): void {
		if (e.button !== 0) return;
		if (!this.playerMode) {
			if (this.fogMode === "reveal") { this.revealAt(e); return; }
			if (this.fogMode === "erase") { this.eraseAt(e); return; }
		}
		this.isPanning = true;
		this.lastMouse = { x: e.clientX, y: e.clientY };
	}

	private onMouseMove(e: MouseEvent): void {
		if (!this.playerMode && e.buttons === 1) {
			if (this.fogMode === "reveal") { this.revealAt(e); return; }
			if (this.fogMode === "erase") { this.eraseAt(e); return; }
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

	private async onDblClick(e: MouseEvent): Promise<void> {
		if (this.fogMode !== "off") return;
		const { x, y } = this.toMapCoords(e);
		const existingPin = this.pins.find(
			(p) => Math.hypot(p.x - x, p.y - y) < 15,
		);
		if (existingPin?.target) {
			this.followPin(existingPin);
			return;
		}
		if (this.playerMode) return;
		const rawLabel = await this.plugin.promptText("Pin label");
		if (rawLabel === null) return;
		// eslint-disable-next-line no-control-regex -- strips ASCII control chars from a user-entered pin label
		const label = rawLabel.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 100);
		const picked = await this.plugin.promptEntityPicker();
		const target = picked ? `[[${picked.name}]]` : "";
		this.pins.push({ x: Math.round(x), y: Math.round(y), target, label });
		this.draw();
	}

	private followPin(pin: Pin): void {
		const stripped = pin.target.replace(/^\[\[(.+?)(\|.+)?\]\]$/, "$1").trim();
		if (!stripped) return;
		const file = this.app.metadataCache.getFirstLinkpathDest(stripped, "");
		if (!file) return;
		const entity = this.plugin.entityIndex.getByPath(file.path);
		if (
			entity &&
			entity.kind === "location" &&
			typeof entity.frontmatter.map_image === "string" &&
			entity.frontmatter.map_image
		) {
			this.setLocation(entity);
			return;
		}
		void this.app.workspace.getLeaf(false).openFile(file);
	}

	private revealAt(p: { clientX: number; clientY: number }): void {
		const { x, y } = this.toMapCoords(p);
		const r = this.fogBrushRadius / this.zoom;
		const steps = 12;
		const pts: [number, number][] = [];
		for (let i = 0; i < steps; i++) {
			const a = (2 * Math.PI * i) / steps;
			pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
		}
		this.revealedPolygons.push({ points: pts });
		this.invalidateFog();
		this.draw();
	}

	private eraseAt(p: { clientX: number; clientY: number }): void {
		const { x, y } = this.toMapCoords(p);
		const r = this.fogBrushRadius / this.zoom;
		const rSq = r * r;
		const before = this.revealedPolygons.length;
		this.revealedPolygons = this.revealedPolygons.filter((poly) => {
			if (pointInPolygon(x, y, poly.points)) return false;
			for (const [px, py] of poly.points) {
				const dx = px - x;
				const dy = py - y;
				if (dx * dx + dy * dy <= rSq) return false;
			}
			return true;
		});
		if (this.revealedPolygons.length !== before) {
			this.invalidateFog();
			this.draw();
		}
	}

	private updateFogButton(): void {
		if (!this.fogToggleBtn) return;
		const labels = { off: "Fog: OFF", reveal: "Fog: REVEAL", erase: "Fog: ERASE" };
		this.fogToggleBtn.textContent = labels[this.fogMode];
	}

	private setPlayerMode(enable: boolean): void {
		this.playerMode = enable;
		if (enable) {
			this.fogMode = "off";
			this.updateFogButton();
			this.contentEl.addClass("campaign-map-player-mode");
			this.contentEl.tabIndex = 0;
			this.contentEl.focus();
			new Notice("Player mode on. Press Escape to exit.");
		} else {
			this.contentEl.removeClass("campaign-map-player-mode");
		}
		this.draw();
	}

	private async saveFogAndPins(): Promise<void> {
		if (!this.location) return;
		const file = this.app.vault.getAbstractFileByPath(this.location.path);
		if (!(file instanceof TFile)) return;

		await this.app.fileManager.processFrontMatter(
			file,
			(fm: Record<string, unknown>) => {
				fm.fog_revealed = this.revealedPolygons;
				fm.pins = this.pins;
			},
		);
		new Notice("Fog and pins saved to frontmatter.");
	}

	private refreshLocation(): void {
		if (!this.location) return;
		const prevMapImage = this.location.frontmatter.map_image;
		const next = this.plugin.entityIndex.getByPath(this.location.path) ?? null;
		this.location = next;
		if (!next) return;
		this.loadMapData();
		if (next.frontmatter.map_image !== prevMapImage) {
			this.loadImage();
		} else {
			this.draw();
		}
	}
}

function pointInPolygon(x: number, y: number, points: [number, number][]): boolean {
	let inside = false;
	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const [xi, yi] = points[i];
		const [xj, yj] = points[j];
		const intersect =
			yi > y !== yj > y &&
			x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}
