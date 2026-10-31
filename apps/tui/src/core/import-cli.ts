import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { parseCheatsheet } from "./cheatsheet-parser";
import { validateCommandPackData } from "./pack-validation";
import { userPacksDir } from "./userData";

const UPSTREAM_REPO = "Fechin/reference";
const UPSTREAM_RAW = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/main/source/_posts`;
const UPSTREAM_LIST = `https://api.github.com/repos/${UPSTREAM_REPO}/contents/source/_posts?per_page=1000`;
const UPSTREAM_LICENSE = "GPL-3.0";
const FETCH_TIMEOUT_MS = 15_000;
const SHEET_NAME = /^[a-z0-9][a-z0-9._-]*$/i;

function printHelp() {
	console.log(`Sherpa import

Import cheat sheets from quickref.me / cheatsheets.zip (github.com/${UPSTREAM_REPO})
as local command packs in ${join(userPacksDir(), "commands", "community")}.

Usage:
  sherpa import <sheet> [<sheet>...] [options]
  sherpa import --file <path.md> [options]
  sherpa import --list

Examples:
  sherpa import docker kubernetes git
  sherpa import --file ./my-notes.md

Options:
  --list         List the sheets available upstream
  --file <path>  Import a local markdown file in the same format
  --dry-run      Parse and validate without writing
  --force        Overwrite a pack that was already imported
  --help         Show this help

Imported content keeps its upstream license (${UPSTREAM_LICENSE}) and stays on
your machine; nothing is added to the Sherpa repository.
`);
}

interface ImportOptions {
	sheets: string[];
	files: string[];
	list: boolean;
	dryRun: boolean;
	force: boolean;
}

function parseArgs(argv: string[]): ImportOptions | "help" {
	const options: ImportOptions = { sheets: [], files: [], list: false, dryRun: false, force: false };
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index] ?? "";
		switch (arg) {
			case "--help":
			case "-h":
				return "help";
			case "--list":
				options.list = true;
				break;
			case "--dry-run":
				options.dryRun = true;
				break;
			case "--force":
				options.force = true;
				break;
			case "--file": {
				const path = argv[++index];
				if (!path) {
					throw new Error("--file needs a path");
				}
				options.files.push(path);
				break;
			}
			default:
				if (arg.startsWith("-")) {
					throw new Error(`Unknown option: ${arg}`);
				}
				options.sheets.push(arg.replace(/\.md$/i, ""));
		}
	}
	return options;
}

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		headers: { "user-agent": "sherpacli-import" },
	});
	if (!response.ok) {
		throw new Error(`${response.status} ${response.statusText} for ${url}`);
	}
	return response.text();
}

async function listSheets(): Promise<string[]> {
	const entries = JSON.parse(await fetchText(UPSTREAM_LIST)) as Array<{ name: string; type: string }>;
	return entries
		.filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
		.map((entry) => entry.name.replace(/\.md$/, ""))
		.sort();
}

async function importOne(
	sheet: string,
	markdown: string,
	sourceUrl: string,
	options: ImportOptions,
	upstream: boolean,
): Promise<boolean> {
	const pack = parseCheatsheet(markdown, {
		sheet,
		sourceUrl,
		author: upstream ? `${UPSTREAM_REPO} (quickref.me)` : "local import",
		license: upstream ? UPSTREAM_LICENSE : undefined,
		idPrefix: upstream ? "quickref" : "local",
	});
	if (pack.commands.length === 0) {
		console.error(`✗ ${sheet}: no shell commands found, nothing imported.`);
		return false;
	}

	const error = await validateCommandPackData(pack);
	if (error) {
		console.error(`✗ ${sheet}: generated pack failed validation:\n${error}`);
		return false;
	}

	const destination = join(userPacksDir(), "commands", "community", `${pack.pack.id}.json`);
	const counts = { safe: 0, caution: 0, destructive: 0 };
	for (const item of pack.commands) {
		counts[item.danger_level ?? "safe"] += 1;
	}
	const summary = `${pack.commands.length} commands (${counts.safe} safe, ${counts.caution} caution, ${counts.destructive} destructive)`;

	if (options.dryRun) {
		console.log(`• ${sheet}: ${summary} → would write ${destination}`);
		return true;
	}
	if (existsSync(destination) && !options.force) {
		console.error(`✗ ${sheet}: ${destination} already exists. Use --force to overwrite.`);
		return false;
	}
	mkdirSync(join(userPacksDir(), "commands", "community"), { recursive: true });
	writeFileSync(destination, `${JSON.stringify(pack, null, "\t")}\n`, "utf8");
	console.log(`✓ ${sheet}: ${summary} → ${destination}`);
	return true;
}

export async function runImportCommand(argv: string[]): Promise<number> {
	const options = parseArgs(argv);
	if (options === "help") {
		printHelp();
		return 0;
	}

	if (options.list) {
		const sheets = await listSheets();
		console.log(sheets.join("\n"));
		console.log(`\n${sheets.length} sheets. Import with: sherpa import <name>`);
		return 0;
	}

	if (options.sheets.length === 0 && options.files.length === 0) {
		printHelp();
		return 1;
	}

	let failures = 0;
	for (const sheet of options.sheets) {
		// The name becomes part of a URL and a file path, so keep it strict.
		if (!SHEET_NAME.test(sheet)) {
			console.error(`✗ ${sheet}: invalid sheet name.`);
			failures += 1;
			continue;
		}
		try {
			const markdown = await fetchText(`${UPSTREAM_RAW}/${sheet}.md`);
			const ok = await importOne(sheet.toLowerCase(), markdown, `https://quickref.me/${sheet}`, options, true);
			failures += ok ? 0 : 1;
		} catch (error) {
			const message = (error as Error).message;
			console.error(
				message.startsWith("404")
					? `✗ ${sheet}: not found upstream. Run \`sherpa import --list\` to see available sheets.`
					: `✗ ${sheet}: ${message}`,
			);
			failures += 1;
		}
	}

	for (const path of options.files) {
		try {
			const markdown = await readFile(path, "utf8");
			const sheet = basename(path, extname(path))
				.toLowerCase()
				.replace(/[^a-z0-9._-]+/g, "-");
			const ok = await importOne(sheet, markdown, path, options, false);
			failures += ok ? 0 : 1;
		} catch (error) {
			console.error(`✗ ${path}: ${(error as Error).message}`);
			failures += 1;
		}
	}

	if (!options.dryRun && failures < options.sheets.length + options.files.length) {
		console.log("\nRestart sherpa to see the new packs under Commands › community.");
	}
	return failures === 0 ? 0 : 1;
}
