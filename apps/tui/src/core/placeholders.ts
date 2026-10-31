import type { PackItem } from "../types";

export interface Placeholder {
	name: string;
	prompt: string;
	defaultValue?: string;
}

// Matches `<name>`, `<name:default>`, `{{name}}` and `{{name:default}}`.
// The name must start with a letter, so shell redirects (`< file`, `<<EOF`)
// and brace expansions (`{1..5}`, `%{http_code}`) are left alone.
const TOKEN_PATTERN = /<([A-Za-z][\w-]*)(?::([^<>\n]*))?>|\{\{\s*([A-Za-z][\w-]*)(?::([^{}\n]*))?\s*\}\}/g;

function humanize(name: string): string {
	const words = name.replace(/[-_]+/g, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function parsePlaceholders(command: string): Placeholder[] {
	const seen = new Map<string, Placeholder>();
	for (const match of command.matchAll(TOKEN_PATTERN)) {
		const name = match[1] ?? match[3];
		if (!name || seen.has(name)) {
			continue;
		}
		const defaultValue = match[2] ?? match[4];
		seen.set(name, {
			name,
			prompt: humanize(name),
			defaultValue: defaultValue?.length ? defaultValue : undefined,
		});
	}
	return [...seen.values()];
}

export function fillPlaceholders(command: string, values: Record<string, string>): string {
	return command.replace(TOKEN_PATTERN, (token, angleName, angleDefault, braceName, braceDefault) => {
		const name = (angleName ?? braceName) as string;
		const value = values[name];
		if (value !== undefined && value.length > 0) {
			return value;
		}
		const fallback = (angleDefault ?? braceDefault) as string | undefined;
		return fallback?.length ? fallback : token;
	});
}

export function shellQuote(value: string): string {
	if (/^[\w@%+=:,./-]+$/.test(value)) {
		return value;
	}
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Collects every value the user must provide before `command` can run:
 * inline tokens first, then script `execution.args` not already covered by a token.
 */
export function collectParams(command: string, item: Pick<PackItem, "args">): Placeholder[] {
	const params = parsePlaceholders(command);
	const known = new Set(params.map((param) => param.name));
	for (const arg of item.args ?? []) {
		if (known.has(arg.name)) {
			const existing = params.find((param) => param.name === arg.name);
			if (existing) {
				existing.prompt = arg.prompt;
				existing.defaultValue ??= arg.default;
			}
			continue;
		}
		params.push({ name: arg.name, prompt: arg.prompt, defaultValue: arg.default });
	}
	return params;
}

/**
 * Resolves `command` with `values`. Script args without a matching token are
 * appended as shell-quoted positional arguments, in declaration order.
 */
export function resolveCommand(command: string, item: Pick<PackItem, "args">, values: Record<string, string>): string {
	const tokenNames = new Set(parsePlaceholders(command).map((param) => param.name));
	let resolved = fillPlaceholders(command, values);
	for (const arg of item.args ?? []) {
		if (tokenNames.has(arg.name)) {
			continue;
		}
		const value = values[arg.name] ?? arg.default ?? "";
		if (value.length > 0) {
			resolved += ` ${shellQuote(value)}`;
		}
	}
	return resolved;
}
