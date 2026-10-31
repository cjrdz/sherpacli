import { For, Match, Switch } from "solid-js";
import type { Accessor } from "solid-js";
import type { ActivePanel } from "../store/appState";
import { panelBorder, scopeColor, theme } from "../theme";
import type { Pack, PackKind, PackScope } from "../types";

export type PackNavRow =
	| { type: "all"; count: number }
	| { type: "favorites"; count: number }
	| { type: "recent"; count: number }
	| { type: "kind"; kind: PackKind; count: number }
	| { type: "scope"; kind: PackKind; scope: PackScope }
	| { type: "pack"; kind: PackKind; scope: PackScope; pack: Pack };

export const KIND_LABELS: Record<PackKind, string> = {
	commands: "Commands",
	scripts: "Scripts",
};

export const SCOPE_LABELS: Record<PackScope, string> = {
	custom: "custom",
	default: "default",
	community: "community",
};

interface PacksPanelProps {
	rows: Accessor<PackNavRow[]>;
	cursorIndex: Accessor<number>;
	selectedPackId: Accessor<string>;
	collapsedKinds: Accessor<Record<PackKind, boolean>>;
	activePanel: Accessor<ActivePanel>;
	width: Accessor<number | undefined>;
}

export function PacksPanel(props: PacksPanelProps) {
	const isActive = () => props.activePanel() === "packs";

	return (
		<box
			border
			borderStyle="rounded"
			borderColor={panelBorder(isActive())}
			title=" Packs "
			titleAlignment="left"
			paddingX={1}
			flexDirection="column"
			width={props.width()}
			flexShrink={0}
		>
			<scrollbox flexGrow={1} scrollY>
				<For each={props.rows()}>
					{(row, index) => {
						const isCursor = () => isActive() && index() === props.cursorIndex();
						const rowBg = () => (isCursor() ? theme.selectionBg : undefined);
						return (
							<Switch>
								<Match when={row.type === "all" && row}>
									{(all) => (
										<box flexDirection="row" gap={1} backgroundColor={rowBg()}>
											<text
												fg={props.selectedPackId() === "__all__" ? theme.accent : theme.text}
												flexGrow={1}
												wrapMode="none"
												truncate
											>
												◆ All
											</text>
											<text fg={theme.textDim}>{all().count}</text>
										</box>
									)}
								</Match>
								<Match when={(row.type === "favorites" || row.type === "recent") && row}>
									{(virtual) => {
										const id = () => (virtual().type === "favorites" ? "__favorites__" : "__recent__");
										return (
											<box flexDirection="row" gap={1} backgroundColor={rowBg()}>
												<text
													fg={props.selectedPackId() === id() ? theme.accent : theme.text}
													flexGrow={1}
													wrapMode="none"
													truncate
												>
													{virtual().type === "favorites" ? "★ Favorites" : "⟲ Recent"}
												</text>
												<text fg={theme.textDim}>{virtual().count}</text>
											</box>
										);
									}}
								</Match>
								<Match when={row.type === "kind" && row}>
									{(kind) => (
										<box flexDirection="row" backgroundColor={rowBg()} marginTop={1}>
											<text fg={theme.brand} flexGrow={1} wrapMode="none" truncate>
												{props.collapsedKinds()[kind().kind] ? "▸" : "▾"} {KIND_LABELS[kind().kind]}
											</text>
											<text fg={theme.textDim}>{kind().count}</text>
										</box>
									)}
								</Match>
								<Match when={row.type === "scope" && row}>
									{(scope) => (
										<box backgroundColor={rowBg()}>
											<text fg={scopeColor[scope().scope]} wrapMode="none" truncate>
												{`  ${SCOPE_LABELS[scope().scope]}`}
											</text>
										</box>
									)}
								</Match>
								<Match when={row.type === "pack" && row}>
									{(packRow) => {
										const isSelected = () => packRow().pack.id === props.selectedPackId();
										return (
											<box flexDirection="row" gap={1} backgroundColor={rowBg()}>
												<text fg={isSelected() ? theme.accent : theme.text} flexGrow={1} wrapMode="none" truncate>
													{`${isSelected() ? "▌" : " "}  ${packRow().pack.icon} ${packRow().pack.name}`}
												</text>
												<text fg={theme.textDim}>{packRow().pack.items.length}</text>
											</box>
										);
									}}
								</Match>
							</Switch>
						);
					}}
				</For>
			</scrollbox>
		</box>
	);
}
