import { For, Show } from "solid-js";
import type { Accessor } from "solid-js";
import { parsePlaceholders } from "../core/placeholders";
import type { ActivePanel } from "../store/appState";
import { dangerColor, dangerLabel, panelBorder, scopeColor, theme } from "../theme";
import type { DisplayItem } from "../types";

interface DetailPanelProps {
	activePanel: Accessor<ActivePanel>;
	item: Accessor<DisplayItem | null>;
	selectedCommand: Accessor<string>;
	selectedExampleIndex: Accessor<number>;
}

const whichCache = new Map<string, boolean>();
function isInstalled(binary: string): boolean {
	let found = whichCache.get(binary);
	if (found === undefined) {
		found = Bun.which(binary) !== null;
		whichCache.set(binary, found);
	}
	return found;
}

function Label(props: { children: string }) {
	return (
		<text fg={theme.textDim} width={10} flexShrink={0}>
			{props.children}
		</text>
	);
}

export function DetailPanel(props: DetailPanelProps) {
	const isActive = () => props.activePanel() === "detail";
	const params = () => parsePlaceholders(props.selectedCommand());

	return (
		<box
			border
			borderStyle="rounded"
			borderColor={panelBorder(isActive())}
			title=" Detail "
			titleAlignment="left"
			flexDirection="column"
			flexGrow={1}
		>
			<Show
				when={props.item()}
				fallback={
					<box padding={1}>
						<text fg={theme.textMuted}>Select a command to see its details.</text>
					</box>
				}
			>
				{(item) => (
					<scrollbox flexGrow={1} scrollY>
						<box flexDirection="column" paddingX={1} gap={1}>
							<box flexDirection="column">
								<box flexDirection="row" gap={1}>
									<text fg={theme.text} flexGrow={1}>
										<b>{item().name}</b>
									</text>
									<text fg={dangerColor[item().dangerLevel]} wrapMode="none">
										{`● ${dangerLabel[item().dangerLevel]}`}
									</text>
								</box>
								<text fg={theme.textMuted}>{item().description}</text>
							</box>

							<box backgroundColor={theme.codeBg} paddingX={1} flexDirection="column">
								<text fg={theme.textDim}>
									{props.selectedExampleIndex() >= 0 ? `example ${props.selectedExampleIndex() + 1}` : "command"}
								</text>
								<text fg={theme.code}>{`$ ${props.selectedCommand()}`}</text>
								<Show when={params().length > 0}>
									<text fg={theme.warning}>
										{`needs: ${params()
											.map((param) => param.name)
											.join(", ")}`}
									</text>
								</Show>
							</box>

							<box flexDirection="column">
								<box flexDirection="row">
									<Label>Pack</Label>
									<text fg={theme.text}>
										{`${item().packIcon} ${item().packName} `}
										<span style={{ fg: scopeColor[item().scope] }}>{item().scope}</span>
									</text>
								</box>
								<box flexDirection="row">
									<Label>Category</Label>
									<text fg={theme.text}>{item().category}</text>
								</box>
								<Show when={(item().requires ?? []).length > 0}>
									<box flexDirection="row">
										<Label>Requires</Label>
										<text>
											<For each={item().requires}>
												{(binary) => (
													<span style={{ fg: isInstalled(binary) ? theme.success : theme.danger }}>
														{`${binary} ${isInstalled(binary) ? "✓" : "✗"}  `}
													</span>
												)}
											</For>
										</text>
									</box>
								</Show>
								<Show when={item().useCase && item().useCase !== item().description}>
									<box flexDirection="row">
										<Label>Use</Label>
										<text fg={theme.text}>{item().useCase}</text>
									</box>
								</Show>
							</box>

							<Show when={item().examples.length > 0}>
								<box flexDirection="column">
									<text fg={theme.accentAlt}>
										<b>Examples</b>
										<span style={{ fg: theme.textDim }}>{"  j/k to pick"}</span>
									</text>
									<For each={item().examples}>
										{(example, index) => {
											const selected = () => props.selectedExampleIndex() === index();
											return (
												<box flexDirection="column" backgroundColor={selected() ? theme.selectionBg : undefined}>
													<text fg={selected() ? theme.accent : theme.textMuted}>
														{`${selected() ? "›" : " "} ${example.description}`}
													</text>
													<text fg={theme.code}>{`    $ ${example.command}`}</text>
												</box>
											);
										}}
									</For>
								</box>
							</Show>

							<Show when={(item().menu ?? []).length > 0}>
								<box flexDirection="column">
									<text fg={theme.accentAlt}>
										<b>Menu</b>
									</text>
									<For each={item().menu}>{(option) => <text fg={theme.textMuted}>{`  • ${option.label}`}</text>}</For>
								</box>
							</Show>

							<text fg={theme.textDim}>
								<span style={{ fg: theme.accent }}>c</span>
								{" copy   "}
								<span style={{ fg: theme.accent }}>p</span>
								{" preview   "}
								<span style={{ fg: theme.accent }}>r</span>
								{" run"}
							</text>
						</box>
					</scrollbox>
				)}
			</Show>
		</box>
	);
}
