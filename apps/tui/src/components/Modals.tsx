import { For, Match, Show, Switch } from "solid-js";
import type { Accessor, JSX } from "solid-js";
import { resolveCommand } from "../core/placeholders";
import { KEY_HELP } from "../hooks/useKeyMap";
import type { Modal, PendingAction } from "../store/appState";
import { dangerColor, theme } from "../theme";

interface ModalLayerProps {
	modal: Accessor<Modal | null>;
	dimensions: Accessor<{ width: number; height: number }>;
	onParamInput: (name: string, value: string) => void;
	onConfirmInput: (value: string) => void;
}

function Frame(props: {
	title: string;
	width: number;
	dimensions: Accessor<{ width: number; height: number }>;
	accent?: string;
	footer: string;
	children: JSX.Element;
}) {
	const width = () => Math.min(props.width, props.dimensions().width - 4);
	return (
		<box
			position="absolute"
			zIndex={100}
			left={Math.max(0, Math.floor((props.dimensions().width - width()) / 2))}
			top={Math.max(1, Math.floor(props.dimensions().height * 0.15))}
			width={width()}
			maxHeight={props.dimensions().height - 4}
			border
			borderStyle="rounded"
			borderColor={props.accent ?? theme.borderActive}
			backgroundColor={theme.surface}
			title={` ${props.title} `}
			titleAlignment="left"
			bottomTitle={` ${props.footer} `}
			bottomTitleAlignment="right"
			paddingX={2}
			paddingY={1}
			flexDirection="column"
			gap={1}
		>
			{props.children}
		</box>
	);
}

function actionVerb(pending: PendingAction): string {
	return pending.action === "copy" ? "Copy" : pending.action === "preview" ? "Preview" : "Run";
}

const HELP_LINES = KEY_HELP.reduce((sum, section) => sum + section.entries.length + 2, -1);

export function ModalLayer(props: ModalLayerProps) {
	// Frame chrome (border + padding + top offset) takes ~8 rows.
	const helpHeight = () => Math.max(4, Math.min(HELP_LINES, props.dimensions().height - 11));

	return (
		<Switch>
			<Match when={props.modal()?.type === "help"}>
				<Frame title="Keyboard shortcuts" width={64} dimensions={props.dimensions} footer="Esc or ? to close">
					<scrollbox height={helpHeight()} scrollY focused>
						<For each={KEY_HELP}>
							{(section, index) => (
								<box flexDirection="column" marginTop={index() === 0 ? 0 : 1}>
									<text fg={theme.accentAlt}>
										<b>{section.title}</b>
									</text>
									<For each={section.entries}>
										{(entry) => (
											<box flexDirection="row">
												<text fg={theme.accent} width={18} flexShrink={0}>
													{entry.keys}
												</text>
												<text fg={theme.text}>{entry.description}</text>
											</box>
										)}
									</For>
								</box>
							)}
						</For>
					</scrollbox>
				</Frame>
			</Match>

			<Match
				when={(() => {
					const modal = props.modal();
					return modal?.type === "menu" ? modal : undefined;
				})()}
			>
				{(modal) => (
					<Frame
						title={`${modal().pending.item.name} — choose an option`}
						width={60}
						dimensions={props.dimensions}
						footer="↑↓ move · Enter select · Esc cancel"
					>
						<box flexDirection="column">
							<For each={modal().pending.item.menu ?? []}>
								{(option, index) => {
									const selected = () => index() === modal().index;
									return (
										<box flexDirection="column" backgroundColor={selected() ? theme.selectionBg : undefined}>
											<text fg={selected() ? theme.accent : theme.text}>
												{`${selected() ? "›" : " "} ${option.label}`}
											</text>
											<text fg={theme.code}>{`    $ ${option.command}`}</text>
										</box>
									);
								}}
							</For>
						</box>
					</Frame>
				)}
			</Match>

			<Match
				when={(() => {
					const modal = props.modal();
					return modal?.type === "params" ? modal : undefined;
				})()}
			>
				{(modal) => {
					const preview = () => resolveCommand(modal().pending.command, modal().pending.item, modal().values);
					return (
						<Frame
							title={`${actionVerb(modal().pending)}: fill in the blanks`}
							width={72}
							dimensions={props.dimensions}
							footer="Tab/↑↓ field · Enter next/submit · Esc cancel"
						>
							<box flexDirection="column">
								<For each={modal().params}>
									{(param, index) => {
										const focused = () => index() === modal().field;
										return (
											<box flexDirection="row" gap={1} height={1}>
												<text
													fg={focused() ? theme.accent : theme.textMuted}
													width={22}
													flexShrink={0}
													wrapMode="none"
													truncate
												>
													{`${focused() ? "›" : " "} ${param.prompt}`}
												</text>
												<input
													flexGrow={1}
													focused={focused()}
													value={modal().values[param.name] ?? ""}
													placeholder={param.defaultValue ?? param.name}
													placeholderColor={theme.textDim}
													textColor={theme.text}
													focusedTextColor={theme.text}
													backgroundColor={theme.codeBg}
													focusedBackgroundColor={theme.selectionBg}
													onInput={(value: string) => props.onParamInput(param.name, value)}
												/>
											</box>
										);
									}}
								</For>
							</box>
							<box backgroundColor={theme.codeBg} paddingX={1}>
								<text fg={theme.code}>{`$ ${preview()}`}</text>
							</box>
						</Frame>
					);
				}}
			</Match>

			<Match
				when={(() => {
					const modal = props.modal();
					return modal?.type === "confirm" ? modal : undefined;
				})()}
			>
				{(modal) => {
					const level = () => modal().pending.item.dangerLevel;
					const destructive = () => level() === "destructive";
					return (
						<Frame
							title={destructive() ? "⚠ Destructive command" : "Run this command?"}
							width={72}
							accent={dangerColor[level()]}
							dimensions={props.dimensions}
							footer={destructive() ? "type yes + Enter · Esc cancel" : "y run · n/Esc cancel"}
						>
							<text fg={theme.text}>
								{`${actionVerb(modal().pending)} `}
								<b>{modal().pending.item.name}</b>
								<span style={{ fg: dangerColor[level()] }}>{` (${level()})`}</span>
							</text>
							<box backgroundColor={theme.codeBg} paddingX={1}>
								<text fg={theme.code}>{`$ ${modal().pending.command}`}</text>
							</box>
							<Show when={destructive()} fallback={<text fg={theme.textMuted}>Press y to continue.</text>}>
								<box flexDirection="row" gap={1} height={1}>
									<text fg={theme.danger}>Type "yes" to continue:</text>
									<input
										flexGrow={1}
										focused
										value={modal().typed}
										textColor={theme.text}
										focusedTextColor={theme.text}
										backgroundColor={theme.codeBg}
										focusedBackgroundColor={theme.selectionBg}
										onInput={props.onConfirmInput}
									/>
								</box>
							</Show>
						</Frame>
					);
				}}
			</Match>
		</Switch>
	);
}
