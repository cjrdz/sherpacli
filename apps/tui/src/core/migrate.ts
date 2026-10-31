import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { PackKind, PackScope, RawCommandPack, RawScriptPack } from "../types";
import { resolvePackScope } from "./packs";
import { validatePackDirectory, type ValidationReport } from "./pack-validation";

export type MigrateTarget = "commands" | "scripts" | "all";
export type MigrateFrom = "flat" | "scoped" | "auto";
export type MigrateTo = "scoped";

const SCOPES: PackScope[] = ["custom", "default", "community"];

export interface MigrateOptions {
	target: MigrateTarget;
	from: MigrateFrom;
	to: MigrateTo;
	apply: boolean;
	force: boolean;
	packsDir?: string;
}

export interface MigrateConflict {
	source: string;
	destination: string;
	reason: string;
}

export interface MigrateItem {
	source: string;
	destination: string;
	kind: PackKind;
	scope: PackScope;
	packId: string;
	action: "move" | "unchanged" | "skip";
	reason?: string;
}

export interface MigrateReport {
	applied: boolean;
	packsDir: string;
	summary: {
		total: number;
		moved: number;
		unchanged: number;
		skipped: number;
		conflicts: number;
	};
	items: MigrateItem[];
	conflicts: MigrateConflict[];
	validation?: ValidationReport;
}

function inferKind(relativePath: string): PackKind | null {
	const first = relativePath.split("/")[0];
	if (first === "commands" || first === "scripts") {
		return first;
	}
	return null;
}

function isScopedPath(relativePath: string): boolean {
	const parts = relativePath.split("/");
	return parts.length >= 3 && SCOPES.includes(parts[1] as PackScope);
}

function shouldIncludeFrom(relativePath: string, from: MigrateFrom): boolean {
	const scoped = isScopedPath(relativePath);
	if (from === "flat") {
		return !scoped;
	}
	if (from === "scoped") {
		return scoped;
	}
	// auto: migrate flat paths only
	return !scoped;
}

function sortItems(items: MigrateItem[]): MigrateItem[] {
	return [...items].sort((a, b) => {
		if (a.source === b.source) {
			return a.destination.localeCompare(b.destination);
		}
		return a.source.localeCompare(b.source);
	});
}

function createPackMapKey(kind: PackKind, scope: PackScope, packId: string): string {
	return `${kind}:${scope}:${packId}`;
}

function toPackData(raw: unknown): RawCommandPack | RawScriptPack {
	if (!raw || typeof raw !== "object") {
		throw new Error("Pack JSON must be an object.");
	}

	const typed = raw as RawCommandPack | RawScriptPack;
	if (!("pack" in typed) || !typed.pack || typeof typed.pack !== "object") {
		throw new Error("Missing pack metadata.");
	}

	if (!("id" in typed.pack) || typeof typed.pack.id !== "string") {
		throw new Error("Missing pack.id.");
	}

	return typed;
}

export async function planMigration(options: MigrateOptions): Promise<MigrateReport> {
	const repoRoot = resolve(import.meta.dir, "../../../..");
	const packsDir = options.packsDir ?? join(repoRoot, "packs");

	if (!existsSync(packsDir)) {
		throw new Error(`Packs directory not found: ${packsDir}`);
	}

	const items: MigrateItem[] = [];
	const conflicts: MigrateConflict[] = [];
	const destinations = new Map<string, string>();
	const packIds = new Map<string, string>();

	for await (const relativePath of new Bun.Glob("**/*.json").scan({ cwd: packsDir })) {
		const kind = inferKind(relativePath);
		if (!kind) {
			continue;
		}
		if (options.target !== "all" && kind !== options.target) {
			continue;
		}
		if (!shouldIncludeFrom(relativePath, options.from)) {
			continue;
		}

		const fullPath = join(packsDir, relativePath);
		let raw: unknown;
		try {
			raw = JSON.parse(await readFile(fullPath, "utf8"));
		} catch (error) {
			items.push({
				source: relativePath,
				destination: relativePath,
				kind,
				scope: "default",
				packId: "unknown",
				action: "skip",
				reason: `invalid_json: ${(error as Error).message}`,
			});
			continue;
		}

		let packData: RawCommandPack | RawScriptPack;
		try {
			packData = toPackData(raw);
		} catch (error) {
			items.push({
				source: relativePath,
				destination: relativePath,
				kind,
				scope: "default",
				packId: "unknown",
				action: "skip",
				reason: `invalid_pack: ${(error as Error).message}`,
			});
			continue;
		}

		const scope = resolvePackScope(packData.pack, relativePath);
		const destination = `${kind}/${scope}/${basename(relativePath)}`;
		const packId = packData.pack.id;
		const packKey = createPackMapKey(kind, scope, packId);

		if (destination === relativePath) {
			items.push({
				source: relativePath,
				destination,
				kind,
				scope,
				packId,
				action: "unchanged",
			});
			continue;
		}

		const previousSourceForDestination = destinations.get(destination);
		if (previousSourceForDestination && previousSourceForDestination !== relativePath) {
			conflicts.push({
				source: relativePath,
				destination,
				reason: `destination_already_planned_by:${previousSourceForDestination}`,
			});
			items.push({
				source: relativePath,
				destination,
				kind,
				scope,
				packId,
				action: "skip",
				reason: "planned_destination_conflict",
			});
			continue;
		}

		const previousSourceForPackId = packIds.get(packKey);
		if (previousSourceForPackId && previousSourceForPackId !== relativePath) {
			conflicts.push({
				source: relativePath,
				destination,
				reason: `duplicate_pack_id_in_scope:${packId}`,
			});
			items.push({
				source: relativePath,
				destination,
				kind,
				scope,
				packId,
				action: "skip",
				reason: "duplicate_pack_id",
			});
			continue;
		}

		destinations.set(destination, relativePath);
		packIds.set(packKey, relativePath);

		const destinationPath = join(packsDir, destination);
		if (existsSync(destinationPath) && relativePath !== destination) {
			if (!options.force) {
				conflicts.push({
					source: relativePath,
					destination,
					reason: "destination_exists",
				});
				items.push({
					source: relativePath,
					destination,
					kind,
					scope,
					packId,
					action: "skip",
					reason: "destination_exists",
				});
				continue;
			}
		}

		items.push({
			source: relativePath,
			destination,
			kind,
			scope,
			packId,
			action: "move",
		});
	}

	const sorted = sortItems(items);
	const summary = {
		total: sorted.length,
		moved: sorted.filter((item) => item.action === "move").length,
		unchanged: sorted.filter((item) => item.action === "unchanged").length,
		skipped: sorted.filter((item) => item.action === "skip").length,
		conflicts: conflicts.length,
	};

	return {
		applied: false,
		packsDir,
		summary,
		items: sorted,
		conflicts,
	};
}

export async function executeMigration(options: MigrateOptions): Promise<MigrateReport> {
	const report = await planMigration(options);
	if (!options.apply) {
		return report;
	}

	const preValidation = await validatePackDirectory(report.packsDir);
	if (!preValidation.ok) {
		return {
			...report,
			applied: false,
			validation: preValidation,
		};
	}

	const movedPairs: Array<{ sourcePath: string; destinationPath: string }> = [];

	try {
		for (const item of report.items) {
			if (item.action !== "move") {
				continue;
			}

			const sourcePath = join(report.packsDir, item.source);
			const destinationPath = join(report.packsDir, item.destination);
			await mkdir(dirname(destinationPath), { recursive: true });
			if (options.force) {
				await rm(destinationPath, { force: true });
			}
			await rename(sourcePath, destinationPath);
			movedPairs.push({ sourcePath, destinationPath });
		}
	} catch (error) {
		for (const moved of movedPairs.reverse()) {
			await rename(moved.destinationPath, moved.sourcePath).catch(() => undefined);
		}
		throw error;
	}

	const validation = await validatePackDirectory(report.packsDir);
	if (!validation.ok) {
		for (const moved of movedPairs.reverse()) {
			await rename(moved.destinationPath, moved.sourcePath).catch(() => undefined);
		}
		return {
			...report,
			applied: false,
			validation,
		};
	}

	return {
		...report,
		applied: true,
		validation,
	};
}
