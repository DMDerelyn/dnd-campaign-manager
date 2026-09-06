import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
	{
		ignores: ["main.js", "node_modules/**", "**/*.test.ts"],
	},
	...tseslint.configs.recommendedTypeChecked,
	...obsidianmd.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// The plugin's UI copy uses Title Case for command/setting names
			// consistently. Sentence-case is a style preference, not a
			// submission blocker; revisit as a dedicated copy pass.
			"obsidianmd/ui/sentence-case": "off",
		},
	},
);
