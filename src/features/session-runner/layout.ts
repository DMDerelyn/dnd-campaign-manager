import type { WorkspaceLeaf } from "obsidian";
import type CampaignPlugin from "../../main";
import { SESSION_RUNNER_VIEW_TYPE } from "./session-view";
import { INITIATIVE_VIEW_TYPE } from "../initiative/tracker-view";

/**
 * Open Session Runner layout: session runner (left panel), initiative tracker
 * (right panel). The user's editor stays in center. We save the existing layout
 * so we can restore on exit.
 */
export async function enterSessionLayout(plugin: CampaignPlugin): Promise<void> {
	const ws = plugin.app.workspace;

	let srLeaf: WorkspaceLeaf | null = ws.getLeavesOfType(SESSION_RUNNER_VIEW_TYPE)[0] ?? null;
	if (!srLeaf) {
		srLeaf = ws.getLeftLeaf(false);
		if (srLeaf) await srLeaf.setViewState({ type: SESSION_RUNNER_VIEW_TYPE, active: true });
	}
	if (srLeaf) void ws.revealLeaf(srLeaf);

	let initLeaf: WorkspaceLeaf | null = ws.getLeavesOfType(INITIATIVE_VIEW_TYPE)[0] ?? null;
	if (!initLeaf) {
		initLeaf = ws.getRightLeaf(false);
		if (initLeaf) await initLeaf.setViewState({ type: INITIATIVE_VIEW_TYPE, active: true });
	}
	if (initLeaf) void ws.revealLeaf(initLeaf);
}
