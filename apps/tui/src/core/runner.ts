import type { CliRenderer } from "@opentui/core";

export interface RunResult {
	command: string;
	exitCode: number;
	durationMs: number;
	timedOut?: boolean;
}

export async function copyToClipboard(value: string, renderer?: CliRenderer): Promise<boolean> {
	const candidates = [
		["wl-copy"],
		["xclip", "-selection", "clipboard"],
		["xsel", "--clipboard", "--input"],
		["pbcopy"],
		["clip.exe"],
	];

	for (const command of candidates) {
		const executable = command[0];
		if (!executable || !Bun.which(executable)) {
			continue;
		}

		const result = Bun.spawnSync(command, {
			stdin: Buffer.from(value, "utf8"),
			stdout: "ignore",
			stderr: "ignore",
		});

		if (result.exitCode === 0) {
			return true;
		}
	}

	// Fall back to OSC 52 so copying works over SSH and in terminals without a clipboard tool.
	return renderer?.copyToClipboardOSC52(value) ?? false;
}

export const PREVIEW_TIMEOUT_MS = 10_000;

export async function runCommandPreview(
	command: string,
	timeoutMs = PREVIEW_TIMEOUT_MS,
): Promise<RunResult & { output: string }> {
	const started = performance.now();
	const processHandle = Bun.spawn({
		cmd: ["bash", "-lc", command],
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});

	// Streaming commands (`logs -f`, `watch`, `top`) never exit on their own.
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		processHandle.kill();
	}, timeoutMs);

	const [stdoutText, stderrText] = await Promise.all([
		new Response(processHandle.stdout).text(),
		new Response(processHandle.stderr).text(),
	]);
	const exitCode = await processHandle.exited;
	clearTimeout(timer);

	const output = [stdoutText.trimEnd(), stderrText.trimEnd()].filter((chunk) => chunk.length > 0).join("\n");

	return {
		command,
		exitCode,
		output,
		timedOut,
		durationMs: performance.now() - started,
	};
}

export function formatPreviewOutput(result: { output: string; timedOut?: boolean }): string {
	const body = result.output.length === 0 ? "(no output)" : result.output;
	return result.timedOut
		? `${body}\n… stopped after ${PREVIEW_TIMEOUT_MS / 1000}s. Use [r] to run it interactively.`
		: body;
}

export function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}
	if (ms < 60_000) {
		return `${(ms / 1000).toFixed(1)}s`;
	}
	return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
}

function waitForKeypress(): Promise<void> {
	const stdin = process.stdin;
	return new Promise((resolve) => {
		const wasRaw = stdin.isRaw;
		if (stdin.isTTY) {
			stdin.setRawMode(true);
		}
		stdin.resume();
		stdin.once("data", () => {
			if (stdin.isTTY) {
				stdin.setRawMode(wasRaw);
			}
			stdin.pause();
			resolve();
		});
	});
}

/**
 * Hands the terminal to `command`, then returns to the TUI once the user presses a key.
 */
export async function runInteractive(renderer: CliRenderer, command: string): Promise<RunResult> {
	await renderer.suspend();
	// Ctrl+C should stop the child, not Sherpa.
	const ignoreSigint = () => {};
	process.on("SIGINT", ignoreSigint);

	process.stdout.write(`\n\x1b[36m[sherpa]\x1b[0m \x1b[2m$\x1b[0m ${command}\n\n`);
	const started = performance.now();
	let exitCode = 1;
	try {
		const processHandle = Bun.spawn({
			cmd: ["bash", "-lc", command],
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
		});
		exitCode = await processHandle.exited;
	} catch (error) {
		process.stdout.write(`\n\x1b[31m[sherpa] failed to start: ${(error as Error).message}\x1b[0m\n`);
	}
	const durationMs = performance.now() - started;

	const status = exitCode === 0 ? "\x1b[32m✓ exit 0\x1b[0m" : `\x1b[31m✗ exit ${exitCode}\x1b[0m`;
	process.stdout.write(
		`\n\x1b[36m[sherpa]\x1b[0m ${status} in ${formatDuration(durationMs)} \x1b[2m— press any key to return\x1b[0m`,
	);
	await waitForKeypress();
	process.off("SIGINT", ignoreSigint);
	await renderer.resume();

	return { command, exitCode, durationMs };
}
