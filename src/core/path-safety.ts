export function resolveCampaignSubfolder(root: string, sub: string | undefined): string | null {
	const trimmed = sub?.trim();
	if (!trimmed) return null;
	if (/^[\\/]/.test(trimmed)) return null;
	if (/^[a-zA-Z]:[\\/]/.test(trimmed)) return null;
	const segments = trimmed.split(/[\\/]+/).filter((s) => s.length > 0);
	if (segments.some((s) => s === "." || s === "..")) return null;
	const cleaned = segments.join("/");
	return root ? `${root}/${cleaned}` : cleaned;
}
