import { Show } from "solid-js";
import type { Accessor } from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import { formatDuration } from "../core/runner";
import type { ActivePanel, CommandOutput } from "../store/appState";
import { panelBorder, theme } from "../theme";

interface OutputPanelProps {
	activePanel: Accessor<ActivePanel>;
	output: Accessor<CommandOutput | null>;
	busy: Accessor<boolean>;
	height: Accessor<number | undefined>;
	ref?: (el: ScrollBoxRenderable) => void;
}

export function OutputPanel(props: OutputPanelProps) {
	const isActive = () => props.activePanel() === "output";
	const summary = () => {
		const output = props.output();
		if (props.busy()) {
			return " running… ";
		}
		if (!output) {
			return "";
		}
		const { exitCode, durationMs } = output.result;
		return ` ${exitCode === 0 ? "✓" : "✗"} exit ${exitCode} · ${formatDuration(durationMs)} `;
	};

	return (
		<box
			border
			borderStyle="rounded"
			borderColor={panelBorder(isActive())}
			title=" Output "
			titleAlignment="left"
			bottomTitle={summary()}
			bottomTitleAlignment="right"
			flexDirection="column"
			height={props.height()}
			flexGrow={props.height() === undefined ? 1 : 0}
			flexShrink={0}
		>
			<Show
				when={props.output()}
				fallback={
					<box paddingX={1}>
						<text fg={theme.textDim}>
							<span style={{ fg: theme.accent }}>p</span> previews output here ·{" "}
							<span style={{ fg: theme.accent }}>r</span> runs in your terminal and comes back
						</text>
					</box>
				}
			>
				{(output) => (
					<scrollbox ref={props.ref} flexGrow={1} scrollY stickyScroll stickyStart="top">
						<box paddingX={1} flexDirection="column">
							<text fg={theme.textDim} wrapMode="none" truncate>{`$ ${output().result.command}`}</text>
							<text fg={output().result.exitCode === 0 ? theme.text : theme.warning}>{output().text}</text>
						</box>
					</scrollbox>
				)}
			</Show>
		</box>
	);
}
