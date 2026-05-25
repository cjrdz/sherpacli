import type { Accessor } from "solid-js";

interface SearchBarProps {
	value: Accessor<string>;
	onInput: (value: string) => void;
	isFocused: Accessor<boolean>;
}

export function SearchBar(props: SearchBarProps) {
	return (
		<box
			border
			borderStyle="rounded"
			borderColor={props.isFocused() ? "#7aa2f7" : "#3b4261"}
			focusedBorderColor="#7aa2f7"
			paddingX={1}
		>
			<text fg="#565f89">/ </text>
			<input
				placeholder="search commands and scripts..."
				value={props.value()}
				onInput={props.onInput}
			/>
		</box>
	);
}
