import { useKeyboard } from "@opentui/solid";
import type { Accessor } from "solid-js";
import type { ActivePanel } from "../store/appState";

export interface KeyBinding {
	key: string;
	description: string;
	panels: Array<ActivePanel | "global">;
}

interface UseKeyMapArgs {
	activePanel: Accessor<ActivePanel>;
	isFocusedDetail: Accessor<boolean>;
	showHelp: Accessor<boolean>;
	toggleHelp: () => void;
	onExit: () => void;
	onExitFocusedDetail: () => void;
	onCyclePanel: (delta: number) => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onOpenCurrent: () => void;
	onRunInteractive: () => void;
	onRunPreview: () => void;
	onCopy: () => void;
	onSearchJump: () => void;
}

const HELP_BINDINGS: KeyBinding[] = [
	{ key: "Tab", description: "Switch panel", panels: ["global"] },
	{ key: "Arrows", description: "Move in active panel", panels: ["global"] },
	{ key: "j / k", description: "Vim-style navigation", panels: ["global"] },
	{ key: "/", description: "Jump to search", panels: ["global"] },
	{ key: "Enter", description: "Open/expand/copy based on panel", panels: ["global"] },
	{ key: "p", description: "Preview run in detail", panels: ["detail"] },
	{ key: "r", description: "Run command in detail", panels: ["detail"] },
	{ key: "c", description: "Copy selected command", panels: ["detail"] },
	{ key: "?", description: "Toggle help", panels: ["global"] },
	{ key: "Esc", description: "Back or exit", panels: ["global"] },
];

export function useKeyMap(args: UseKeyMapArgs) {
	useKeyboard((event) => {
		const sequence = (event as { sequence?: string }).sequence;
		const keyName = event.name;

		if (keyName === "escape") {
			if (args.showHelp()) {
				args.toggleHelp();
				return;
			}
			if (args.isFocusedDetail()) {
				args.onExitFocusedDetail();
				return;
			}
			args.onExit();
			return;
		}

		if (keyName === "backspace" && args.isFocusedDetail()) {
			args.onExitFocusedDetail();
			return;
		}

		if (keyName === "tab") {
			args.onCyclePanel(1);
			return;
		}

		if (keyName === "left") {
			args.onCyclePanel(-1);
			return;
		}

		if (keyName === "right") {
			args.onCyclePanel(1);
			return;
		}

		if (keyName === "up" || keyName === "k") {
			args.onMoveUp();
			return;
		}

		if (keyName === "down" || keyName === "j") {
			args.onMoveDown();
			return;
		}

		if (keyName === "return") {
			args.onOpenCurrent();
			return;
		}

		if (keyName === "r" && args.activePanel() === "detail") {
			args.onRunInteractive();
			return;
		}

		if (keyName === "p" && args.activePanel() === "detail") {
			args.onRunPreview();
			return;
		}

		if (keyName === "c" && args.activePanel() === "detail") {
			args.onCopy();
			return;
		}

		if (keyName === "?" || sequence === "?") {
			args.toggleHelp();
			return;
		}

		if (keyName === "/" || sequence === "/") {
			args.onSearchJump();
			return;
		}
	});

	return { bindings: HELP_BINDINGS };
}
