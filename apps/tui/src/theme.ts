import type { DangerLevel, PackScope } from "./types";

// Single palette for the whole TUI (Tokyo Night inspired).
export const theme = {
	bg: "#1a1b26",
	surface: "#1f2335",
	border: "#3b4261",
	borderActive: "#7aa2f7",
	text: "#c0caf5",
	textMuted: "#9aa5ce",
	textDim: "#565f89",
	accent: "#7aa2f7",
	accentAlt: "#bb9af7",
	brand: "#7dcfff",
	code: "#9ece6a",
	codeBg: "#24283b",
	selectionBg: "#2e3c64",
	success: "#9ece6a",
	warning: "#e0af68",
	danger: "#f7768e",
	info: "#7dcfff",
} as const;

export const dangerColor: Record<DangerLevel, string> = {
	safe: theme.success,
	caution: theme.warning,
	destructive: theme.danger,
};

export const dangerLabel: Record<DangerLevel, string> = {
	safe: "safe",
	caution: "caution",
	destructive: "destructive",
};

export const scopeColor: Record<PackScope, string> = {
	custom: theme.accentAlt,
	default: theme.info,
	community: theme.warning,
};

export function panelBorder(active: boolean): string {
	return active ? theme.borderActive : theme.border;
}
