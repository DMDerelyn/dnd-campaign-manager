export type ThemeId = "default" | "phb" | "dmg";

export const THEME_LABELS: Record<ThemeId, string> = {
	default: "Default (follows Obsidian theme)",
	phb: "Player's Handbook (parchment & red)",
	dmg: "Dungeon Master's Guide (dark & gold)",
};

export function applyTheme(themeId: ThemeId): void {
	document.body.classList.remove("campaign-theme-phb", "campaign-theme-dmg");
	if (themeId === "phb") {
		document.body.classList.add("campaign-theme-phb");
	} else if (themeId === "dmg") {
		document.body.classList.add("campaign-theme-dmg");
	}
}
