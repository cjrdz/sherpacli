import type { CliRenderer, KeyEvent } from "@opentui/core";
import type { Accessor } from "solid-js";
import { collectParams, resolveCommand } from "./core/placeholders";
import { copyToClipboard, formatPreviewOutput, runCommandPreview, runInteractive } from "./core/runner";
import type { AppState, CommandAction, PendingAction } from "./store/appState";
import type { DisplayItem } from "./types";

interface ActionDeps {
	state: AppState;
	renderer: CliRenderer;
	selectedItem: Accessor<DisplayItem | null>;
	selectedCommand: Accessor<string>;
	/** Remembered placeholder values, keyed by placeholder name. */
	rememberedValue?: (name: string) => string | undefined;
	onExecuted?: (pending: PendingAction, values: Record<string, string>) => void;
}

/**
 * Drives copy/preview/run through the steps a command may need:
 * pick a menu option → fill placeholders → confirm if risky → execute.
 */
export function createActions(deps: ActionDeps) {
	const { state, renderer } = deps;
	let lastValues: Record<string, string> = {};

	function start(action: CommandAction) {
		if (state.busy()) {
			state.notify("Still running the previous preview…", "warning");
			return;
		}
		const item = deps.selectedItem();
		if (!item) {
			state.notify("Select a command first.", "warning");
			return;
		}
		const pending: PendingAction = { action, item, command: deps.selectedCommand() };
		lastValues = {};
		if ((item.menu ?? []).length > 0) {
			state.setModal({ type: "menu", pending, index: 0 });
			return;
		}
		askParams(pending);
	}

	function askParams(pending: PendingAction) {
		const params = collectParams(pending.command, pending.item);
		if (params.length === 0) {
			confirm(pending);
			return;
		}
		const values: Record<string, string> = {};
		for (const param of params) {
			values[param.name] = deps.rememberedValue?.(param.name) ?? "";
		}
		state.setModal({ type: "params", pending, params, values, field: 0 });
	}

	function confirm(pending: PendingAction) {
		// Copying never executes anything; preview and run both execute for real.
		if (pending.action === "copy" || pending.item.dangerLevel === "safe") {
			state.setModal(null);
			void execute(pending);
			return;
		}
		state.setModal({ type: "confirm", pending, typed: "" });
	}

	async function execute(pending: PendingAction) {
		deps.onExecuted?.(pending, lastValues);
		const { command } = pending;
		if (pending.action === "copy") {
			const copied = await copyToClipboard(command, renderer);
			state.notify(
				copied ? `Copied: ${command}` : "No clipboard available. Install wl-copy, xclip, or xsel.",
				copied ? "success" : "error",
			);
			return;
		}

		if (pending.action === "preview") {
			state.setBusy(true);
			state.notify(`Previewing ${pending.item.name}…`, "info", 60_000);
			try {
				const result = await runCommandPreview(command);
				state.setCommandOutput({ text: formatPreviewOutput(result), result });
				state.setLastRun(result);
				state.notify(
					result.timedOut
						? "Preview stopped after 10s. Use r to run it interactively."
						: result.exitCode === 0
							? "Preview finished."
							: `Preview exited with ${result.exitCode}.`,
					result.exitCode === 0 && !result.timedOut ? "success" : "warning",
				);
			} catch (error) {
				state.notify(`Preview failed: ${(error as Error).message}`, "error");
			} finally {
				state.setBusy(false);
			}
			return;
		}

		try {
			const result = await runInteractive(renderer, command);
			state.setLastRun(result);
			state.notify(
				result.exitCode === 0 ? `Ran ${pending.item.name}.` : `${pending.item.name} exited with ${result.exitCode}.`,
				result.exitCode === 0 ? "success" : "warning",
			);
		} catch (error) {
			state.notify(`Run failed: ${(error as Error).message}`, "error");
		}
	}

	function handleModalKey(event: KeyEvent) {
		const modal = state.modal();
		if (!modal) {
			return;
		}
		const key = event.name;

		if (key === "escape") {
			state.setModal(null);
			state.notify("Cancelled.");
			return;
		}

		if (modal.type === "help") {
			if (key === "?" || event.sequence === "?" || key === "q" || key === "return") {
				state.setModal(null);
			}
			return;
		}

		if (modal.type === "menu") {
			const options = modal.pending.item.menu ?? [];
			if (key === "up" || key === "k" || key === "down" || key === "j") {
				const delta = key === "up" || key === "k" ? -1 : 1;
				state.setModal({ ...modal, index: (modal.index + delta + options.length) % options.length });
				return;
			}
			if (key === "return" || key === "enter") {
				const option = options[modal.index];
				if (option) {
					askParams({ ...modal.pending, command: option.command });
				}
			}
			return;
		}

		if (modal.type === "params") {
			const count = modal.params.length;
			if (key === "tab" || key === "down" || key === "up") {
				const delta = key === "up" || (key === "tab" && event.shift) ? -1 : 1;
				state.setModal({ ...modal, field: (modal.field + delta + count) % count });
				return;
			}
			if (key === "return" || key === "enter") {
				if (modal.field < count - 1) {
					state.setModal({ ...modal, field: modal.field + 1 });
					return;
				}
				const missing = modal.params.find(
					(param) => !(modal.values[param.name] ?? "").length && param.defaultValue === undefined,
				);
				if (missing) {
					state.setModal({ ...modal, field: modal.params.indexOf(missing) });
					state.notify(`"${missing.prompt}" is required.`, "warning");
					return;
				}
				lastValues = { ...modal.values };
				confirm({
					...modal.pending,
					command: resolveCommand(modal.pending.command, modal.pending.item, modal.values),
				});
			}
			return;
		}

		if (modal.type === "confirm") {
			if (modal.pending.item.dangerLevel === "destructive") {
				if (key === "return" || key === "enter") {
					if (modal.typed.trim().toLowerCase() === "yes") {
						state.setModal(null);
						void execute(modal.pending);
					} else {
						state.notify('Type "yes" to confirm, or Esc to cancel.', "warning");
					}
				}
				return;
			}
			if (key === "y") {
				state.setModal(null);
				void execute(modal.pending);
				return;
			}
			if (key === "n") {
				state.setModal(null);
				state.notify("Cancelled.");
			}
		}
	}

	function setParamValue(name: string, value: string) {
		const modal = state.modal();
		if (modal?.type === "params") {
			state.setModal({ ...modal, values: { ...modal.values, [name]: value } });
		}
	}

	function setConfirmTyped(value: string) {
		const modal = state.modal();
		if (modal?.type === "confirm") {
			state.setModal({ ...modal, typed: value });
		}
	}

	return { start, handleModalKey, setParamValue, setConfirmTyped };
}
