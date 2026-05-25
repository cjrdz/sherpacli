import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

export interface ValidationError {
	file: string;
	error: string;
}

export interface ValidationReport {
	ok: boolean;
	totalFiles: number;
	errors: ValidationError[];
}

async function loadSchema(schemaPath: string) {
	const schemaText = await readFile(schemaPath, "utf8");
	return JSON.parse(schemaText) as object;
}

export async function validatePackDirectory(packsDir: string): Promise<ValidationReport> {
	const rootDir = resolve(packsDir, "..");
	const commandSchemaPath = join(rootDir, "schemas/command-pack.schema.json");
	const scriptSchemaPath = join(rootDir, "schemas/script-pack.schema.json");

	const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
	const commandSchema = await loadSchema(commandSchemaPath);
	const scriptSchema = await loadSchema(scriptSchemaPath);
	const validateCommandPack = ajv.compile(commandSchema);
	const validateScriptPack = ajv.compile(scriptSchema);

	const files: string[] = [];
	for await (const relativePath of new Bun.Glob("**/*.json").scan({ cwd: packsDir })) {
		files.push(relativePath);
	}

	const errors: ValidationError[] = [];
	for (const relativePath of files) {
		const content = await readFile(join(packsDir, relativePath), "utf8");
		const data = JSON.parse(content) as Record<string, unknown>;
		const isCommandPack = Array.isArray(data.commands);
		const ok = isCommandPack ? validateCommandPack(data) : validateScriptPack(data);

		if (!ok) {
			errors.push({
				file: relativePath,
				error: ajv.errorsText(
					isCommandPack ? validateCommandPack.errors : validateScriptPack.errors,
					{ separator: "\n" },
				),
			});
		}
	}

	return {
		ok: errors.length === 0,
		totalFiles: files.length,
		errors,
	};
}
