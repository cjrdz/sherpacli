import { Show } from "solid-js";
import type { Accessor } from "solid-js";

interface OutputPanelProps {
	output: Accessor<string>;
	copyFlash: Accessor<boolean>;
}

export function OutputPanel(props: OutputPanelProps) {
	return (
		<box border borderColor="#3b4261" focusedBorderColor="#7aa2f7" padding={1} flexDirection="column" height={8}>
			<text fg="#F5BDE6">Run output / prompts</text>
			<Show when={props.copyFlash()}>
				<text fg="#A6DA95">Copied!</text>
			</Show>
			<Show
				when={props.output().length > 0}
				fallback={<text fg="#9CA3AF">Use [r] for interactive run. Use [p] for preview output.</text>}
			>
				<text fg="#E5E7EB">{props.output()}</text>
			</Show>
		</box>
	);
}
