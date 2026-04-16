export type ThemeId = "default" | "phb" | "blackgold";

export const THEME_LABELS: Record<ThemeId, string> = {
	default: "Default (follows Obsidian theme)",
	phb: "Player's Handbook (parchment & red)",
	blackgold: "Black & Gold",
};

export function applyTheme(themeId: ThemeId): void {
	document.body.classList.remove("campaign-theme-phb", "campaign-theme-blackgold");
	if (themeId === "phb") {
		document.body.classList.add("campaign-theme-phb");
	} else if (themeId === "blackgold") {
		document.body.classList.add("campaign-theme-blackgold");
	}
}
