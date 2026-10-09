/**
 * Claude Code-style tool status indicators.
 *
 * Replaces Pi's boxed tool-execution panels with flat lines:
 *
 *   ● bash (make -j8)                     <- running: accent bullet
 *   ● bash (make -j8) linking… (partial)  <- streaming: yellow bullet
 *   ● bash (make -j8) +12/−0 42 lines     <- success: green bullet
 *   ● bash (make -j8) error: exit 2       <- failure: red bullet
 *
 * One entry per tool call: the result line replaces the call line (the
 * summary is never repeated on a second row).
 *
 * Output appears dimmed underneath when expanded (ctrl+o).
 *
 * Applies to every tool via the global registerToolRenderer hook,
 * including MCP and extension tools. Disable by removing this file
 * and running /reload.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const BULLET = "●";

function oneLine(s: string, max: number): string {
	const t = s.replace(/\s+/g, " ").trim();
	return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Short "(args…)" summary from common argument shapes. */
function argSummary(args: any): string {
	if (!args || typeof args !== "object") return "";
	const preferred = ["command", "path", "file", "url", "pattern", "query", "glob", "name", "prompt"];
	const parts: string[] = [];
	for (const k of preferred) {
		const v = args[k];
		if (v != null && v !== "") {
			parts.push(oneLine(String(v), 60));
			if (parts.length >= 2) break;
		}
	}
	if (parts.length === 0) {
		for (const k of Object.keys(args).slice(0, 3)) {
			parts.push(`${k}=${oneLine(String(args[k]), 30)}`);
		}
	}
	return parts.join(" ");
}

function textOf(result: any): string {
	const block = result?.content?.find?.((b: any) => b?.type === "text");
	return block?.text ?? "";
}

function firstLine(s: string): string {
	return s.split("\n").find((l) => l.trim()) ?? "";
}

/** Last non-empty line — the freshest output while streaming. */
function lastLine(s: string): string {
	return s.split("\n").filter((l) => l.trim()).pop() ?? "";
}

/** Full invocation text for the expanded view: the tool call itself. */
function formatCallLines(args: any, hasDiff: boolean): string[] {
	if (!args || typeof args !== "object") return [];
	if (typeof args.command === "string") return args.command.split("\n");
	if (typeof args.content === "string") return args.content.split("\n");
	if (hasDiff) return []; // edit: the diff already shows oldText/newText
	try {
		const json = JSON.stringify(args, null, 2);
		return json ? json.split("\n") : [];
	} catch {
		return [];
	}
}

const cap = (line: string) => (line.length > 200 ? `${line.slice(0, 199)}…` : line);

export default function (pi: ExtensionAPI) {
	// Claude Code-style prompt marker: "❯ " prefix on user messages
	// (display-only; the model still sees the original text).
	pi.registerMarkdownTransformer((markdown, context) => {
		if (context.messageType !== "user" || context.isStreaming) return markdown;
		if (markdown.startsWith("❯")) return markdown;
		return `❯ ${markdown}`;
	});

	pi.registerToolRenderer((toolName, _next) => {
		return {
			renderShell: "self" as const,

			renderCall(args: any, theme: any, context: any) {
				// Collapse once the result line exists: it already carries the
				// summary, so a finished call stays a single transcript entry
				// instead of stacking "bash (cmd)" above "bash (cmd): out".
				// renderResult sets state.hasResult and re-renders this slot.
				if (context?.state?.hasResult) return new Text("", 0, 0);

				let t = theme.fg("accent", `${BULLET} `);
				t += theme.fg("toolTitle", theme.bold(toolName));
				const s = argSummary(args);
				if (s) t += theme.fg("dim", ` (${s})`);
				return new Text(t, 0, 0);
			},

			renderResult(result: any, options: any, theme: any, context: any) {
				const { expanded, isPartial } = options;

				// This line replaces the call line. Remember that it exists so the
				// next renderCall pass draws nothing, and re-render once to collapse
				// it. Deferred (like pi's edit preview) because re-rendering
				// mid-pass would duplicate the result row.
				const state = context.state ?? {};
				if (!state.hasResult) {
					state.hasResult = true;
					queueMicrotask(() => context.invalidate?.());
				}

				if (isPartial) {
					let t = theme.fg("warning", `${BULLET} `);
					t += theme.fg("toolTitle", theme.bold(toolName));
					const s = argSummary(context?.args);
					if (s) t += theme.fg("dim", ` (${s})`);
					const streaming = oneLine(lastLine(textOf(result)), 70);
					if (streaming) t += theme.fg("dim", ` ${streaming}`);

					// ctrl+o while running: live tail of the streaming output
					if (expanded) {
						const lines = textOf(result).split("\n").filter((l: string) => l.length > 0);
						const shown = lines.slice(-40);
						if (shown.length > 0) t += `\n${theme.fg("muted", "out:")}`;
						for (const line of shown) t += `\n  ${theme.fg("dim", cap(line))}`;
						if (lines.length > shown.length) {
							t += `\n${theme.fg("muted", `… ${lines.length - shown.length} earlier lines`)}`;
						}
					}
					return new Text(t, 0, 0);
				}

				// The TUI forwards only {content, details} here and reports errors
				// via context.isError; the HTML export passes isError on the result.
				const isError = result?.isError === true || context?.isError === true;
				const output = textOf(result);
				const statusColor = isError ? "error" : "success";

				let t = theme.fg(statusColor, `${BULLET} `);
				t += theme.fg("toolTitle", theme.bold(toolName));
				const s = argSummary(context?.args);
				if (s) t += theme.fg("dim", ` (${s})`);

				// Status summary
				const diff: unknown = result?.details?.diff;
				if (isError) {
					const msg = oneLine(firstLine(output) || "failed", 90);
					t += theme.fg("error", ` ${msg}`);
				} else if (typeof diff === "string") {
					let add = 0;
					let rem = 0;
					for (const line of diff.split("\n")) {
						if (line.startsWith("+") && !line.startsWith("+++")) add++;
						else if (line.startsWith("-") && !line.startsWith("---")) rem++;
					}
					t += ` ${theme.fg("success", `+${add}`)}${theme.fg("dim", "/")}${theme.fg("error", `-${rem}`)}`;
				} else if (result?.content?.some?.((b: any) => b?.type === "image")) {
					t += theme.fg("muted", " image");
				} else {
					const lineCount = output ? output.split("\n").filter((l) => l.trim()).length : 0;
					const msg = oneLine(firstLine(output), 80);
					if (msg) t += theme.fg("muted", ` ${msg}`);
					if (lineCount > 1) t += theme.fg("dim", ` (${lineCount} lines)`);
				}

				// Collapsed by default; ctrl+o expands to the full call + output
				if (expanded) {
					const callLines = formatCallLines(context?.args, typeof diff === "string");
					if (callLines.length > 0) {
						t += `\n${theme.fg("muted", "call:")}`;
						const shownCall = callLines.slice(0, 40);
						for (const line of shownCall) t += `\n  ${theme.fg("dim", cap(line))}`;
						if (callLines.length > shownCall.length) {
							t += `\n${theme.fg("muted", `… ${callLines.length - shownCall.length} more arg lines`)}`;
						}
					}

					const body = typeof diff === "string" ? diff : output;
					const lines = body.split("\n").filter((l) => l.length > 0);
					const shown = lines.slice(0, 40);
					if (shown.length > 0) t += `\n${theme.fg("muted", "out:")}`;
					for (const line of shown) {
						if (typeof diff === "string" && line.startsWith("+") && !line.startsWith("+++")) {
							t += `\n  ${theme.fg("success", cap(line))}`;
						} else if (typeof diff === "string" && line.startsWith("-") && !line.startsWith("---")) {
							t += `\n  ${theme.fg("error", cap(line))}`;
						} else {
							t += `\n  ${theme.fg("dim", cap(line))}`;
						}
					}
					if (lines.length > shown.length) {
						t += `\n${theme.fg("muted", `… ${lines.length - shown.length} more lines`)}`;
					}
				}

				return new Text(t, 0, 0);
			},
		};
	});
}
