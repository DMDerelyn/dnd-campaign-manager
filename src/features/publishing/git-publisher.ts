import type { App } from "obsidian";

export interface GitPublishConfig {
	repoPath: string;
	remoteName: string;
	branch: string;
	commitMessage: string;
}

export async function gitPublish(
	app: App,
	config: GitPublishConfig,
): Promise<string> {
	let execFile: typeof import("child_process").execFile;
	try {
		execFile = require("child_process").execFile;
	} catch {
		throw new Error("Git publish requires Obsidian desktop. Not available on mobile.");
	}

	const basePath = (app.vault.adapter as { basePath?: string }).basePath;
	if (!basePath) throw new Error("Could not determine vault base path.");

	const cwd = `${basePath}/${config.repoPath}`;
	const msg = config.commitMessage || `Campaign publish ${new Date().toISOString().slice(0, 16)}`;

	const run = (cmd: string, args: string[]): Promise<string> =>
		new Promise((resolve, reject) => {
			execFile(cmd, args, { cwd, timeout: 30000 }, (err, stdout, stderr) => {
				if (err) reject(new Error(`${cmd} ${args.join(" ")}: ${stderr || err.message}`));
				else resolve(stdout);
			});
		});

	await run("git", ["add", "-A"]);
	await run("git", ["commit", "-m", msg, "--allow-empty"]);
	const out = await run("git", ["push", config.remoteName, config.branch]);
	return out || "Published successfully.";
}
