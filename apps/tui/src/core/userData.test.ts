import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_RECENTS, loadUserData, recordUse, saveUserData, toggleFavorite } from "./userData";

const dirs: string[] = [];
function tempFile() {
	const dir = mkdtempSync(join(tmpdir(), "sherpa-user-"));
	dirs.push(dir);
	return join(dir, "nested", "state.json");
}

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("userData", () => {
	test("round-trips through disk and creates the directory", () => {
		const path = tempFile();
		let data = loadUserData(path);
		data = toggleFavorite(data, "docker/docker-ps");
		data = recordUse(data, "k8s/logs", { "pod-name": "web-1", empty: "" });
		saveUserData(data, path);
		expect(loadUserData(path)).toEqual({
			version: 1,
			favorites: ["docker/docker-ps"],
			recents: ["k8s/logs"],
			values: { "pod-name": "web-1" },
		});
	});

	test("toggleFavorite removes an existing favorite", () => {
		const data = toggleFavorite(toggleFavorite(loadUserData(tempFile()), "a/b"), "a/b");
		expect(data.favorites).toEqual([]);
	});

	test("recordUse moves repeats to the front and caps the list", () => {
		let data = loadUserData(tempFile());
		for (let index = 0; index < MAX_RECENTS + 5; index++) {
			data = recordUse(data, `p/${index}`, {});
		}
		data = recordUse(data, "p/10", {});
		expect(data.recents[0]).toBe("p/10");
		expect(data.recents).toHaveLength(MAX_RECENTS);
		expect(new Set(data.recents).size).toBe(MAX_RECENTS);
	});

	test("a corrupt file falls back to empty state", () => {
		const path = tempFile();
		saveUserData(loadUserData(path), path);
		writeFileSync(path, "{not json");
		expect(loadUserData(path).favorites).toEqual([]);
	});
});
