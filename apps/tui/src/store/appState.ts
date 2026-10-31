import { createSignal } from "solid-js";
import type { RunResult } from "../core/runner";
import type { Placeholder } from "../core/placeholders";
import type { DisplayItem, PackKind } from "../types";

export type ActivePanel = "packs" | "results" | "detail" | "output";
export type CommandAction = "copy" | "preview" | "run";
export type StatusTone = "info" | "success" | "warning" | "error";

export const ALL_PACKS_ID = "__all__";
export const FAVORITES_ID = "__favorites__";
export const RECENT_ID = "__recent__";

/** A copy/preview/run request travelling through menu → params → confirm before it executes. */
export interface PendingAction {
	action: CommandAction;
	item: DisplayItem;
	command: string;
}

export type Modal =
	| { type: "help" }
	| { type: "menu"; pending: PendingAction; index: number }
	| {
			type: "params";
			pending: PendingAction;
			params: Placeholder[];
			values: Record<string, string>;
			field: number;
	  }
	| { type: "confirm"; pending: PendingAction; typed: string };

export interface CommandOutput {
	text: string;
	result: RunResult;
}

export function createAppState() {
	const [query, setQuery] = createSignal("");
	const [searchFocused, setSearchFocused] = createSignal(false);
	const [selectedPackId, setSelectedPackId] = createSignal<string>(ALL_PACKS_ID);
	const [packCursor, setPackCursor] = createSignal(0);
	const [collapsedKinds, setCollapsedKinds] = createSignal<Record<PackKind, boolean>>({
		scripts: false,
		commands: false,
	});
	const [selectedItemId, setSelectedItemId] = createSignal<string | null>(null);
	const [selectedExampleIndex, setSelectedExampleIndex] = createSignal(-1);
	const [activePanel, setActivePanel] = createSignal<ActivePanel>("results");
	const [isFocusedDetail, setIsFocusedDetail] = createSignal(false);
	const [modal, setModal] = createSignal<Modal | null>(null);
	const [status, setStatus] = createSignal<{ text: string; tone: StatusTone } | null>(null);
	const [commandOutput, setCommandOutput] = createSignal<CommandOutput | null>(null);
	const [lastRun, setLastRun] = createSignal<RunResult | null>(null);
	const [busy, setBusy] = createSignal(false);

	let statusTimer: ReturnType<typeof setTimeout> | undefined;
	function notify(text: string, tone: StatusTone = "info", ttlMs = 4000) {
		if (statusTimer) {
			clearTimeout(statusTimer);
		}
		setStatus({ text, tone });
		statusTimer = setTimeout(() => setStatus(null), ttlMs);
	}

	return {
		query,
		setQuery,
		searchFocused,
		setSearchFocused,
		selectedPackId,
		setSelectedPackId,
		packCursor,
		setPackCursor,
		collapsedKinds,
		setCollapsedKinds,
		selectedItemId,
		setSelectedItemId,
		selectedExampleIndex,
		setSelectedExampleIndex,
		activePanel,
		setActivePanel,
		isFocusedDetail,
		setIsFocusedDetail,
		modal,
		setModal,
		status,
		notify,
		commandOutput,
		setCommandOutput,
		lastRun,
		setLastRun,
		busy,
		setBusy,
	};
}

export type AppState = ReturnType<typeof createAppState>;
