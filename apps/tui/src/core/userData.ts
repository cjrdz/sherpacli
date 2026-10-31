import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const MAX_RECENTS = 30;

export interface UserData {
	version: 1;
	/** Item keys (`packId/itemId`) in the order they were starred. */
	favorites: string[];
	/** Item keys, most recent first. */
	recents: string[];
	/** Last value entered for each placeholder name. */
	values: Record<string, string>;
}

export function configDir(): string {
	const base = process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
	return join(base, "sherpa");
}

export function userPacksDir(): string {
	return join(configDir(), "packs");
}

function statePath(): string {
	return join(configDir(), "state.json");
}

export function itemKey(item: { packId: string; id: string }): string {
	return `${item.packId}/${item.id}`;
}

function emptyUserData(): UserData {
	return { version: 1, favorites: [], recents: [], values: {} };
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function loadUserData(path = statePath()): UserData {
	if (!existsSync(path)) {
		return emptyUserData();
	}
	try {
		const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<UserData>;
		const values: Record<string, string> = {};
		for (const [name, value] of Object.entries(raw.values ?? {})) {
			if (typeof value === "string") {
				values[name] = value;
			}
		}
		return {
			version: 1,
			favorites: stringArray(raw.favorites),
			recents: stringArray(raw.recents).slice(0, MAX_RECENTS),
			values,
		};
	} catch {
		// A corrupt state file should never stop Sherpa from starting.
		return emptyUserData();
	}
}

export function saveUserData(data: UserData, path = statePath()): void {
	mkdirSync(dirname(path), { recursive: true });
	const tempPath = `${path}.${process.pid}.tmp`;
	writeFileSync(tempPath, `${JSON.stringify(data, null, "\t")}\n`, "utf8");
	renameSync(tempPath, path);
}

export function toggleFavorite(data: UserData, key: string): UserData {
	const favorites = data.favorites.includes(key)
		? data.favorites.filter((entry) => entry !== key)
		: [...data.favorites, key];
	return { ...data, favorites };
}

export function recordUse(data: UserData, key: string, values: Record<string, string>): UserData {
	const recents = [key, ...data.recents.filter((entry) => entry !== key)].slice(0, MAX_RECENTS);
	const remembered = { ...data.values };
	for (const [name, value] of Object.entries(values)) {
		if (value.length > 0) {
			remembered[name] = value;
		}
	}
	return { ...data, recents, values: remembered };
}
