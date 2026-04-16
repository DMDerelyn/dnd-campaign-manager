import type { App } from "obsidian";

/**
 * Presence check for Dataview. We don't wrap its query API here — Dataview
 * queries are used directly in markdown code blocks. The settings tab uses
 * this to warn if Dataview isn't enabled.
 */
export class DataviewBridge {
	constructor(private app: App) {}

	isAvailable(): boolean {
		const plug = (this.app as unknown as AppWithPlugins).plugins?.plugins?.["dataview"];
		return Boolean(plug);
	}
}

interface AppWithPlugins {
	plugins?: { plugins?: Record<string, unknown> };
}
