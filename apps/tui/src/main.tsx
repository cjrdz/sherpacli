import "@opentui/solid/runtime-plugin-support";

import { render } from "@opentui/solid";
import { App } from "./app";
import packageJson from "../package.json";
import { runImportCommand } from "./core/import-cli";
import { runMigrateCommand } from "./core/migrate-cli";

if (process.env.SHERPA_CWD) {
	try {
		process.chdir(process.env.SHERPA_CWD);
	} catch {
		// Launch directory vanished; stay where we are.
	}
}

const argv = Bun.argv.slice(2);
const subcommand = argv[0];

const subcommands: Record<string, (args: string[]) => Promise<number>> = {
	import: runImportCommand,
	migrate: runMigrateCommand,
};

if (subcommand === "--version" || subcommand === "-v") {
	console.log(`sherpa ${packageJson.version}`);
	process.exit(0);
}

if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
	console.log(`SherpaCLI: terminal command and script assistant

Usage:
  sherpa                     Open the TUI
  sherpa import <sheet>...   Import quickref.me cheat sheets as local packs
  sherpa migrate [options]   Move flat packs into scoped folders
  sherpa --version           Print the version

Run \`sherpa <command> --help\` for details. In the TUI, press ? for keys.`);
	process.exit(0);
}

const run = subcommand ? subcommands[subcommand] : undefined;
if (run) {
	try {
		process.exit(await run(argv.slice(1)));
	} catch (error) {
		console.error(`Error: ${(error as Error).message}`);
		process.exit(1);
	}
}

render(App, {
	exitOnCtrlC: true,
	targetFps: 30,
	maxFps: 60,
});
