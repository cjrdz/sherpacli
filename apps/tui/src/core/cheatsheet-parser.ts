import type { DangerLevel, RawCommandItem, RawCommandPack } from "../types";

/**
 * Converts a quickref.me / cheatsheets.zip markdown sheet (Fechin/reference format)
 * into a Sherpa command pack. Two shapes carry commands in those sheets:
 *
 * - tables where one cell is a single `code span` and another describes it
 * - fenced shell blocks, with optional `$ ` prompts and `# comments`
 */

export interface ParseOptions {
	sheet: string;
	sourceUrl?: string;
	author?: string;
	license?: string;
	/** Prefix for the pack id, so imports never collide with bundled packs. */
	idPrefix?: string;
}

interface Candidate {
	command: string;
	description?: string;
	category: string;
}

const SHELL_FENCES = new Set(["", "shell", "shell script", "bash", "sh", "console", "zsh", "shell-session"]);
const SHELL_KEYWORDS = new Set([
	"if",
	"then",
	"else",
	"elif",
	"fi",
	"for",
	"while",
	"until",
	"do",
	"done",
	"case",
	"esac",
	"function",
	"return",
	"local",
	"declare",
	"export",
	"{",
	"}",
]);

const DESTRUCTIVE_PATTERN =
	/\brm\s+-\w*[rf]|\brmi?\b.*\s-\w*f\b|\bmkfs\b|\bdd\s+if=|\b(delete|destroy|prune|purge|drop|truncate|shred|wipe)\b|--force\b|\bpush\b.*\s-f\b|\breset\s+--hard\b|\bkill\b.*-9\b|\bclean\s+-\w*f/i;
const CAUTION_PATTERN =
	/\b(rm|rmi|rmdir|kill|killall|pkill|stop|restart|reboot|shutdown|sudo|chmod|chown|mv|reset|revert|rebase|uninstall|remove|down|apply|push|scale|drain|cordon|rollout|merge|stash\s+drop)\b/i;

export function classifyDanger(command: string): DangerLevel {
	if (DESTRUCTIVE_PATTERN.test(command)) {
		return "destructive";
	}
	return CAUTION_PATTERN.test(command) ? "caution" : "safe";
}

export function cleanInline(text: string): string {
	return text
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/`([^`]*)`/g, "$1")
		.replace(/(\*\*|__|\*|_)(\S(?:.*?\S)?)\1/g, "$2")
		.replace(/\{\.[^}]*\}/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function cleanHeading(line: string): string {
	return cleanInline(line.replace(/^#+\s*/, ""));
}

/** `[pod_name]` → `<pod_name>` so Sherpa can prompt for it. JSONPath (`[*]`) and `[[ … ]]` are untouched. */
export function normalizePlaceholders(command: string): string {
	return command.replace(/(^|[\s=:/])\[([A-Za-z][\w-]*)\](?=$|[\s/:.,])/g, "$1<$2>");
}

function hasUnbalancedQuotes(text: string): boolean {
	let single = false;
	let double = false;
	for (const char of text) {
		if (char === "'" && !double) {
			single = !single;
		} else if (char === '"' && !single) {
			double = !double;
		}
	}
	return single || double;
}

/** Splits `cmd # comment` when the `#` is outside quotes. */
function splitTrailingComment(line: string): { command: string; comment?: string } {
	const match = /\s+#\s*(.*)$/.exec(line);
	if (!match || match.index === undefined) {
		return { command: line };
	}
	const command = line.slice(0, match.index);
	if (hasUnbalancedQuotes(command)) {
		return { command: line };
	}
	const comment = match[1]?.trim();
	return { command: command.trimEnd(), comment: comment && !comment.startsWith("=>") ? comment : undefined };
}

function looksLikeCommand(command: string): boolean {
	const first = command.split(/\s+/)[0] ?? "";
	if (!/^[a-z.~/][\w.+/-]*$/i.test(first) || SHELL_KEYWORDS.has(first)) {
		return false;
	}
	// `NAME="value"` assignments and `--flag` fragments are not runnable commands.
	return !/^[A-Za-z_][\w]*=/.test(command) && !first.startsWith("-");
}

function parseTableRow(line: string): string[] {
	return line
		.trim()
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split(/(?<!\\)\|/)
		.map((cell) => cell.trim());
}

const SINGLE_CODE_SPAN = /^`([^`]+)`$/;

function fromTableRow(cells: string[], category: string): Candidate | null {
	const codeIndex = cells.findIndex((cell) => SINGLE_CODE_SPAN.test(cell));
	if (codeIndex < 0) {
		return null;
	}
	const command = SINGLE_CODE_SPAN.exec(cells[codeIndex] ?? "")?.[1]?.trim() ?? "";
	if (!looksLikeCommand(command) || !command.includes(" ")) {
		return null;
	}
	const description = cells
		.filter((_, index) => index !== codeIndex)
		.map(cleanInline)
		.find((cell) => cell.length > 0);
	return { command, description, category };
}

function fromCodeBlock(lines: string[], category: string, prose?: string): Candidate[] {
	const body = lines.filter((line) => line.trim().length > 0);
	if (body.length === 0 || body[0]?.startsWith("#!")) {
		return [];
	}

	// With `$ ` prompts, unprompted lines are output; without, every line is a command.
	const prompted = body.some((line) => /^\s*\$ /.test(line));
	const commentsFirst = body[0]?.trim().startsWith("#") ?? false;
	const candidates: Candidate[] = [];
	let pendingComment: string | undefined;

	for (let index = 0; index < body.length; index++) {
		let line = (body[index] ?? "").trim();
		if (line.startsWith("#")) {
			const comment = cleanInline(line.replace(/^#+\s*/, ""));
			// `# => value` shows output, it doesn't describe the command.
			if (comment.startsWith("=>")) {
				continue;
			}
			const previous = candidates.at(-1);
			if (!commentsFirst && previous && !previous.description) {
				previous.description = comment;
			} else {
				pendingComment = comment;
			}
			continue;
		}
		if (prompted) {
			if (!line.startsWith("$ ")) {
				continue;
			}
			line = line.slice(2).trim();
		}
		while (line.endsWith("\\") && index + 1 < body.length) {
			index += 1;
			line = `${line.slice(0, -1).trimEnd()} ${(body[index] ?? "").trim().replace(/^\$ /, "")}`;
		}
		const { command, comment } = splitTrailingComment(line);
		if (!looksLikeCommand(command)) {
			continue;
		}
		candidates.push({ command, description: comment ?? pendingComment, category });
		pendingComment = undefined;
	}

	const first = candidates[0];
	if (first && !first.description && prose && candidates.length === 1) {
		first.description = prose;
	}
	return candidates;
}

function parseFrontMatter(markdown: string): { meta: Record<string, string | string[]>; body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(markdown);
	if (!match) {
		return { meta: {}, body: markdown };
	}
	const meta: Record<string, string | string[]> = {};
	let listKey: string | undefined;
	let blockKey: string | undefined;
	for (const line of (match[1] ?? "").split(/\r?\n/)) {
		const listItem = /^\s+-\s+(.+)$/.exec(line);
		if (listItem && listKey) {
			(meta[listKey] as string[]).push((listItem[1] ?? "").trim());
			continue;
		}
		if (blockKey && /^\s+\S/.test(line)) {
			meta[blockKey] = `${meta[blockKey] ?? ""} ${line.trim()}`.trim();
			continue;
		}
		const pair = /^([\w-]+):\s*(.*)$/.exec(line);
		listKey = undefined;
		blockKey = undefined;
		if (!pair) {
			continue;
		}
		const [, key, value] = pair as unknown as [string, string, string];
		if (value === "") {
			meta[key] = [];
			listKey = key;
		} else if (value === "|" || value === ">") {
			meta[key] = "";
			blockKey = key;
		} else {
			meta[key] = value.replace(/^["']|["']$/g, "");
		}
	}
	return { meta, body: markdown.slice(match[0].length) };
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function shortHash(text: string): string {
	return Bun.hash(text).toString(16).slice(-6);
}

function toName(description: string | undefined, command: string): string {
	const base = description && description.length > 0 ? description : command;
	const firstSentence = base.split(/(?<=\.)\s/)[0] ?? base;
	const trimmed = firstSentence.replace(/\.$/, "");
	return trimmed.length > 60 ? `${trimmed.slice(0, 57).trimEnd()}…` : trimmed;
}

export function parseCheatsheet(markdown: string, options: ParseOptions): RawCommandPack {
	const { meta, body } = parseFrontMatter(markdown);
	const title = typeof meta.title === "string" && meta.title.length > 0 ? meta.title : options.sheet;
	const sheetTags = Array.isArray(meta.tags) ? meta.tags.map(slugify).filter(Boolean) : [];
	const intro = typeof meta.intro === "string" ? cleanInline(meta.intro) : "";

	const candidates: Candidate[] = [];
	let section = title;
	let subsection = "";
	let prose: string | undefined;
	let fence: { lang: string; lines: string[] } | null = null;

	for (const rawLine of body.split(/\r?\n/)) {
		const line = rawLine.replace(/\s+$/, "");

		if (fence) {
			if (/^\s*```/.test(line)) {
				if (SHELL_FENCES.has(fence.lang)) {
					candidates.push(...fromCodeBlock(fence.lines, subsection || section, prose));
				}
				fence = null;
				prose = undefined;
			} else {
				fence.lines.push(line);
			}
			continue;
		}

		// Fences may carry attributes: ```shell script {.wrap}
		const fenceOpen = /^\s*```(.*)$/.exec(line);
		if (fenceOpen) {
			const lang = (fenceOpen[1] ?? "")
				.replace(/\{[^}]*\}/g, "")
				.trim()
				.toLowerCase();
			fence = { lang, lines: [] };
			continue;
		}
		if (/^##\s/.test(line)) {
			section = cleanHeading(line);
			subsection = "";
			prose = undefined;
			continue;
		}
		if (/^###+\s/.test(line)) {
			subsection = cleanHeading(line);
			prose = undefined;
			continue;
		}
		if (/^\s*\|/.test(line)) {
			const cells = parseTableRow(line);
			if (cells.every((cell) => /^:?-{2,}:?$/.test(cell) || cell === "")) {
				continue;
			}
			const candidate = fromTableRow(cells, subsection || section);
			if (candidate) {
				candidates.push(candidate);
			}
			continue;
		}
		const text = line.trim();
		if (text.length === 0 || text === "---" || /^\{\.[^}]*\}$/.test(text) || /^[-*+]\s/.test(text)) {
			continue;
		}
		prose = cleanInline(text);
	}

	const seen = new Set<string>();
	const commands: RawCommandItem[] = [];
	for (const candidate of candidates) {
		const command = normalizePlaceholders(candidate.command.replace(/\s{2,}/g, " "));
		if (seen.has(command)) {
			continue;
		}
		seen.add(command);
		const description = candidate.description?.length ? candidate.description : `${candidate.category}: ${command}`;
		commands.push({
			id: `${slugify(command).slice(0, 40)}-${shortHash(command)}`,
			name: toName(candidate.description, command),
			description,
			command,
			use_case: description,
			category: candidate.category,
			tags: [...new Set([options.sheet, slugify(candidate.category)].filter(Boolean))],
			examples: [{ description, command }],
			danger_level: classifyDanger(command),
		});
	}

	return {
		pack: {
			id: `${options.idPrefix ?? "quickref"}-${options.sheet}`,
			name: title,
			version: new Date().toISOString().slice(0, 10),
			description: intro || `${title} cheat sheet`,
			icon: "📘",
			author: options.author ?? "Fechin/reference (quickref.me)",
			tags: [...new Set([options.sheet, ...sheetTags])],
			scope: "community",
			source: options.sourceUrl,
			license: options.license,
		},
		commands,
	};
}
