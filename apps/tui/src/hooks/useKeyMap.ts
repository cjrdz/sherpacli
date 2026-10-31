import { useKeyboard } from "@opentui/solid";
import type { KeyEvent } from "@opentui/core";
import type { Accessor } from "solid-js";
import type { ActivePanel, CommandAction } from "../store/appState";

export interface KeyHelpEntry {
	keys: string;
	description: string;
}

export interface KeyHelpSection {
	title: string;
	entries: KeyHelpEntry[];
}

// Single source of truth for the help overlay and README.
export const KEY_HELP: KeyHelpSection[] = [
	{
		title: "Navigate",
		entries: [
			{ keys: "↑ ↓ / j k", description: "Move in the active panel" },
			{ keys: "PgUp PgDn / g G", description: "Jump a page / to start or end" },
			{ keys: "Tab / ← →", description: "Switch panel" },
			{ keys: "Enter", description: "Open pack · focus detail · copy" },
			{ keys: "Space", description: "Expand or collapse a pack group" },
			{ keys: "Esc", description: "Close · clear search · go back" },
		],
	},
	{
		title: "Search",
		entries: [
			{ keys: "/", description: "Focus search (searches every pack)" },
			{ keys: "pack:docker", description: "Limit a search to matching packs" },
			{ keys: "↑ ↓", description: "Move through results while typing" },
			{ keys: "Enter", description: "Jump to the results list" },
		],
	},
	{
		title: "Act on the selection",
		entries: [
			{ keys: "c", description: "Copy command (fills <placeholders> first)" },
			{ keys: "p", description: "Preview output (10s limit)" },
			{ keys: "r", description: "Run in the terminal, then return" },
			{ keys: "f", description: "Star / unstar as a favorite" },
		],
	},
	{
		title: "App",
		entries: [
			{ keys: "?", description: "Toggle this help" },
			{ keys: "q / Ctrl+C", description: "Quit" },
		],
	},
];

export type KeyMode = "modal" | "search" | "normal";

export interface KeyMapHandlers {
	mode: Accessor<KeyMode>;
	activePanel: Accessor<ActivePanel>;
	onModalKey: (event: KeyEvent) => void;
	onEscape: () => void;
	onQuit: () => void;
	onToggleHelp: () => void;
	onCyclePanel: (delta: number) => void;
	onMove: (delta: number) => void;
	onPage: (direction: number) => void;
	onEdge: (edge: "start" | "end") => void;
	onEnter: () => void;
	onToggleGroup: () => void;
	onSearchFocus: () => void;
	onSearchSubmit: () => void;
	onAction: (action: CommandAction) => void;
	onToggleFavorite: () => void;
}

const MODAL_RESERVED = new Set(["escape", "return", "enter", "tab"]);
const SEARCH_RESERVED = new Set([...MODAL_RESERVED, "up", "down", "pageup", "pagedown"]);

const ACTION_KEYS: Record<string, CommandAction> = { c: "copy", p: "preview", r: "run" };

/** Printable keys resolve to the typed character (so `?`, `/`, `G` work); control keys to their name. */
function keyOf(event: KeyEvent): string {
	const sequence = event.sequence;
	const printable = sequence?.length === 1 && sequence >= " " && sequence !== "\x7f";
	return printable && !event.ctrl && !event.meta ? sequence : event.name;
}

export function useKeyMap(handlers: KeyMapHandlers) {
	useKeyboard((event) => {
		const mode = handlers.mode();

		if (mode === "modal") {
			if (MODAL_RESERVED.has(event.name)) {
				event.preventDefault();
			}
			handlers.onModalKey(event);
			return;
		}

		if (mode === "search") {
			// Only navigation keys belong to the app; everything else goes to the input.
			if (SEARCH_RESERVED.has(event.name)) {
				event.preventDefault();
			}
			switch (event.name) {
				case "escape":
					handlers.onEscape();
					return;
				case "return":
				case "enter":
					handlers.onSearchSubmit();
					return;
				case "up":
					handlers.onMove(-1);
					return;
				case "down":
					handlers.onMove(1);
					return;
				case "pageup":
					handlers.onPage(-1);
					return;
				case "pagedown":
					handlers.onPage(1);
					return;
				case "tab":
					handlers.onSearchSubmit();
					return;
			}
			return;
		}

		// Nothing is typed outside search and modals, so the app owns every key here.
		// This also stops the `/` that focuses search from landing in the input.
		event.preventDefault();
		const key = keyOf(event);
		switch (key) {
			case "escape":
				handlers.onEscape();
				return;
			case "q":
				handlers.onQuit();
				return;
			case "?":
				handlers.onToggleHelp();
				return;
			case "/":
				handlers.onSearchFocus();
				return;
			case "tab":
				handlers.onCyclePanel(event.shift ? -1 : 1);
				return;
			case "left":
			case "h":
				handlers.onCyclePanel(-1);
				return;
			case "right":
			case "l":
				handlers.onCyclePanel(1);
				return;
			case "up":
			case "k":
				handlers.onMove(-1);
				return;
			case "down":
			case "j":
				handlers.onMove(1);
				return;
			case "pageup":
				handlers.onPage(-1);
				return;
			case "pagedown":
				handlers.onPage(1);
				return;
			case "home":
			case "g":
				handlers.onEdge("start");
				return;
			case "end":
			case "G":
				handlers.onEdge("end");
				return;
			case "return":
			case "enter":
				handlers.onEnter();
				return;
			case " ":
			case "space":
				handlers.onToggleGroup();
				return;
			case "f":
				handlers.onToggleFavorite();
				return;
		}

		const action = ACTION_KEYS[key];
		if (action && handlers.activePanel() !== "packs") {
			handlers.onAction(action);
		}
	});
}
