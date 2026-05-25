import "@opentui/solid/runtime-plugin-support";

import { render } from "@opentui/solid";
import { App } from "./app";
import { runMigrateCommand } from "./core/migrate-cli";

const argv = Bun.argv.slice(2);
const subcommand = argv[0];

if (subcommand === "migrate") {
	try {
		const exitCode = await runMigrateCommand(argv.slice(1));
		process.exit(exitCode);
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
