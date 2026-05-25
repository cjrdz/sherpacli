import type { Accessor } from "solid-js";
import type { ActivePanel, FocusState } from "../store/appState";

const PANEL_ORDER: ActivePanel[] = ["packs", "results", "detail", "output"];

export function useFocus(
	focusState: Accessor<FocusState>,
	setFocusState: (value: FocusState) => void,
	setStatusMessage: (value: string) => void,
) {
	function setActivePanel(panel: ActivePanel) {
		const current = focusState();
		setFocusState({
			active: panel,
			history: [...current.history, panel].slice(-12),
		});
	}

	function cyclePanel(delta: number) {
		const current = focusState().active;
		const index = PANEL_ORDER.findIndex((panel) => panel === current);
		const next = PANEL_ORDER[(index + delta + PANEL_ORDER.length) % PANEL_ORDER.length] ?? "results";
		setActivePanel(next);
		setStatusMessage(`Active panel: ${next}`);
	}

	return {
		panelOrder: PANEL_ORDER,
		setActivePanel,
		cyclePanel,
	};
}
