import { Show } from "solid-js";
import type { Accessor } from "solid-js";
import { formatDuration, type RunResult } from "../core/runner";
import type { StatusTone } from "../store/appState";
import { theme } from "../theme";

interface StatusBarProps {
	mode: Accessor<string>;
	hints: Accessor<string>;
	status: Accessor<{ text: string; tone: StatusTone } | null>;
	lastRun: Accessor<RunResult | null>;
}

const toneColor: Record<StatusTone, string> = {
	info: theme.info,
	success: theme.success,
	warning: theme.warning,
	error: theme.danger,
};

export function StatusBar(props: StatusBarProps) {
	return (
		<box flexDirection="row" height={1} gap={1} flexShrink={0}>
			<text fg={theme.bg} bg={theme.accent}>
				{` ${props.mode().toUpperCase()} `}
			</text>
			<Show
				when={props.status()}
				fallback={
					<text fg={theme.textDim} flexGrow={1} wrapMode="none" truncate>
						{props.hints()}
					</text>
				}
			>
				{(status) => (
					<text fg={toneColor[status().tone]} flexGrow={1} wrapMode="none" truncate>
						{status().text}
					</text>
				)}
			</Show>
			<Show when={props.lastRun()}>
				{(run) => (
					<text fg={run().exitCode === 0 ? theme.success : theme.danger} wrapMode="none">
						{`${run().exitCode === 0 ? "✓" : "✗"} exit ${run().exitCode} · ${formatDuration(run().durationMs)}`}
					</text>
				)}
			</Show>
		</box>
	);
}
