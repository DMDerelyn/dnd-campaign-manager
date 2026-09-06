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
	},
);
