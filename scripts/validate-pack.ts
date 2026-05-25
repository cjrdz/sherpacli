import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const rootDir = resolve(import.meta.dir, "..");
const commandSchemaPath = join(rootDir, "schemas/command-pack.schema.json");
const scriptSchemaPath = join(rootDir, "schemas/script-pack.schema.json");
const packsDir = join(rootDir, "packs");

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });

async function loadSchema(schemaPath: string) {
	const schemaText = await readFile(schemaPath, "utf8");
	return JSON.parse(schemaText) as object;
}

async function main() {
	if (!existsSync(packsDir)) {
		console.log("No packs directory found. Nothing to validate.");
		return;
	}

	const commandSchema = await loadSchema(commandSchemaPath);
	const scriptSchema = await loadSchema(scriptSchemaPath);
	const validateCommandPack = ajv.compile(commandSchema);
	const validateScriptPack = ajv.compile(scriptSchema);

	const files: string[] = [];

	for await (const relativePath of new Bun.Glob("**/*.json").scan({
		cwd: packsDir,
	})) {
		files.push(relativePath);
	}

	if (files.length === 0) {
		console.log("No pack files found.");
		return;
	}

	let hasErrors = false;

	for (const relativePath of files) {
		const fullPath = join(packsDir, relativePath);
		const content = await readFile(fullPath, "utf8");
		const data = JSON.parse(content) as Record<string, unknown>;
		const result = Array.isArray(data.commands)
			? validateCommandPack(data)
			: validateScriptPack(data);

		if (!result) {
			hasErrors = true;
			console.error(`Validation failed for ${relativePath}`);
			console.error(
				ajv.errorsText(
					Array.isArray(data.commands)
						? validateCommandPack.errors
						: validateScriptPack.errors,
					{
						separator: "\n",
					},
				),
			);
		} else {
			console.log(`Validated ${relativePath}`);
		}
	}

	if (hasErrors) {
		process.exit(1);
	}
}

await main();
