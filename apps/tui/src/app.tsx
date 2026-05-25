import { createEffect, createMemo, createResource, onCleanup, Show } from "solid-js";
import { useRenderer, useTerminalDimensions } from "@opentui/solid";
import { loadPacks } from "./core/packs";
import { copyToClipboard, formatPreviewOutput, runCommandPreview } from "./core/runner";
import { SearchBar } from "./components/SearchBar";
import { PacksPanel, type PackNavRow } from "./components/PacksPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { DetailPanel } from "./components/DetailPanel";
import { OutputPanel } from "./components/OutputPanel";
import { HelpOverlay } from "./components/HelpOverlay";
import { StatusBar } from "./components/StatusBar";
import { createAppState } from "./store/appState";
import { useFocus } from "./hooks/useFocus";
import { useSearch } from "./hooks/useSearch";
import { useKeyMap } from "./hooks/useKeyMap";
import type { Pack, PackKind, PackScope } from "./types";

const KIND_ORDER: PackKind[] = ["scripts", "commands"];
const SCOPE_ORDER: PackScope[] = ["custom", "default", "community"];
const KIND_LABELS: Record<PackKind, string> = {
	commands: "Commands",
	scripts: "Scripts",
};
const SCOPE_LABELS: Record<PackScope, string> = {
	custom: "Custom",
	default: "Default",
	community: "Community",
};
const RESULTS_PAGE_SIZE = 10;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

type DisplayItem = ReturnType<typeof toDisplayItems>[number];

function toDisplayItems(loadedPacks: Pack[]) {
	return loadedPacks.flatMap((pack) =>
		pack.items.map((item) => ({
			...item,
			packId: pack.id,
			packName: pack.name,
			scope: pack.scope,
		})),
	);
}

export function App() {
	const renderer = useRenderer();
	const dimensions = useTerminalDimensions();
	const state = createAppState();
	const [packs] = createResource<Pack[]>(loadPacks);
	let copyFlashTimer: ReturnType<typeof setTimeout> | undefined;
	onCleanup(() => {
		if (copyFlashTimer) {
			clearTimeout(copyFlashTimer);
		}
	});

	const activePanel = createMemo(() => state.focusState().active);
	const isCompactLayout = createMemo(() => dimensions().width < 125);
	const packsPanelWidth = createMemo(() => {
		if (isCompactLayout()) {
			return clamp(Math.floor(dimensions().width * 0.34), 24, 32);
		}
		return clamp(Math.floor(dimensions().width * 0.22), 28, 34);
	});
	const detailPanelWidth = createMemo(() => {
		if (isCompactLayout()) {
			return undefined;
		}
		return clamp(Math.floor(dimensions().width * 0.31), 38, 52);
	});

	const groupedPacks = createMemo(() => {
		const loadedPacks = packs() ?? [];
		const groups: Record<PackKind, Record<PackScope, Pack[]>> = {
			scripts: { custom: [], default: [], community: [] },
			commands: { custom: [], default: [], community: [] },
		};
		for (const pack of loadedPacks) {
			groups[pack.kind][pack.scope].push(pack);
		}
		return groups;
	});

	const orderedPacks = createMemo(() => {
		const groups = groupedPacks();
		const next: Pack[] = [];
		for (const kind of KIND_ORDER) {
			for (const scope of SCOPE_ORDER) {
				next.push(...groups[kind][scope]);
			}
		}
		return next;
	});

	const packNavRows = createMemo<PackNavRow[]>(() => {
		const rows: PackNavRow[] = [];
		const groups = groupedPacks();
		const open = state.expandedKinds();
		for (const kind of KIND_ORDER) {
			rows.push({ type: "kind", kind });
			if (!open[kind]) {
				continue;
			}
			for (const scope of SCOPE_ORDER) {
				rows.push({ type: "scope", kind, scope });
				for (const pack of groups[kind][scope]) {
					rows.push({ type: "pack", kind, scope, pack });
				}
			}
		}
		return rows;
	});

	createEffect(() => {
		const available = orderedPacks();
		if (available.length === 0) {
			state.setSelectedPackId(null);
			return;
		}
		const current = state.selectedPackId();
		if (!current || !available.some((pack) => pack.id === current)) {
			state.setSelectedPackId(available[0]?.id ?? null);
		}
	});

	const selectedPack = createMemo(() => {
		return (packs() ?? []).find((pack) => pack.id === state.selectedPackId()) ?? null;
	});

	const candidateItems = createMemo<DisplayItem[]>(() => {
		const loadedPacks = packs() ?? [];
		const allItems = toDisplayItems(loadedPacks);
		if (state.query().trim().length > 0) {
			return allItems;
		}
		const selected = state.selectedPackId();
		if (!selected) {
			return allItems;
		}
		return allItems.filter((item) => item.packId === selected);
	});

	const { filteredItems } = useSearch({
		items: candidateItems,
		query: state.query,
		selectedItemId: state.selectedResultItemId,
		onStickySelection: (nextIndex) => {
			state.setSelectedResultIndex(nextIndex);
		},
	});

	createEffect(() => {
		const items = filteredItems();
		if (items.length === 0) {
			state.setSelectedResultIndex(0);
			state.setSelectedResultItemId(null);
			return;
		}
		const nextIndex = Math.max(0, Math.min(state.selectedResultIndex(), items.length - 1));
		state.setSelectedResultIndex(nextIndex);
		state.setSelectedResultItemId(items[nextIndex]?.id ?? null);
	});

	createEffect(() => {
		const rows = packNavRows();
		if (rows.length === 0) {
			state.setSelectedPackRowIndex(0);
			return;
		}
		const nextIndex = Math.max(0, Math.min(state.selectedPackRowIndex(), rows.length - 1));
		if (nextIndex !== state.selectedPackRowIndex()) {
			state.setSelectedPackRowIndex(nextIndex);
		}
	});

	const selectedItem = createMemo<DisplayItem | null>(() => {
		const fromFiltered = filteredItems()[state.selectedResultIndex()];
		if (fromFiltered) {
			return fromFiltered;
		}

		const pack = selectedPack();
		const fallback = pack?.items[0];
		if (!pack || !fallback) {
			return null;
		}

		return {
			...fallback,
			packId: pack.id,
			packName: pack.name,
			scope: pack.scope,
		};
	});

	createEffect(() => {
		selectedItem()?.id;
		state.setSelectedExampleIndex(-1);
		state.setCommandOutput("");
	});

	const visibleResults = createMemo(() => {
		const items = filteredItems();
		if (items.length <= RESULTS_PAGE_SIZE) {
			return { start: 0, items };
		}
		const currentIndex = state.selectedResultIndex();
		const half = Math.floor(RESULTS_PAGE_SIZE / 2);
		const maxStart = Math.max(0, items.length - RESULTS_PAGE_SIZE);
		const start = Math.max(0, Math.min(currentIndex - half, maxStart));
		return { start, items: items.slice(start, start + RESULTS_PAGE_SIZE) };
	});

	const selectedCommand = createMemo(() => {
		const item = selectedItem();
		if (!item) {
			return "";
		}
		const exampleIdx = state.selectedExampleIndex();
		if (exampleIdx >= 0 && exampleIdx < item.examples.length) {
			return item.examples[exampleIdx]?.command ?? item.command;
		}
		return item.command;
	});

	const selectedExecutionCommand = createMemo(() => {
		const item = selectedItem();
		if (!item) {
			return "";
		}
		const exampleIdx = state.selectedExampleIndex();
		if (exampleIdx >= 0 && exampleIdx < item.examples.length) {
			return item.examples[exampleIdx]?.command ?? item.executionCommand ?? item.command;
		}
		return item.executionCommand ?? item.command;
	});

	const selectedCommandSource = createMemo(() => {
		const item = selectedItem();
		if (!item) {
			return "";
		}
		const idx = state.selectedExampleIndex();
		if (idx >= 0 && idx < item.examples.length) {
			return `Example ${idx + 1}`;
		}
		return "Primary command";
	});

	const { setActivePanel, cyclePanel } = useFocus(
		state.focusState,
		state.setFocusState,
		state.setStatusMessage,
	);

	function movePack(delta: number) {
		const rows = packNavRows();
		if (rows.length === 0) {
			return;
		}
		const nextIndex = (state.selectedPackRowIndex() + delta + rows.length) % rows.length;
		state.setSelectedPackRowIndex(nextIndex);
		const row = rows[nextIndex];
		if (row?.type === "pack") {
			state.setSelectedPackId(row.pack.id);
			state.setSelectedResultIndex(0);
			state.setStatusMessage(`Selected pack: ${row.pack.name}`);
			return;
		}
		if (row?.type === "kind") {
			state.setStatusMessage(`Selected ${KIND_LABELS[row.kind]} category.`);
			return;
		}
		if (row?.type === "scope") {
			state.setStatusMessage(`Selected ${SCOPE_LABELS[row.scope]} scope.`);
		}
	}

	function toggleKind(kind: PackKind) {
		state.setExpandedKinds((current) => ({ ...current, [kind]: !current[kind] }));
		state.setStatusMessage(`${KIND_LABELS[kind]} ${state.expandedKinds()[kind] ? "collapsed" : "expanded"}.`);
	}

	function openPackRow() {
		const row = packNavRows()[state.selectedPackRowIndex()];
		if (!row) {
			return;
		}
		if (row.type === "kind") {
			toggleKind(row.kind);
			return;
		}
		if (row.type === "scope") {
			const firstPack = groupedPacks()[row.kind][row.scope][0];
			if (!firstPack) {
				state.setStatusMessage("No packs in this scope yet.");
				return;
			}
			state.setSelectedPackId(firstPack.id);
			state.setSelectedResultIndex(0);
			setActivePanel("results");
			state.setStatusMessage(`Opened results for ${firstPack.name}.`);
			return;
		}

		state.setSelectedPackId(row.pack.id);
		state.setSelectedResultIndex(0);
		setActivePanel("results");
		state.setStatusMessage(`Opened results for ${row.pack.name}.`);
	}

	function moveResult(delta: number) {
		const items = filteredItems();
		if (items.length === 0) {
			return;
		}
		const nextIndex = (state.selectedResultIndex() + delta + items.length) % items.length;
		state.setSelectedResultIndex(nextIndex);
		state.setSelectedResultItemId(items[nextIndex]?.id ?? null);
	}

	function moveExample(delta: number) {
		const item = selectedItem();
		if (!item || item.examples.length === 0) {
			state.setSelectedExampleIndex(-1);
			return;
		}
		const totalSlots = item.examples.length + 1;
		const currentSlot = state.selectedExampleIndex() + 1;
		const nextSlot = (currentSlot + delta + totalSlots) % totalSlots;
		state.setSelectedExampleIndex(nextSlot - 1);
	}

	async function copySelectedCommand() {
		try {
			const command = selectedExecutionCommand();
			if (command.length === 0) {
				state.setStatusMessage("Nothing to copy.");
				return;
			}
			const copied = await copyToClipboard(command);
			state.setStatusMessage(
				copied
					? `Copied ${selectedCommandSource().toLowerCase()} to clipboard.`
					: "Clipboard tool not found. Install wl-copy, xclip, or xsel.",
			);
			if (copied) {
				state.setCopyFlash(true);
				if (copyFlashTimer) {
					clearTimeout(copyFlashTimer);
				}
				copyFlashTimer = setTimeout(() => state.setCopyFlash(false), 1500);
			}
		} catch (error) {
			state.setStatusMessage(`Copy failed: ${(error as Error).message}`);
		}
	}

	async function runSelectedCommandPreview() {
		try {
			const command = selectedExecutionCommand();
			if (command.length === 0) {
				state.setStatusMessage("Nothing to run.");
				return;
			}
			state.setStatusMessage(`Preview running ${selectedCommandSource().toLowerCase()}...`);
			const { exitCode, output } = await runCommandPreview(command);
			state.setCommandOutput(formatPreviewOutput(output));
			state.setLastRun({ command, exitCode });
			state.setStatusMessage(exitCode === 0 ? "Preview run completed." : `Preview run failed with exit code ${exitCode}.`);
		} catch (error) {
			state.setCommandOutput("");
			state.setStatusMessage(`Preview failed: ${(error as Error).message}`);
		}
	}

	async function runSelectedCommandInteractive() {
		try {
			const command = selectedExecutionCommand();
			if (command.length === 0) {
				state.setStatusMessage("Nothing to run.");
				return;
			}
			renderer.destroy();
			console.log(`\n[Sherpa] Running interactive command:\n$ ${command}\n`);
			const processHandle = Bun.spawn({
				cmd: ["bash", "-lc", command],
				stdin: "inherit",
				stdout: "inherit",
				stderr: "inherit",
			});
			const exitCode = await processHandle.exited;
			process.exit(exitCode);
		} catch (error) {
			state.setStatusMessage(`Run failed: ${(error as Error).message}`);
		}
	}

	const shortcuts = createMemo(() => {
		if (state.isFocusedDetail()) {
			return "Tab switch panel • p preview • r run • c copy • Esc back";
		}
		if (activePanel() === "packs") {
			return "j/k move • Enter expand/open • Tab next panel • / search";
		}
		if (activePanel() === "results") {
			return "j/k move • Enter focus detail • Tab next panel • / search";
		}
		if (activePanel() === "output") {
			return "Tab switch panel • / search • ? help";
		}
		return "j/k examples • p preview • r run • c copy • / search";
	});

	const statusContext = createMemo(() => {
		const selected = selectedItem();
		const selectedName = selected?.name ?? "none";
		const run = state.lastRun();
		const runLabel = run ? `${run.exitCode === 0 ? "✓" : "✗"} ${run.command} exited ${run.exitCode}` : "no run yet";
		return `[${activePanel()}] / ${selectedName} • ${filteredItems().length} results • ${shortcuts()} • ${runLabel}`;
	});

	const { bindings } = useKeyMap({
		activePanel,
		isFocusedDetail: state.isFocusedDetail,
		showHelp: state.showHelp,
		toggleHelp: () => state.setShowHelp(!state.showHelp()),
		onExit: () => renderer.destroy(),
		onExitFocusedDetail: () => {
			state.setIsFocusedDetail(false);
			setActivePanel("results");
			state.setStatusMessage("Returned to split view.");
		},
		onCyclePanel: (delta) => {
			if (state.isFocusedDetail()) {
				state.setIsFocusedDetail(false);
				setActivePanel("results");
				state.setStatusMessage("Exited focused detail mode.");
				return;
			}
			cyclePanel(delta);
		},
		onMoveUp: () => {
			if (activePanel() === "packs") {
				movePack(-1);
				return;
			}
			if (activePanel() === "results") {
				moveResult(-1);
				return;
			}
			if (activePanel() === "detail" || activePanel() === "output") {
				moveExample(-1);
			}
		},
		onMoveDown: () => {
			if (activePanel() === "packs") {
				movePack(1);
				return;
			}
			if (activePanel() === "results") {
				moveResult(1);
				return;
			}
			if (activePanel() === "detail" || activePanel() === "output") {
				moveExample(1);
			}
		},
		onOpenCurrent: () => {
			if (activePanel() === "detail" || activePanel() === "output") {
				void copySelectedCommand();
				return;
			}
			if (activePanel() === "results") {
				state.setIsFocusedDetail(true);
				setActivePanel("detail");
				state.setStatusMessage("Opened focused detail mode.");
				return;
			}
			openPackRow();
		},
		onRunInteractive: () => {
			void runSelectedCommandInteractive();
		},
		onRunPreview: () => {
			void runSelectedCommandPreview();
		},
		onCopy: () => {
			void copySelectedCommand();
		},
		onSearchJump: () => {
			state.setSearchFocused(true);
			setActivePanel("results");
			state.setStatusMessage("Search focused. Type to filter results.");
		},
	});

	return (
		<box border padding={1} flexDirection="column" gap={1} width={dimensions().width} height={dimensions().height}>
			<box flexDirection="row" gap={1}>
				<text fg="#8BD5CA">SherpaCLI</text>
				<box flexGrow={1} />
				<text fg="#91D7E3">{shortcuts()}</text>
			</box>

			<SearchBar
				value={state.query}
				onInput={(value) => {
					state.setQuery(value);
					state.setSearchFocused(true);
				}}
				isFocused={state.searchFocused}
			/>

			<Show
				when={!state.isFocusedDetail()}
				fallback={
					<box flexDirection="column" gap={1} flexGrow={1}>
						<DetailPanel
							activePanel={activePanel}
							title="Detail (Focused)"
							item={selectedItem}
							selectedCommandSource={selectedCommandSource}
							selectedCommand={selectedCommand}
							selectedExecutionCommand={selectedExecutionCommand}
							selectedExampleIndex={state.selectedExampleIndex}
						/>
						<OutputPanel output={state.commandOutput} copyFlash={state.copyFlash} />
					</box>
				}
			>
				<box flexDirection="row" gap={1} flexGrow={1}>
					<PacksPanel
						rows={packNavRows}
						cursorIndex={state.selectedPackRowIndex}
						selectedPackId={state.selectedPackId}
						expandedKinds={state.expandedKinds}
						kindLabels={KIND_LABELS}
						scopeLabels={SCOPE_LABELS}
						activePanel={activePanel}
						width={packsPanelWidth}
					/>

					<Show when={!isCompactLayout() || activePanel() !== "detail"}>
						<ResultsPanel
							activePanel={activePanel}
							items={filteredItems}
							visible={visibleResults}
							selectedResultIndex={state.selectedResultIndex}
							loading={() => Boolean(packs.loading)}
							error={() => Boolean(packs.error)}
						/>
					</Show>

					<Show when={!isCompactLayout() || activePanel() === "detail" || activePanel() === "output"}>
						<box flexDirection="column" gap={1} width={detailPanelWidth()} flexGrow={isCompactLayout() ? 1 : 0}>
							<DetailPanel
								activePanel={activePanel}
								title="Detail"
								item={selectedItem}
								selectedCommandSource={selectedCommandSource}
								selectedCommand={selectedCommand}
								selectedExecutionCommand={selectedExecutionCommand}
								selectedExampleIndex={state.selectedExampleIndex}
							/>
							<OutputPanel output={state.commandOutput} copyFlash={state.copyFlash} />
						</box>
					</Show>
				</box>
			</Show>

			<HelpOverlay show={state.showHelp} bindings={() => bindings} />
			<StatusBar context={statusContext} message={state.statusMessage} />
		</box>
	);
}
