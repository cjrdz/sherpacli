import { For, Show } from "solid-js";
import type { Accessor } from "solid-js";
import type { KeyBinding } from "../hooks/useKeyMap";

interface HelpOverlayProps {
	show: Accessor<boolean>;
	bindings: Accessor<KeyBinding[]>;
}

export function HelpOverlay(props: HelpOverlayProps) {
	return (
		<Show when={props.show()}>
			<box border padding={1} flexDirection="column" borderColor="#7aa2f7">
				<text fg="#F5A97F">Help</text>
				<For each={props.bindings()}>
					{(binding) => (
						<text fg="#CAD3F5">{binding.key}: {binding.description}</text>
					)}
				</For>
			</box>
		</Show>
	);
}
