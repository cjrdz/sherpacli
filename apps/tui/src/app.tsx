import { createEffect, createMemo, createResource, createSignal, on, Show } from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useRenderer, useTerminalDimensions } from "@opentui/solid";
import { createActions } from "./actions";
import { DetailPanel } from "./components/DetailPanel";
import { ModalLayer } from "./components/Modals";
import { OutputPanel } from "./components/OutputPanel";
import { PacksPanel, type PackNavRow } from "./components/PacksPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { SearchBar } from "./components/SearchBar";
import { StatusBar } from "./components/StatusBar";
import { loadPacks } from "./core/packs";
import { itemKey, loadUserData, recordUse, saveUserData, toggleFavorite, type UserData } from "./core/userData";
import { useKeyMap, type KeyMode } from "./hooks/useKeyMap";
import { useSearch } from "./hooks/useSearch";
import { ALL_PACKS_ID, createAppState, FAVORITES_ID, RECENT_ID, type ActivePanel } from "./store/appState";
import { theme } from "./theme";
import type { DisplayItem, Pack, PackKind, PackScope } from "./types";

const KIND_ORDER: PackKind[] = ["scripts", "commands"];
const SCOPE_ORDER: PackScope[] = ["custom", "default", "community"];
const PANEL_ORDER: ActivePanel[] = ["packs", "results", "detail", "output"];
const COMPACT_WIDTH = 110;
const PAGE_SIZE = 10;
const PACK_FILTER = /(?:^|\s)pack:(\S+)/gi;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function toDisplayItems(packs: Pack[]): DisplayItem[] {
	return packs.flatMap((pack) =>
		pack.items.map((item) => ({
			...item,
			packId: pack.id,
			packName: pack.name,
			packIcon: pack.icon,
			kind: pack.kind,
			scope: pack.scope,
		})),
	);
}

export function App() {
	const renderer = useRenderer();
	const dimensions = useTerminalDimensions();
	const state = createAppState();
	const [packs] = createResource<Pack[]>(() => loadPacks());
	const [userData, setUserData] = createSignal<UserData>(loadUserData());

	function updateUserData(change: (data: UserData) => UserData) {
		const next = change(userData());
		setUserData(next);
		try {
			saveUserData(next);
		} catch (error) {
			state.notify(`Could not save ~/.config/sherpa/state.json: ${(error as Error).message}`, "error");
		}
	}

	const favoriteKeys = createMemo(() => new Set(userData().favorites));
	const isFavorite = (item: DisplayItem) => favoriteKeys().has(itemKey(item));
	let outputScroll: ScrollBoxRenderable | undefined;

	// ── Layout ────────────────────────────────────────────────────────────
	const isCompact = createMemo(() => dimensions().width < COMPACT_WIDTH);
	const packsWidth = createMemo(() => clamp(Math.floor(dimensions().width * 0.2), 26, 34));
	const detailWidth = createMemo(() =>
		isCompact() ? Math.floor(dimensions().width * 0.5) : clamp(Math.floor(dimensions().width * 0.4), 44, 80),
	);
	const outputHeight = createMemo(() => clamp(Math.floor(dimensions().height * 0.3), 6, 16));

	// ── Pack navigation ───────────────────────────────────────────────────
	const allItems = createMemo(() => toDisplayItems(packs() ?? []));
	const itemsByKey = createMemo(() => new Map(allItems().map((item) => [itemKey(item), item])));
	const pickByKeys = (keys: string[]) =>
		keys.map((key) => itemsByKey().get(key)).filter((item): item is DisplayItem => item !== undefined);
	const favoriteItems = createMemo(() => pickByKeys(userData().favorites));
	const recentItems = createMemo(() => pickByKeys(userData().recents));

	const packNavRows = createMemo<PackNavRow[]>(() => {
		const loaded = packs() ?? [];
		const rows: PackNavRow[] = [
			{ type: "all", count: allItems().length },
			{ type: "favorites", count: favoriteItems().length },
		];
		if (recentItems().length > 0) {
			rows.push({ type: "recent", count: recentItems().length });
		}
		for (const kind of KIND_ORDER) {
			const ofKind = loaded.filter((pack) => pack.kind === kind);
			if (ofKind.length === 0) {
				continue;
			}
			rows.push({ type: "kind", kind, count: ofKind.reduce((sum, pack) => sum + pack.items.length, 0) });
			if (state.collapsedKinds()[kind]) {
				continue;
			}
			for (const scope of SCOPE_ORDER) {
				const ofScope = ofKind.filter((pack) => pack.scope === scope);
				if (ofScope.length === 0) {
					continue;
				}
				rows.push({ type: "scope", kind, scope });
				for (const pack of ofScope) {
					rows.push({ type: "pack", kind, scope, pack });
				}
			}
		}
		return rows;
	});

	const selectedPack = createMemo(() => (packs() ?? []).find((pack) => pack.id === state.selectedPackId()) ?? null);

	// ── Results ───────────────────────────────────────────────────────────
	// `pack:docker` narrows a search to packs whose id or name starts with "docker".
	const packFilters = createMemo(() =>
		[...state.query().matchAll(PACK_FILTER)].map((match) => (match[1] ?? "").toLowerCase()),
	);
	const textQuery = createMemo(() => state.query().replace(PACK_FILTER, " ").trim());

	const candidateItems = createMemo(() => {
		const filters = packFilters();
		if (filters.length > 0) {
			return allItems().filter((item) =>
				filters.some(
					(filter) => item.packId.toLowerCase().startsWith(filter) || item.packName.toLowerCase().startsWith(filter),
				),
			);
		}
		// A query searches every pack; browsing stays inside the selected one.
		if (textQuery().length > 0) {
			return allItems();
		}
		switch (state.selectedPackId()) {
			case FAVORITES_ID:
				return favoriteItems();
			case RECENT_ID:
				return recentItems();
		}
		const pack = selectedPack();
		return pack ? allItems().filter((item) => item.packId === pack.id) : allItems();
	});

	const { filteredItems, query: debouncedQuery } = useSearch({ items: candidateItems, query: textQuery });

	const selectedIndex = createMemo(() => {
		const id = state.selectedItemId();
		const index = id ? filteredItems().findIndex((item) => item.id === id) : -1;
		return Math.max(index, 0);
	});

	const selectedItem = createMemo<DisplayItem | null>(() => filteredItems()[selectedIndex()] ?? null);

	createEffect(
		on(
			() => selectedItem()?.id,
			() => state.setSelectedExampleIndex(-1),
		),
	);

	const selectedCommand = createMemo(() => {
		const item = selectedItem();
		if (!item) {
			return "";
		}
		const example = item.examples[state.selectedExampleIndex()];
		return example?.command ?? item.executionCommand ?? item.command;
	});

	const resultsTitle = createMemo(() => {
		if (state.query().trim().length > 0) {
			return `Search · "${state.query().trim()}"`;
		}
		if (state.selectedPackId() === FAVORITES_ID) {
			return "★ Favorites";
		}
		if (state.selectedPackId() === RECENT_ID) {
			return "⟲ Recent";
		}
		const pack = selectedPack();
		return pack ? `${pack.icon} ${pack.name}` : "All commands";
	});

	// ── Actions ───────────────────────────────────────────────────────────
	const actions = createActions({
		state,
		renderer,
		selectedItem,
		selectedCommand,
		rememberedValue: (name) => userData().values[name],
		onExecuted: (pending, values) => updateUserData((data) => recordUse(data, itemKey(pending.item), values)),
	});

	function toggleSelectedFavorite() {
		const item = selectedItem();
		if (!item) {
			return;
		}
		const starred = !isFavorite(item);
		updateUserData((data) => toggleFavorite(data, itemKey(item)));
		state.notify(starred ? `★ Added ${item.name} to favorites.` : `Removed ${item.name} from favorites.`, "success");
	}

	function focusPanel(panel: ActivePanel) {
		state.setActivePanel(panel);
		state.setSearchFocused(false);
	}

	function selectPackRow(index: number) {
		const row = packNavRows()[index];
		if (row?.type === "all" || row?.type === "favorites" || row?.type === "recent") {
			state.setSelectedPackId(row.type === "all" ? ALL_PACKS_ID : row.type === "favorites" ? FAVORITES_ID : RECENT_ID);
			state.setSelectedItemId(null);
		} else if (row?.type === "pack") {
			state.setSelectedPackId(row.pack.id);
			state.setSelectedItemId(null);
		}
	}

	function movePackCursor(delta: number) {
		const rows = packNavRows();
		if (rows.length === 0) {
			return;
		}
		const next = clamp(state.packCursor() + delta, 0, rows.length - 1);
		state.setPackCursor(next);
		selectPackRow(next);
	}

	function moveResult(delta: number) {
		const items = filteredItems();
		if (items.length === 0) {
			return;
		}
		const next = clamp(selectedIndex() + delta, 0, items.length - 1);
		state.setSelectedItemId(items[next]?.id ?? null);
	}

	function moveExample(delta: number) {
		const total = selectedItem()?.examples.length ?? 0;
		if (total === 0) {
			return;
		}
		// Slot -1 is the primary command.
		state.setSelectedExampleIndex(clamp(state.selectedExampleIndex() + delta, -1, total - 1));
	}

	function toggleKind(kind: PackKind) {
		const collapsed = !state.collapsedKinds()[kind];
		state.setCollapsedKinds((current) => ({ ...current, [kind]: collapsed }));
	}

	function move(delta: number) {
		switch (state.activePanel()) {
			case "packs":
				movePackCursor(delta);
				return;
			case "results":
				moveResult(delta);
				return;
			case "detail":
				moveExample(delta);
				return;
			case "output":
				if (Number.isFinite(delta)) {
					outputScroll?.scrollBy(delta);
				} else {
					outputScroll?.scrollTo(delta < 0 ? 0 : Number.MAX_SAFE_INTEGER);
				}
				return;
		}
	}

	function cyclePanel(delta: number) {
		if (state.isFocusedDetail()) {
			state.setIsFocusedDetail(false);
		}
		const index = PANEL_ORDER.indexOf(state.activePanel());
		focusPanel(PANEL_ORDER[(index + delta + PANEL_ORDER.length) % PANEL_ORDER.length] ?? "results");
	}

	const keyMode = createMemo<KeyMode>(() => {
		if (state.modal()) {
			return "modal";
		}
		return state.searchFocused() ? "search" : "normal";
	});

	useKeyMap({
		mode: keyMode,
		activePanel: state.activePanel,
		onModalKey: actions.handleModalKey,
		onAction: actions.start,
		onToggleFavorite: toggleSelectedFavorite,
		onQuit: () => {
			renderer.destroy();
			process.exit(0);
		},
		onToggleHelp: () => state.setModal({ type: "help" }),
		onCyclePanel: cyclePanel,
		onMove: (delta) => {
			// While typing, arrows always drive the result list.
			if (state.searchFocused()) {
				moveResult(delta);
				return;
			}
			move(delta);
		},
		onPage: (direction) => {
			if (state.searchFocused() || state.activePanel() === "results") {
				moveResult(direction * PAGE_SIZE);
				return;
			}
			if (state.activePanel() === "output") {
				outputScroll?.scrollBy(direction * outputHeight());
				return;
			}
			move(direction * PAGE_SIZE);
		},
		onEdge: (edge) => move(edge === "start" ? -Infinity : Infinity),
		onEnter: () => {
			switch (state.activePanel()) {
				case "packs": {
					const row = packNavRows()[state.packCursor()];
					if (row?.type === "kind") {
						toggleKind(row.kind);
						return;
					}
					if (row?.type === "scope") {
						movePackCursor(1);
						return;
					}
					focusPanel("results");
					return;
				}
				case "results":
					if (selectedItem()) {
						state.setIsFocusedDetail(isCompact());
						focusPanel("detail");
					}
					return;
				default:
					actions.start("copy");
			}
		},
		onToggleGroup: () => {
			const row = packNavRows()[state.packCursor()];
			if (
				state.activePanel() === "packs" &&
				row &&
				(row.type === "kind" || row.type === "scope" || row.type === "pack")
			) {
				toggleKind(row.kind);
			}
		},
		onSearchFocus: () => {
			state.setSearchFocused(true);
			state.setIsFocusedDetail(false);
			state.setActivePanel("results");
		},
		onSearchSubmit: () => focusPanel("results"),
		onEscape: () => {
			if (state.searchFocused()) {
				if (state.query().length > 0) {
					state.setQuery("");
					state.setSelectedItemId(null);
				} else {
					state.setSearchFocused(false);
				}
				return;
			}
			if (state.isFocusedDetail()) {
				state.setIsFocusedDetail(false);
				focusPanel("results");
				return;
			}
			if (state.activePanel() !== "results") {
				focusPanel("results");
				return;
			}
			if (state.query().length > 0) {
				state.setQuery("");
				state.setSelectedItemId(null);
				state.notify("Search cleared.");
				return;
			}
			state.notify("Press q to quit.");
		},
	});

	// Keep the pack cursor in range when groups fold.
	createEffect(() => {
		const max = packNavRows().length - 1;
		if (state.packCursor() > max) {
			state.setPackCursor(Math.max(0, max));
		}
	});

	// ── Chrome ────────────────────────────────────────────────────────────
	const modeLabel = createMemo(() => {
		const modal = state.modal();
		if (modal) {
			return modal.type;
		}
		return state.searchFocused() ? "search" : state.activePanel();
	});

	const hints = createMemo(() => {
		const modal = state.modal();
		if (modal) {
			return modal.type === "help" ? "Esc close" : "Esc cancel";
		}
		if (state.searchFocused()) {
			return "type to filter · ↑↓ pick · Enter go to results · Esc clear";
		}
		switch (state.activePanel()) {
			case "packs":
				return "j/k move · Enter open · Space fold · / search · ? help · q quit";
			case "results":
				return "j/k move · Enter details · c copy · p preview · r run · / search · ? help";
			case "detail":
				return "j/k pick example · c copy · p preview · r run · Esc back";
			case "output":
				return "j/k scroll · PgUp/PgDn page · Tab panels · Esc back";
		}
	});

	const packCount = createMemo(() => (packs() ?? []).length);
	const showPacks = createMemo(() => !isCompact() || state.activePanel() === "packs");
	const showResults = createMemo(() => !isCompact() || state.activePanel() !== "packs");

	const detailColumn = (focused: boolean) => (
		<box
			flexDirection="column"
			gap={0}
			width={focused ? undefined : detailWidth()}
			flexGrow={focused ? 1 : 0}
			flexShrink={0}
		>
			<DetailPanel
				activePanel={state.activePanel}
				item={selectedItem}
				selectedCommand={selectedCommand}
				selectedExampleIndex={state.selectedExampleIndex}
			/>
			<OutputPanel
				activePanel={state.activePanel}
				output={state.commandOutput}
				busy={state.busy}
				height={outputHeight}
				ref={(el) => (outputScroll = el)}
			/>
		</box>
	);

	return (
		<box
			flexDirection="column"
			width={dimensions().width}
			height={dimensions().height}
			backgroundColor={theme.bg}
			paddingX={1}
		>
			<box flexDirection="row" height={1} gap={1} flexShrink={0}>
				<text fg={theme.brand}>
					<b>⛰ SherpaCLI</b>
				</text>
				<text fg={theme.textDim} flexGrow={1} wrapMode="none" truncate>
					{`${packCount()} packs · ${allItems().length} commands`}
				</text>
				<text fg={theme.textDim}>
					<span style={{ fg: theme.accent }}>?</span> help · <span style={{ fg: theme.accent }}>q</span> quit
				</text>
			</box>

			<SearchBar
				value={state.query}
				onInput={(value) => {
					state.setQuery(value);
					state.setSelectedItemId(null);
				}}
				isFocused={() => state.searchFocused() && !state.modal()}
				resultCount={() => filteredItems().length}
				scopeLabel={() => {
					if (packFilters().length > 0) {
						return `pack:${packFilters().join(",")}`;
					}
					if (debouncedQuery().length > 0 || state.selectedPackId() === ALL_PACKS_ID) {
						return "all packs";
					}
					return resultsTitle();
				}}
			/>

			<Show
				when={!state.isFocusedDetail()}
				fallback={
					<box flexDirection="row" flexGrow={1}>
						{detailColumn(true)}
					</box>
				}
			>
				<box flexDirection="row" flexGrow={1} gap={0}>
					<Show when={showPacks()}>
						<PacksPanel
							rows={packNavRows}
							cursorIndex={state.packCursor}
							selectedPackId={state.selectedPackId}
							collapsedKinds={state.collapsedKinds}
							activePanel={state.activePanel}
							width={() => (isCompact() ? undefined : packsWidth())}
						/>
					</Show>
					<Show when={showResults()}>
						<ResultsPanel
							activePanel={state.activePanel}
							items={filteredItems}
							selectedIndex={selectedIndex}
							title={resultsTitle}
							loading={() => packs.loading}
							error={() => packs.error}
							query={debouncedQuery}
							isFavorite={isFavorite}
						/>
					</Show>
					{detailColumn(false)}
				</box>
			</Show>

			<StatusBar mode={modeLabel} hints={hints} status={state.status} lastRun={state.lastRun} />

			<ModalLayer
				modal={state.modal}
				dimensions={dimensions}
				onParamInput={actions.setParamValue}
				onConfirmInput={actions.setConfirmTyped}
			/>
		</box>
	);
}
