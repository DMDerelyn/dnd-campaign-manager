import { describe, it, expect } from "vitest";
import type { App } from "obsidian";
import { TemplaterBridge } from "../src/integrations/templater-api";
import {
	gatherTemplateFolders,
	isTemplatePath,
	pathIsInAnyFolder,
} from "../src/core/template-path";

function makeApp(opts: {
	templater?: {
		templates_folder?: string;
		folder_templates?: Array<{ folder?: string; template?: string }>;
	};
	coreFolder?: string;
}): App {
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
				plugins: {
					templates: { instance: { options: { folder: opts.coreFolder } } },
				},
			}
			: undefined,
	} as unknown as App;
}

function check(path: string, opts: Parameters<typeof makeApp>[0]): boolean {
	const app = makeApp(opts);
	return isTemplatePath(path, app, new TemplaterBridge(app));
}

describe("pathIsInAnyFolder", () => {
	it("matches an exact folder prefix", () => {
		expect(pathIsInAnyFolder("Templates/npc.md", ["Templates"])).toBe(true);
	});

	it("ignores case differences on both sides", () => {
		expect(pathIsInAnyFolder("MY templates/FOO.md", ["my TEMPLATES"])).toBe(true);
	});

	it("strips leading and trailing slashes from both sides", () => {
		expect(pathIsInAnyFolder("/Templates/npc.md", ["/Templates/"])).toBe(true);
	});

	it("does not match partial folder-name prefixes", () => {
		expect(pathIsInAnyFolder("TemplatesOther/foo.md", ["Templates"])).toBe(false);
	});

	it("matches when the path is the folder itself", () => {
		expect(pathIsInAnyFolder("Templates", ["Templates"])).toBe(true);
	});

	it("skips blank folder entries", () => {
		expect(pathIsInAnyFolder("NPCs/foo.md", ["", "   "])).toBe(false);
	});
});

describe("gatherTemplateFolders", () => {
	it("always seeds Templates/ and templates/", () => {
		const app = makeApp({});
		const folders = gatherTemplateFolders(app, new TemplaterBridge(app));
		expect(folders).toContain("Templates");
		expect(folders).toContain("templates");
	});

	it("includes Templater's templates_folder", () => {
		const app = makeApp({ templater: { templates_folder: "Meta/Templates" } });
		const folders = gatherTemplateFolders(app, new TemplaterBridge(app));
		expect(folders).toContain("Meta/Templates");
	});

	it("includes the parent folder of each folder_templates rule", () => {
		const app = makeApp({
			templater: {
				folder_templates: [{ folder: "NPCs", template: "Extra/Tpl/npc.md" }],
			},
		});
		const folders = gatherTemplateFolders(app, new TemplaterBridge(app));
		expect(folders).toContain("Extra/Tpl");
	});

	it("includes the core Templates plugin folder", () => {
		const app = makeApp({ coreFolder: "Vault Templates" });
		const folders = gatherTemplateFolders(app, new TemplaterBridge(app));
		expect(folders).toContain("Vault Templates");
	});
});

describe("isTemplatePath", () => {
	it("excludes the built-in Templates/ folder", () => {
		expect(check("Templates/Campaign/npc.md", {})).toBe(true);
	});

	it("excludes a lowercase templates/ folder", () => {
		expect(check("templates/npc.md", {})).toBe(true);
	});

	it("excludes Templater's configured templates_folder", () => {
		expect(check("Meta/Templates/quest.md", {
			templater: { templates_folder: "Meta/Templates" },
		})).toBe(true);
	});

	it("excludes regardless of case differences in the configured folder", () => {
		expect(check("my templates/foo.md", {
			templater: { templates_folder: "MY TEMPLATES" },
		})).toBe(true);
	});

	it("tolerates leading and trailing slashes in the setting", () => {
		expect(check("Templates/npc.md", {
			templater: { templates_folder: "/Templates/" },
		})).toBe(true);
	});

	it("excludes folders referenced by Templater folder_templates rules", () => {
		expect(check("Extra/Tpl/npc.md", {
			templater: {
				templates_folder: "Main/Templates",
				folder_templates: [
					{ folder: "Campaigns/My Campaign/NPCs", template: "Extra/Tpl/npc.md" },
				],
			},
		})).toBe(true);
	});

	it("excludes files in the core Templates plugin folder", () => {
		expect(check("Vault Templates/session.md", { coreFolder: "Vault Templates" })).toBe(true);
	});

	it("does not exclude ordinary entity files", () => {
		expect(check("Campaigns/My Campaign/NPCs/Gandalf.md", {
			templater: { templates_folder: "Templates" },
		})).toBe(false);
	});
});
