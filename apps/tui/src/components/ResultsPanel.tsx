import { For, Show } from "solid-js";
import type { Accessor } from "solid-js";
import type { PackItem, PackScope } from "../types";
import type { ActivePanel } from "../store/appState";

interface VisibleResults {
	start: number;
	items: PackItem[];
}

interface ResultsPanelProps {
	activePanel: Accessor<ActivePanel>;
	items: Accessor<PackItem[]>;
	visible: Accessor<VisibleResults>;
	selectedResultIndex: Accessor<number>;
	loading: Accessor<boolean>;
	error: Accessor<boolean>;
}

function scopeBadge(scope: PackScope) {
	if (scope === "custom") {
		return "[Custom]";
	}
	if (scope === "community") {
		return "[Community]";
	}
	return "[Default]";
}

export function ResultsPanel(props: ResultsPanelProps) {
	return (
		<box
			border
			borderColor={props.activePanel() === "results" ? "#7aa2f7" : "#3b4261"}
			focusedBorderColor="#7aa2f7"
			padding={1}
			flexDirection="column"
			flexGrow={1}
		>
			<text fg={props.activePanel() === "results" ? "#7aa2f7" : "#9CA3AF"}>
				Results ({props.items().length > 0 ? `${props.visible().start + 1}-${Math.min(props.visible().start + props.visible().items.length, props.items().length)} of ${props.items().length}` : "0"})
			</text>
			<Show when={!props.loading() && !props.error()} fallback={<text fg="#F0C6C6">Loading packs...</text>}>
				<Show when={props.items().length > 0} fallback={<text fg="#F0C6C6">No matching entries yet.</text>}>
					<For each={props.visible().items}>
						{(item, i) => {
							const absoluteIndex = props.visible().start + i();
							const selected = absoluteIndex === props.selectedResultIndex();
							return (
								<box flexDirection="column" gap={0}>
									<box flexDirection="row" justifyContent="space-between">
										<text fg={selected ? "#A6DA95" : "#CAD3F5"}>
											{selected ? "▶" : " "} {item.name}
										</text>
										<text fg="#8BD5CA">{scopeBadge((item as { scope?: PackScope }).scope ?? "default")}</text>
									</box>
									<box flexDirection="row" justifyContent="space-between">
										<text fg="#9CA3AF">{item.description}</text>
										<text fg="#565f89">[{item.category}]</text>
									</box>
								</box>
							);
						}}
					</For>
				</Show>
			</Show>
		</box>
	);
}
