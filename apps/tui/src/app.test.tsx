import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testRender } from "@opentui/solid";
import { App } from "./app";

// Keep tests away from the real ~/.config/sherpa (favorites, recents, user packs).
const configHome = mkdtempSync(join(tmpdir(), "sherpa-app-test-"));
process.env.XDG_CONFIG_HOME = configHome;
afterAll(() => rmSync(configHome, { recursive: true, force: true }));

type Setup = Awaited<ReturnType<typeof testRender>>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let current: Setup | undefined;

async function mount(width = 140, height = 40) {
	current = await testRender(() => <App />, { width, height });
	await sleep(200); // let packs load
	return current;
}

async function frame(setup: Setup) {
	await sleep(30);
	await setup.renderOnce();
	return setup.captureCharFrame();
}

afterEach(() => {
	current?.renderer.destroy();
	current = undefined;
});

describe("search", () => {
	test("typing goes to the input, not to j/k/p/r/c shortcuts", async () => {
		const t = await mount();
		await t.mockInput.typeText("/kube logs");
		const screen = await frame(t);
		expect(screen).toContain("❯ kube logs");
		expect(screen).toContain("View pod logs");
		expect(screen).not.toContain("PARAMS");
	});

	test("Esc clears the query, then leaves search, and never quits", async () => {
		const t = await mount();
		await t.mockInput.typeText("/docker");
		t.mockInput.pressEscape();
		await sleep(150);
		expect(await frame(t)).toContain("search every pack…");
		t.mockInput.pressEscape();
		await sleep(150);
		t.mockInput.pressEscape();
		await sleep(150);
		const screen = await frame(t);
		expect(screen).toContain("Press q to quit.");
		expect(t.renderer.isDestroyed).toBe(false);
	});
});

describe("actions", () => {
	test("copy on a command with placeholders opens the form and previews the result", async () => {
		const t = await mount();
		await t.mockInput.typeText("/kube logs");
		t.mockInput.pressEnter();
		await t.mockInput.typeText("c");
		expect(await frame(t)).toContain("Copy: fill in the blanks");
		await t.mockInput.typeText("web-1");
		expect(await frame(t)).toContain("$ kubectl logs web-1");
	});

	test("running a destructive command requires typing yes", async () => {
		const t = await mount();
		await t.mockInput.typeText("/delete pod");
		t.mockInput.pressEnter();
		await t.mockInput.typeText("r");
		await t.mockInput.typeText("api-0");
		t.mockInput.pressEnter();
		let screen = await frame(t);
		expect(screen).toContain("Destructive command");
		expect(screen).toContain("$ kubectl delete deploy api-0");
		t.mockInput.pressEnter();
		expect(await frame(t)).toContain('Type "yes" to confirm');
		t.mockInput.pressEscape();
		await sleep(150);
		screen = await frame(t);
		expect(screen).not.toContain("Destructive command");
		expect(screen).toContain("Cancelled.");
	});
});

describe("favorites and filters", () => {
	test("f stars the selection and it shows under Favorites", async () => {
		const t = await mount();
		await t.mockInput.typeText("/docker ps");
		t.mockInput.pressEnter();
		await t.mockInput.typeText("f");
		const screen = await frame(t);
		expect(screen).toContain("★ Added");
		expect(screen).toMatch(/★ Favorites\s+1/);
		expect(Bun.file(join(configHome, "sherpa", "state.json")).size).toBeGreaterThan(0);
	});

	test("favorites saved by an earlier session show up on start", async () => {
		const stateFile = join(configHome, "sherpa", "state.json");
		mkdirSync(join(configHome, "sherpa"), { recursive: true });
		writeFileSync(
			stateFile,
			JSON.stringify({ version: 1, favorites: ["linux/df-free-space"], recents: ["git/git-status-short"], values: {} }),
		);
		try {
			const t = await mount();
			const screen = await frame(t);
			expect(screen).toMatch(/★ Favorites\s+1/);
			expect(screen).toMatch(/⟲ Recent\s+1/);
		} finally {
			rmSync(stateFile);
		}
	});

	test("pack: limits the search to one pack", async () => {
		const t = await mount();
		await t.mockInput.typeText("/pack:podman list");
		const screen = await frame(t);
		expect(screen).toContain("in pack:podman");
		expect(screen).toContain("🦭");
		expect(screen).not.toContain("🐳 Containers");
	});
});

describe("user packs", () => {
	test("packs in ~/.config/sherpa/packs load under their scope", async () => {
		const dir = join(configHome, "sherpa", "packs", "commands", "community");
		mkdirSync(dir, { recursive: true });
		const file = join(dir, "local-demo.json");
		writeFileSync(
			file,
			JSON.stringify({
				pack: {
					id: "local-demo",
					name: "Demo Import",
					version: "1",
					description: "d",
					icon: "📘",
					author: "me",
					tags: ["demo"],
				},
				commands: [
					{
						id: "hello",
						name: "Say hello from an import",
						description: "d",
						command: "echo hello",
						use_case: "d",
						category: "Demo",
						tags: ["demo"],
						examples: [{ description: "d", command: "echo hello" }],
					},
				],
			}),
		);
		try {
			const t = await mount();
			await t.mockInput.typeText("/pack:demo");
			const screen = await frame(t);
			expect(screen).toContain("📘 Demo Import");
			expect(screen).toContain("Say hello from an import");
		} finally {
			rmSync(file);
		}
	});
});

describe("layout", () => {
	test("compact terminals show results and detail side by side", async () => {
		const t = await mount(80, 24);
		const screen = await frame(t);
		expect(screen).toContain("All commands");
		expect(screen).toContain("Detail");
		expect(screen).not.toContain("─ Packs ");
	});

	test("help opens as an overlay", async () => {
		const t = await mount();
		await t.mockInput.typeText("?");
		expect(await frame(t)).toContain("Keyboard shortcuts");
	});
});
