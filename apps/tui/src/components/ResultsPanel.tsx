import { createEffect, For, Show } from "solid-js";
import type { Accessor } from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { ActivePanel } from "../store/appState";
import { dangerColor, panelBorder, theme } from "../theme";
import type { DisplayItem } from "../types";

interface ResultsPanelProps {
	activePanel: Accessor<ActivePanel>;
	items: Accessor<DisplayItem[]>;
	selectedIndex: Accessor<number>;
	title: Accessor<string>;
	loading: Accessor<boolean>;
	error: Accessor<unknown>;
	query: Accessor<string>;
	isFavorite: (item: DisplayItem) => boolean;
}

export function ResultsPanel(props: ResultsPanelProps) {
	let scroll: ScrollBoxRenderable | undefined;
	const isActive = () => props.activePanel() === "results";

	createEffect(() => {
		const index = props.selectedIndex();
		props.items();
		queueMicrotask(() => scroll?.scrollChildIntoView(`result-${index}`));
	});

	const counter = () => {
		const total = props.items().length;
		return total === 0 ? "0" : `${props.selectedIndex() + 1}/${total}`;
	};

	return (
		<box
			border
			borderStyle="rounded"
			borderColor={panelBorder(isActive())}
			title={` ${props.title()} `}
			titleAlignment="left"
			bottomTitle={` ${counter()} `}
			bottomTitleAlignment="right"
			flexDirection="column"
			flexGrow={1}
			minWidth={30}
		>
			<Show when={!props.loading()} fallback={<text fg={theme.textMuted}> Loading packs…</text>}>
				<Show when={!props.error()} fallback={<text fg={theme.danger}> Could not load packs.</text>}>
					<Show
						when={props.items().length > 0}
						fallback={
							<box paddingX={1} flexDirection="column">
								<text fg={theme.textMuted}>
									{props.query().length > 0 ? `No matches for "${props.query()}".` : "This pack is empty."}
								</text>
								<text fg={theme.textDim}>Try fewer words, or Esc to clear the search.</text>
							</box>
						}
					>
						<scrollbox ref={(el: ScrollBoxRenderable) => (scroll = el)} flexGrow={1} scrollY>
							<For each={props.items()}>
								{(item, index) => {
									const selected = () => index() === props.selectedIndex();
									return (
										<box
											id={`result-${index()}`}
											flexDirection="column"
											paddingX={1}
											backgroundColor={selected() ? theme.selectionBg : undefined}
										>
											<box flexDirection="row" gap={1}>
												<text fg={dangerColor[item.dangerLevel]}>●</text>
												<Show when={props.isFavorite(item)}>
													<text fg={theme.warning}>★</text>
												</Show>
												<text fg={selected() ? theme.accent : theme.text} flexGrow={1} wrapMode="none" truncate>
													{item.name}
												</text>
												<text fg={theme.textDim} wrapMode="none">
													{`${item.packIcon} ${item.category}`}
												</text>
											</box>
											<text fg={selected() ? theme.code : theme.textDim} wrapMode="none" truncate paddingLeft={2}>
												{`$ ${item.command}`}
											</text>
										</box>
									);
								}}
							</For>
						</scrollbox>
					</Show>
				</Show>
			</Show>
		</box>
	);
}
