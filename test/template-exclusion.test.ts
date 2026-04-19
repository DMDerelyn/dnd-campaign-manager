import { describe, it, expect } from "vitest";
import { TemplaterBridge } from "../src/integrations/templater-api";

interface FakeApp {
	plugins?: {
		plugins?: Record<string, unknown>;
	};
	internalPlugins?: {
		plugins?: Record<string, { instance?: { options?: { folder?: string } } }>;
	};
}

function makeApp(opts: {
	templater?: { templates_folder?: string; folder_templates?: Array<{ folder?: string; template?: string }> };
	coreFolder?: string;
}): FakeApp {
	return {
		plugins: opts.templater
			? {
				plugins: {
					"templater-obsidian": { settings: opts.templater },
				},
			}
			: undefined,
		internalPlugins: opts.coreFolder !== undefined
			? {
				plugins: { templates: { instance: { options: { folder: opts.coreFolder } } } },
			}
			: undefined,
	};
}

// Mirror of main.ts#isTemplatePath so the logic can be tested without
// instantiating the full plugin (which requires Obsidian at runtime).
function isTemplatePath(path: string, app: FakeApp): boolean {
	const bridge = new TemplaterBridge(app as never);
	const folders = new Set<string>();
	folders.add("Templates");
	folders.add("templates");
	for (const f of bridge.getAllTemplateFolders()) folders.add(f);
	const core = app.internalPlugins?.plugins?.templates?.instance?.options?.folder;
	if (typeof core === "string" && core.trim()) folders.add(core.trim());
	const normalizedPath = path.replace(/^\/+|\/+$/g, "").toLowerCase();
	for (const folder of folders) {
		const norm = folder.replace(/^\/+|\/+$/g, "").toLowerCase();
		if (!norm) continue;
		if (normalizedPath === norm || normalizedPath.startsWith(`${norm}/`)) return true;
	}
	return false;
}

describe("isTemplatePath", () => {
	it("excludes the built-in Templates/ folder", () => {
		const app = makeApp({});
		expect(isTemplatePath("Templates/Campaign/npc.md", app)).toBe(true);
	});

	it("excludes a lowercase templates/ folder", () => {
		const app = makeApp({});
		expect(isTemplatePath("templates/npc.md", app)).toBe(true);
	});

	it("excludes Templater's configured templates_folder", () => {
		const app = makeApp({ templater: { templates_folder: "Meta/Templates" } });
		expect(isTemplatePath("Meta/Templates/quest.md", app)).toBe(true);
	});

	it("excludes regardless of case differences in the configured folder", () => {
		const app = makeApp({ templater: { templates_folder: "MY TEMPLATES" } });
		expect(isTemplatePath("my templates/foo.md", app)).toBe(true);
	});

	it("tolerates leading and trailing slashes in the setting", () => {
		const app = makeApp({ templater: { templates_folder: "/Templates/" } });
		expect(isTemplatePath("Templates/npc.md", app)).toBe(true);
	});

	it("excludes folders referenced by Templater folder_templates rules", () => {
		const app = makeApp({
			templater: {
				templates_folder: "Main/Templates",
				folder_templates: [
					{ folder: "Campaigns/My Campaign/NPCs", template: "Extra/Tpl/npc.md" },
				],
			},
		});
		expect(isTemplatePath("Extra/Tpl/npc.md", app)).toBe(true);
	});

	it("excludes files in the core Templates plugin folder", () => {
		const app = makeApp({ coreFolder: "Vault Templates" });
		expect(isTemplatePath("Vault Templates/session.md", app)).toBe(true);
	});

	it("does not exclude ordinary entity files", () => {
		const app = makeApp({ templater: { templates_folder: "Templates" } });
		expect(isTemplatePath("Campaigns/My Campaign/NPCs/Gandalf.md", app)).toBe(false);
	});
});
