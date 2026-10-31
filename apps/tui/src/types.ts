export type DangerLevel = "safe" | "caution" | "destructive";
export type PackKind = "commands" | "scripts";
export type PackScope = "custom" | "default" | "community";

export interface PackMetadata {
	id: string;
	name: string;
	version: string;
	description: string;
	icon: string;
	author: string;
	tags: string[];
	scope?: PackScope;
	/** Where the pack content came from (e.g. an imported cheat sheet URL). */
	source?: string;
	/** License of the pack content when it differs from the project (e.g. GPL-3.0 for imports). */
	license?: string;
}

export interface PackExample {
	description: string;
	command: string;
}

export interface RawCommandItem {
	id: string;
	name: string;
	description: string;
	command: string;
	use_case: string;
	category: string;
	tags: string[];
	examples: PackExample[];
	platform?: Array<"linux" | "macos" | "windows">;
	requires?: string[];
	see_also?: string[];
	danger_level?: DangerLevel;
}

export interface RawCommandPack {
	pack: PackMetadata;
	commands: RawCommandItem[];
}

export interface RawScriptArg {
	name: string;
	prompt: string;
	default?: string;
}

export interface RawScriptExecutionOption {
	label: string;
	command: string;
}

export interface RawScriptExecution {
	type: "inline" | "file" | "menu";
	shell?: string;
	command?: string;
	path?: string;
	options?: RawScriptExecutionOption[];
	args?: RawScriptArg[];
}

export interface RawScriptItem {
	id: string;
	name: string;
	description: string;
	icon?: string;
	category: string;
	tags: string[];
	requires?: string[];
	danger_level?: DangerLevel;
	execution: RawScriptExecution;
}

export interface RawScriptPack {
	pack: PackMetadata;
	scripts: RawScriptItem[];
}

export interface PackItem {
	id: string;
	name: string;
	description: string;
	command: string;
	executionCommand?: string;
	useCase: string;
	category: string;
	tags: string[];
	dangerLevel: DangerLevel;
	examples: PackExample[];
	requires?: string[];
	/** Values to prompt for before running (script `execution.args`). */
	args?: RawScriptArg[];
	/** Choices for `execution.type: "menu"` scripts. */
	menu?: RawScriptExecutionOption[];
	packId?: string;
	packName?: string;
}

export interface Pack {
	id: string;
	name: string;
	icon: string;
	description: string;
	kind: PackKind;
	scope: PackScope;
	source?: string;
	items: PackItem[];
}

/** A PackItem enriched with its owning pack, as shown in the UI. */
export interface DisplayItem extends PackItem {
	packId: string;
	packName: string;
	packIcon: string;
	kind: PackKind;
	scope: PackScope;
}
