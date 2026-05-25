import type { Accessor } from "solid-js";

interface StatusBarProps {
	context: Accessor<string>;
	message: Accessor<string>;
}

export function StatusBar(props: StatusBarProps) {
	return (
		<box flexDirection="column">
			<text fg="#8BD5CA">{props.context()}</text>
			<text fg="#9CA3AF">{props.message()}</text>
		</box>
	);
}
