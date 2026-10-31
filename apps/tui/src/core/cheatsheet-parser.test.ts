import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyDanger, normalizePlaceholders, parseCheatsheet } from "./cheatsheet-parser";

const markdown = readFileSync(join(import.meta.dir, "__fixtures__/sample-sheet.md"), "utf8");
const pack = parseCheatsheet(markdown, {
	sheet: "sample",
	sourceUrl: "https://quickref.me/sample",
	license: "GPL-3.0",
});
const byCommand = new Map(pack.commands.map((item) => [item.command, item]));

describe("parseCheatsheet", () => {
	test("reads pack metadata from front matter", () => {
		expect(pack.pack).toMatchObject({
			id: "quickref-sample",
			name: "Sample",
			description: "A tiny sample sheet.",
			scope: "community",
			source: "https://quickref.me/sample",
			license: "GPL-3.0",
			tags: ["sample", "container"],
		});
	});

	test("extracts exactly the runnable commands, in order", () => {
		expect(pack.commands.map((item) => item.command)).toEqual([
			"sample run -d -p 80:80 nginx",
			"sample ps -a",
			"sample logs <name>",
			"sample rm my-app",
			"sample system prune -a",
			"sample rmi -f $(sample images -q)",
			"sample get po -o wide",
			'echo "$NAME"',
			"sample inspect --format '{{.Name}}' my-app",
		]);
	});

	test("pairs descriptions from prose, tables, and comments", () => {
		expect(byCommand.get("sample run -d -p 80:80 nginx")?.description).toBe("Start a container in the background");
		expect(byCommand.get("sample ps -a")?.description).toBe("List all containers");
		expect(byCommand.get("sample logs <name>")?.description).toBe("Show logs (follow with -f)");
		expect(byCommand.get("sample rm my-app")?.description).toBe("Remove a container");
		expect(byCommand.get("sample system prune -a")?.description).toBe("Remove everything unused");
		expect(byCommand.get("sample rmi -f $(sample images -q)")?.description).toBe("Delete all images");
		expect(byCommand.get("sample get po -o wide")?.description).toBe("Comment that follows its command");
		expect(byCommand.get('echo "$NAME"')?.description).toBe('Cleanup: echo "$NAME"');
	});

	test("uses the nearest heading as category and fills required fields", () => {
		const item = byCommand.get("sample system prune -a");
		expect(item?.category).toBe("Cleanup");
		expect(item?.examples).toEqual([{ description: "Remove everything unused", command: "sample system prune -a" }]);
		expect(item?.id).toMatch(/^sample-system-prune-a-[0-9a-f]{1,6}$/);
	});

	test("flags risky commands", () => {
		expect(byCommand.get("sample system prune -a")?.danger_level).toBe("destructive");
		expect(byCommand.get("sample rmi -f $(sample images -q)")?.danger_level).toBe("destructive");
		expect(byCommand.get("sample rm my-app")?.danger_level).toBe("caution");
		expect(byCommand.get("sample ps -a")?.danger_level).toBe("safe");
	});
});

test("normalizePlaceholders converts [name] but leaves jsonpath and tests alone", () => {
	expect(normalizePlaceholders("kubectl top node [node_name]")).toBe("kubectl top node <node_name>");
	expect(normalizePlaceholders("kubectl get no -o jsonpath='{.items[*].name}'")).toBe(
		"kubectl get no -o jsonpath='{.items[*].name}'",
	);
	expect(normalizePlaceholders("[[ -e file ]] && echo ok")).toBe("[[ -e file ]] && echo ok");
});

test("classifyDanger", () => {
	expect(classifyDanger("git reset --hard HEAD~1")).toBe("destructive");
	expect(classifyDanger("git push origin main -f")).toBe("destructive");
	expect(classifyDanger("sudo systemctl restart nginx")).toBe("caution");
	expect(classifyDanger("ls -la")).toBe("safe");
});
