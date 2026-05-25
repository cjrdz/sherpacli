import { createSignal } from "solid-js";
import type { PackKind } from "../types";

export type ActivePanel = "packs" | "results" | "detail" | "output";
export type FocusState = { active: ActivePanel; history: ActivePanel[] };

export function createAppState() {
	const [query, setQuery] = createSignal("");
	const [selectedPackId, setSelectedPackId] = createSignal<string | null>(null);
	const [selectedResultIndex, setSelectedResultIndex] = createSignal(0);
	const [selectedResultItemId, setSelectedResultItemId] = createSignal<string | null>(null);
	const [selectedExampleIndex, setSelectedExampleIndex] = createSignal(-1);
	const [selectedPackRowIndex, setSelectedPackRowIndex] = createSignal(0);
	const [expandedKinds, setExpandedKinds] = createSignal<Record<PackKind, boolean>>({
		scripts: false,
		commands: false,
	});
	const [focusState, setFocusState] = createSignal<FocusState>({
		active: "results",
		history: ["results"],
	});
	const [isFocusedDetail, setIsFocusedDetail] = createSignal(false);
	const [searchFocused, setSearchFocused] = createSignal(false);
	const [statusMessage, setStatusMessage] = createSignal("Ready. Global search is active.");
	const [commandOutput, setCommandOutput] = createSignal("");
	const [showHelp, setShowHelp] = createSignal(false);
	const [copyFlash, setCopyFlash] = createSignal(false);
	const [lastRun, setLastRun] = createSignal<{ command: string; exitCode: number } | null>(null);

	return {
		query,
		setQuery,
		selectedPackId,
		setSelectedPackId,
		selectedResultIndex,
		setSelectedResultIndex,
		selectedResultItemId,
		setSelectedResultItemId,
		selectedExampleIndex,
		setSelectedExampleIndex,
		selectedPackRowIndex,
		setSelectedPackRowIndex,
		expandedKinds,
		setExpandedKinds,
		focusState,
		setFocusState,
		isFocusedDetail,
		setIsFocusedDetail,
		searchFocused,
		setSearchFocused,
		statusMessage,
		setStatusMessage,
		commandOutput,
		setCommandOutput,
		showHelp,
		setShowHelp,
		copyFlash,
		setCopyFlash,
		lastRun,
		setLastRun,
	};
}

export type AppState = ReturnType<typeof createAppState>;
