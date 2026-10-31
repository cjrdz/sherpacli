import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { executeMigration, planMigration } from "./migrate";

const createdRoots: string[] = [];

async function createFixtureRoot() {
	const root = await mkdtemp(join(tmpdir(), "sherpa-migrate-"));
	createdRoots.push(root);
	await mkdir(join(root, "packs/commands"), { recursive: true });
	await mkdir(join(root, "packs/scripts"), { recursive: true });
	await mkdir(join(root, "schemas"), { recursive: true });
	return root;
}

async function writeSchemas(root: string) {
	const commandSchema = {
		type: "object",
		required: ["pack", "commands"],
		properties: {
			pack: { type: "object", required: ["id", "name", "version", "description", "icon", "author", "tags"] },
			commands: { type: "array" },
		},
		additionalProperties: true,
	};
	const scriptSchema = {
		type: "object",
		required: ["pack", "scripts"],
		properties: {
			pack: { type: "object", required: ["id", "name", "version", "description", "icon", "author", "tags"] },
			scripts: { type: "array" },
		},
		additionalProperties: true,
	};

	await writeFile(join(root, "schemas/command-pack.schema.json"), JSON.stringify(commandSchema), "utf8");
	await writeFile(join(root, "schemas/script-pack.schema.json"), JSON.stringify(scriptSchema), "utf8");
}

afterEach(async () => {
	for (const root of createdRoots.splice(0, createdRoots.length)) {
		await rm(root, { recursive: true, force: true });
	}
});

describe("migrate", () => {
	test("plans move from flat to scoped path", async () => {
		const root = await createFixtureRoot();
		await writeSchemas(root);
		await writeFile(
			join(root, "packs/commands/git.json"),
			JSON.stringify({
				pack: {
					id: "git",
					name: "Git",
					version: "1.0.0",
					description: "Git commands",
					icon: "g",
					author: "sherpacli",
					tags: ["git"],
				},
				commands: [],
			}),
			"utf8",
		);

		const report = await planMigration({
			target: "all",
			from: "auto",
			to: "scoped",
			apply: false,
			force: false,
			packsDir: join(root, "packs"),
		});

		expect(report.summary.moved).toBe(1);
		expect(report.items[0]?.destination).toBe("commands/default/git.json");
	});

	test("applies move and validates result", async () => {
		const root = await createFixtureRoot();
		await writeSchemas(root);
		await writeFile(
			join(root, "packs/scripts/local.json"),
			JSON.stringify({
				pack: {
					id: "local-scripts",
					name: "Local",
					version: "1.0.0",
					description: "Local scripts",
					icon: "s",
					author: "me",
					tags: ["local"],
				},
				scripts: [],
			}),
			"utf8",
		);

		const report = await executeMigration({
			target: "all",
			from: "auto",
			to: "scoped",
			apply: true,
			force: false,
			packsDir: join(root, "packs"),
		});

		expect(report.applied).toBe(true);
		expect(report.summary.moved).toBe(1);
		expect(report.validation?.ok).toBe(true);

		const moved = await readFile(join(root, "packs/scripts/custom/local.json"), "utf8");
		expect(moved.length).toBeGreaterThan(0);
	});
});
