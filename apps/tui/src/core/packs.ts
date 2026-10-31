import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type {
	Pack,
	PackItem,
	RawCommandPack,
	RawScriptPack,
	RawCommandItem,
	RawScriptItem,
	PackExample,
	PackKind,
	PackScope,
} from "../types";
import { userPacksDir } from "./userData";

const repoRoot = resolve(import.meta.dir, "../../../..");
const packsDir = join(repoRoot, "packs");

const samplePacks: Pack[] = [
	{
		id: "git",
		name: "Git",
		icon: "🌿",
		description: "Common Git workflows and safety checks",
		kind: "commands",
		scope: "default",
		items: [
			{
				id: "git-status",
				name: "Check status",
				description: "Inspect the working tree before committing.",
				command: "git status --short",
				useCase: "Use this to see tracked changes quickly.",
				category: "Repository",
				tags: ["status", "diff", "workflow"],
				dangerLevel: "safe",
				examples: [
					{
						description: "Show a short status view",
						command: "git status --short",
					},
				],
			},
		],
	},
	{
		id: "linux-scripts",
		name: "Scripts",
		icon: "🔧",
		description: "Personal maintenance helpers from /usr/local/bin",
		kind: "scripts",
		scope: "default",
		items: [
			{
				id: "yay-update",
				name: "Full system update",
				description: "Update all packages including the AUR.",
				command: "/usr/local/bin/yayUpdate",
				useCase: "Use when you want to refresh the entire Arch system.",
				category: "Maintenance",
				tags: ["yay", "aur", "update"],
				dangerLevel: "caution",
				examples: [
					{
						description: "Run the full system update script",
						command: "/usr/local/bin/yayUpdate",
					},
				],
			},
			{
				id: "pipe-restart",
				name: "Restart PipeWire",
				description: "Restart PipeWire and related user services.",
				command: "/usr/local/bin/pipeRst",
				useCase: "Use when desktop audio needs a quick reset.",
				category: "Audio",
				tags: ["pipewire", "audio"],
				dangerLevel: "safe",
				examples: [
					{
						description: "Restart the PipeWire stack",
						command: "/usr/local/bin/pipeRst",
					},
				],
			},
		],
	},
];

function mapExamples(examples: PackExample[] | undefined): PackExample[] {
	return (examples ?? []).map((example) => ({ ...example }));
}

export function resolvePackScope(
	pack: RawCommandPack["pack"] | RawScriptPack["pack"],
	relativePath: string,
): PackScope {
	if (pack.scope !== undefined) {
		if (pack.scope === "custom" || pack.scope === "default" || pack.scope === "community") {
			return pack.scope;
		}

		console.warn(`Invalid pack.scope "${pack.scope}" in ${relativePath}. Falling back to path/author inference.`);
	}

	const pathSegments = relativePath.split("/");
	if (pathSegments.includes("custom")) {
		return "custom";
	}
	if (pathSegments.includes("default")) {
		return "default";
	}
	if (pathSegments.includes("community")) {
		return "community";
	}

	if (pack.author === "sherpacli") {
		return "default";
	}
	if (pack.author === "sherpacli-community") {
		return "community";
	}

	if (pack.author.trim().length === 0) {
		return "default";
	}

	return "custom";
}

function toPackItem(packId: string, packName: string, command: RawCommandItem): PackItem {
	return {
		id: command.id,
		name: command.name,
		description: command.description,
		command: command.command,
		executionCommand: command.command,
		useCase: command.use_case,
		category: command.category,
		tags: [...command.tags],
		dangerLevel: command.danger_level ?? "safe",
		examples: mapExamples(command.examples),
		requires: command.requires ? [...command.requires] : undefined,
		packId,
		packName,
	};
}

function toScriptItem(packId: string, packName: string, script: RawScriptItem): PackItem {
	const executionCommand = script.execution.command ?? script.execution.path ?? script.id;
	const command =
		script.execution.type === "file" && script.execution.path
			? basename(script.execution.path)
			: (script.execution.command ?? script.name);

	return {
		id: script.id,
		name: script.name,
		description: script.description,
		command,
		executionCommand,
		useCase: script.description,
		category: script.category,
		tags: [...script.tags],
		dangerLevel: script.danger_level ?? "safe",
		examples: [],
		requires: script.requires ? [...script.requires] : undefined,
		args: script.execution.args?.map((arg) => ({ ...arg })),
		menu: script.execution.type === "menu" ? script.execution.options?.map((option) => ({ ...option })) : undefined,
		packId,
		packName,
	};
}

async function loadJsonFile(path: string) {
	const content = await readFile(path, "utf8");
	return JSON.parse(content) as RawCommandPack | RawScriptPack;
}

function normalizePackFile(file: RawCommandPack | RawScriptPack, relativePath: string): Pack {
	if ("commands" in file) {
		return {
			id: file.pack.id,
			name: file.pack.name,
			icon: file.pack.icon,
			description: file.pack.description,
			kind: "commands",
			scope: resolvePackScope(file.pack, relativePath),
			source: file.pack.source,
			items: file.commands.map((command) => toPackItem(file.pack.id, file.pack.name, command)),
		};
	}

	return {
		id: file.pack.id,
		name: file.pack.name,
		icon: file.pack.icon,
		description: file.pack.description,
		kind: "scripts",
		scope: resolvePackScope(file.pack, relativePath),
		source: file.pack.source,
		items: file.scripts.map((script) => toScriptItem(file.pack.id, file.pack.name, script)),
	};
}

function clonePack(pack: Pack): Pack {
	return {
		...pack,
		items: pack.items.map((item) => ({
			...item,
			examples: item.examples.map((example) => ({ ...example })),
		})),
	};
}

function sortPacksByUiOrder(loadedPacks: Pack[]): Pack[] {
	const kindOrder: Record<PackKind, number> = {
		scripts: 0,
		commands: 1,
	};
	const scopeOrder: Record<PackScope, number> = {
		custom: 0,
		default: 1,
		community: 2,
	};

	return [...loadedPacks].sort((a, b) => {
		const byKind = kindOrder[a.kind] - kindOrder[b.kind];
		if (byKind !== 0) {
			return byKind;
		}

		const byScope = scopeOrder[a.scope] - scopeOrder[b.scope];
		if (byScope !== 0) {
			return byScope;
		}

		return a.name.localeCompare(b.name);
	});
}

async function scanPackFiles(dir: string): Promise<string[]> {
	if (!existsSync(dir)) {
		return [];
	}
	const files: string[] = [];
	for await (const relativePath of new Bun.Glob("**/*.json").scan({ cwd: dir })) {
		files.push(relativePath);
	}
	return files.sort();
}

async function loadPackDir(dir: string): Promise<Pack[]> {
	const loaded: Pack[] = [];
	for (const relativePath of await scanPackFiles(dir)) {
		try {
			const loadedFile = await loadJsonFile(join(dir, relativePath));
			loaded.push(normalizePackFile(loadedFile, relativePath));
		} catch (error) {
			console.warn(`Skipping invalid pack ${join(dir, relativePath)}:`, error);
		}
	}
	return loaded;
}

/**
 * Loads the bundled packs, then the user's packs from `~/.config/sherpa/packs`
 * (same folder layout). A user pack replaces a bundled pack with the same id.
 */
export async function loadPacks(userDir = userPacksDir()): Promise<Pack[]> {
	const byId = new Map<string, Pack>();
	for (const pack of await loadPackDir(packsDir)) {
		byId.set(pack.id, pack);
	}
	for (const pack of await loadPackDir(userDir)) {
		byId.set(pack.id, pack);
	}

	if (byId.size === 0) {
		return samplePacks.map(clonePack);
	}

	return sortPacksByUiOrder([...byId.values()]);
}

export function flattenPackItems(packs: Pack[]): PackItem[] {
	return packs.flatMap((pack) => pack.items);
}
