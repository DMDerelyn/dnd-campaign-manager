/**
 * Coerce an unknown frontmatter value to a display string. Objects and arrays
 * (which would stringify to `[object Object]`) collapse to `""` so callers can
 * treat the result as "printable or empty".
 */
export function scalarText(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return "";
}

/**
 * Attach a click handler that may return a promise. A rejection is logged
 * rather than left unhandled, and the call site stays free of
 * `no-misused-promises` / `no-floating-promises`.
 */
export function onClick(
	el: HTMLElement,
	handler: (ev: MouseEvent) => void | Promise<void>,
): void {
	el.addEventListener("click", (ev) => {
		void (async () => handler(ev))().catch((err) => console.error(err));
	});
}
