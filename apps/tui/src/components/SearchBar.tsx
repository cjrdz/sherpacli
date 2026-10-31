import type { Accessor } from "solid-js";
import { theme } from "../theme";

interface SearchBarProps {
	value: Accessor<string>;
	onInput: (value: string) => void;
	isFocused: Accessor<boolean>;
	resultCount: Accessor<number>;
	scopeLabel: Accessor<string>;
}

export function SearchBar(props: SearchBarProps) {
	return (
		<box
			border
			borderStyle="rounded"
			borderColor={props.isFocused() ? theme.borderActive : theme.border}
			paddingX={1}
			height={3}
			flexDirection="row"
			gap={1}
			flexShrink={0}
		>
			<text fg={props.isFocused() ? theme.accent : theme.textDim}>{props.isFocused() ? "❯" : "/"}</text>
			<input
				flexGrow={1}
				focused={props.isFocused()}
				placeholder="search every pack… (press / )"
				placeholderColor={theme.textDim}
				textColor={theme.text}
				focusedTextColor={theme.text}
				backgroundColor="transparent"
				focusedBackgroundColor="transparent"
				value={props.value()}
				onInput={props.onInput}
			/>
			<text fg={theme.textDim}>
				{props.resultCount()} in {props.scopeLabel()}
			</text>
		</box>
	);
}
