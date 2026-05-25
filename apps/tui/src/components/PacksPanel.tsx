import { For } from "solid-js";
import type { Accessor } from "solid-js";
import type { Pack, PackKind, PackScope } from "../types";
import type { ActivePanel } from "../store/appState";

export type PackNavRow =
	| { type: "kind"; kind: PackKind }
	| { type: "scope"; kind: PackKind; scope: PackScope }
	| { type: "pack"; kind: PackKind; scope: PackScope; pack: Pack };

interface PacksPanelProps {
	rows: Accessor<PackNavRow[]>;
	cursorIndex: Accessor<number>;
	selectedPackId: Accessor<string | null>;
	expandedKinds: Accessor<Record<PackKind, boolean>>;
	kindLabels: Record<PackKind, string>;
	scopeLabels: Record<PackScope, string>;
	activePanel: Accessor<ActivePanel>;
	width: Accessor<number | undefined>;
}

export function PacksPanel(props: PacksPanelProps) {
	return (
		<box
			border
			borderColor={props.activePanel() === "packs" ? "#7aa2f7" : "#3b4261"}
			focusedBorderColor="#7aa2f7"
			padding={1}
			flexDirection="column"
			width={props.width()}
		>
			<text fg={props.activePanel() === "packs" ? "#7aa2f7" : "#9CA3AF"}>Packs</text>
			<For each={props.rows()}>
				{(row, i) => {
					const isCursor = i() === props.cursorIndex();
					if (row.type === "kind") {
						return (
							<text fg={isCursor ? "#A6DA95" : "#91D7E3"}>
								{isCursor ? "\u203a" : " "} {props.expandedKinds()[row.kind] ? "▾" : "▸"} {props.kindLabels[row.kind]}
							</text>
						);
					}

					if (row.type === "scope") {
						return (
							<text fg={isCursor ? "#F5BDE6" : "#9CA3AF"}>
								{isCursor ? "\u203a" : " "}   {props.scopeLabels[row.scope]}
							</text>
						);
					}

					return (
						<text fg={isCursor || row.pack.id === props.selectedPackId() ? "#A6DA95" : "#E5E7EB"}>
							{isCursor ? "\u203a" : " "}     {row.pack.icon} {row.pack.name} {row.pack.items.length}
						</text>
					);
				}}
			</For>
		</box>
	);
}
