import {
	executeMigration,
	type MigrateFrom,
	type MigrateOptions,
	type MigrateReport,
	type MigrateTarget,
	type MigrateTo,
} from "./migrate";

function printHelp() {
	console.log(`Sherpa migrate

Usage:
  sherpa migrate [commands|scripts|all] [options]

Options:
  --target <commands|scripts|all>  Select migration target (default: all)
  --from <flat|scoped|auto>        Source layout selector (default: auto)
  --to <scoped>                    Destination layout (default: scoped)
  --apply                          Write file changes (default is dry-run)
  --dry-run                        Force dry-run mode
  --force                          Overwrite destination files when they already exist
  --json                           Print machine-readable JSON report
  --help                           Show this help
`);
}

function parseEnum<T extends string>(
	value: string,
	valid: readonly T[],
	name: string,
): T {
	if (!valid.includes(value as T)) {
		throw new Error(`Invalid ${name}: ${value}`);
	}
	return value as T;
}

function formatHuman(report: MigrateReport): string {
	const lines: string[] = [];
	lines.push(`Mode: ${report.applied ? "apply" : "dry-run"}`);
	lines.push(`Packs: ${report.packsDir}`);
	lines.push(
		`Summary: total=${report.summary.total} moved=${report.summary.moved} unchanged=${report.summary.unchanged} skipped=${report.summary.skipped} conflicts=${report.summary.conflicts}`,
	);

	if (report.items.length > 0) {
		lines.push("\nPlanned actions:");
		for (const item of report.items) {
			if (item.action === "move") {
				lines.push(`- MOVE ${item.source} -> ${item.destination}`);
				continue;
			}
			if (item.action === "unchanged") {
				lines.push(`- KEEP ${item.source}`);
				continue;
			}
			lines.push(`- SKIP ${item.source} (${item.reason ?? "unknown"})`);
		}
	}

	if (report.conflicts.length > 0) {
		lines.push("\nConflicts:");
		for (const conflict of report.conflicts) {
			lines.push(
				`- ${conflict.source} -> ${conflict.destination} (${conflict.reason})`,
			);
		}
	}

	if (report.validation) {
		lines.push(
			`\nValidation: ${report.validation.ok ? "ok" : "failed"} (${report.validation.totalFiles} files)`,
		);
		for (const error of report.validation.errors) {
			lines.push(`- ${error.file}: ${error.error}`);
		}
	}

	return lines.join("\n");
}

export async function runMigrateCommand(args: string[]): Promise<number> {
	if (args.includes("--help")) {
		printHelp();
		return 0;
	}

	const options: MigrateOptions = {
		target: "all",
		from: "auto",
		to: "scoped",
		apply: false,
		force: false,
	};
	let json = false;

	for (let i = 0; i < args.length; i += 1) {
		const token = args[i];
		if (!token) {
			continue;
		}

		if (["commands", "scripts", "all"].includes(token)) {
			options.target = parseEnum(token, ["commands", "scripts", "all"], "target");
			continue;
		}

		if (token === "--apply") {
			options.apply = true;
			continue;
		}

		if (token === "--dry-run") {
			options.apply = false;
			continue;
		}

		if (token === "--force") {
			options.force = true;
			continue;
		}

		if (token === "--json") {
			json = true;
			continue;
		}

		if (token === "--target" || token.startsWith("--target=")) {
			const raw = token.includes("=") ? token.split("=")[1] : args[i + 1];
			if (!raw) {
				throw new Error("Missing value for --target");
			}
			if (!token.includes("=")) {
				i += 1;
			}
			options.target = parseEnum(raw, ["commands", "scripts", "all"], "target");
			continue;
		}

		if (token === "--from" || token.startsWith("--from=")) {
			const raw = token.includes("=") ? token.split("=")[1] : args[i + 1];
			if (!raw) {
				throw new Error("Missing value for --from");
			}
			if (!token.includes("=")) {
				i += 1;
			}
			options.from = parseEnum(raw, ["flat", "scoped", "auto"], "from") as MigrateFrom;
			continue;
		}

		if (token === "--to" || token.startsWith("--to=")) {
			const raw = token.includes("=") ? token.split("=")[1] : args[i + 1];
			if (!raw) {
				throw new Error("Missing value for --to");
			}
			if (!token.includes("=")) {
				i += 1;
			}
			options.to = parseEnum(raw, ["scoped"], "to") as MigrateTo;
			continue;
		}

		if (token.startsWith("-")) {
			throw new Error(`Unknown option: ${token}`);
		}

		throw new Error(`Unknown argument: ${token}`);
	}

	const report = await executeMigration(options);
	if (json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(formatHuman(report));
	}

	if (options.apply && report.conflicts.length > 0 && !options.force) {
		return 1;
	}
	if (options.apply && report.validation && !report.validation.ok) {
		return 1;
	}

	return 0;
}
