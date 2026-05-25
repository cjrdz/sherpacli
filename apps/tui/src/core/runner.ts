export async function copyToClipboard(value: string): Promise<boolean> {
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

	try {
		const encoded = Buffer.from(value, "utf8").toString("base64");
		process.stdout.write(`\u001b]52;c;${encoded}\u0007`);
		return true;
	} catch {
		return false;
	}
}

export async function runCommandPreview(command: string): Promise<{
	exitCode: number;
	output: string;
}> {
	const processHandle = Bun.spawn({
		cmd: ["bash", "-lc", command],
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdoutText, stderrText] = await Promise.all([
		new Response(processHandle.stdout).text(),
		new Response(processHandle.stderr).text(),
	]);
	const exitCode = await processHandle.exited;
	const combined = [stdoutText.trim(), stderrText.trim()]
		.filter((chunk) => chunk.length > 0)
		.join("\n");

	return {
		exitCode,
		output: combined,
	};
}

export function formatPreviewOutput(output: string): string {
	if (output.length === 0) {
		return "(no output)";
	}

	const lines = output.split("\n");
	const isTruncated = lines.length > 8;
	const preview = lines.slice(0, 8).join("\n");
	return isTruncated ? `${preview}\n... (${lines.length - 8} more lines)` : preview;
}
