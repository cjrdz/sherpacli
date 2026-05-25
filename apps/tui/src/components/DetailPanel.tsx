import { For, Show } from "solid-js";
import type { Accessor } from "solid-js";
import type { PackItem } from "../types";
import type { ActivePanel } from "../store/appState";

interface DetailPanelProps {
	activePanel: Accessor<ActivePanel>;
	title: string;
	item: Accessor<PackItem | null>;
	selectedCommandSource: Accessor<string>;
	selectedCommand: Accessor<string>;
	selectedExecutionCommand: Accessor<string>;
	selectedExampleIndex: Accessor<number>;
}

function MetaRow(props: { label: string; value: string; code?: boolean }) {
	return (
		<box flexDirection="row" gap={1}>
			<text fg="#565f89">{props.label}:</text>
			<text fg={props.code ? "#9ece6a" : "#c0caf5"}>{props.value}</text>
		</box>
	);
}

export function DetailPanel(props: DetailPanelProps) {
	return (
		<box
			border
			borderColor={props.activePanel() === "detail" ? "#7aa2f7" : "#3b4261"}
			focusedBorderColor="#7aa2f7"
			padding={1}
			flexDirection="column"
			flexGrow={1}
		>
			<text fg={props.activePanel() === "detail" ? "#7aa2f7" : "#9CA3AF"}>{props.title}</text>
			<Show when={props.item()} fallback={<text fg="#E5E7EB">Select an item to inspect it.</text>}>
				{(item) => (
					<box flexDirection="column" gap={0}>
						<text fg="#A6DA95">{item().name}</text>
						<text fg="#E5E7EB">{item().description}</text>
						<MetaRow label="Pack" value={item().packName ?? "Unknown"} />
						<MetaRow label="Use case" value={item().useCase} />
						<MetaRow label="Category" value={item().category} />
						<MetaRow label="Target" value={props.selectedCommandSource()} />
						<MetaRow label="Display" value={props.selectedCommand()} />
						<MetaRow label="Run target" value={props.selectedExecutionCommand()} code />
						<Show when={item().examples.length > 0}>
							<text fg="#F5BDE6">Examples</text>
							<For each={item().examples}>
								{(example, idx) => (
									<text fg={props.selectedExampleIndex() === idx() ? "#A6DA95" : "#CAD3F5"}>
										{props.selectedExampleIndex() === idx() ? "\u203a" : " "} {idx() + 1}. {example.command}
									</text>
								)}
							</For>
						</Show>
					</box>
				)}
			</Show>
		</box>
	);
}
