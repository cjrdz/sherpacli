import Fuse from "fuse.js";
import { createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import type { PackItem } from "../types";

const FUSE_OPTIONS = {
	threshold: 0.36,
	ignoreLocation: true,
	// Space-separated words are ANDed: "kube logs" finds `kubectl logs`.
	useExtendedSearch: true,
	keys: [
		{ name: "name", weight: 3 },
		{ name: "command", weight: 2 },
		{ name: "tags", weight: 1.5 },
		{ name: "examples.command", weight: 1 },
		{ name: "description", weight: 1 },
		{ name: "category", weight: 0.8 },
		{ name: "packName", weight: 0.8 },
		{ name: "useCase", weight: 0.5 },
	],
};

// Not debounced on purpose: results must match the query the instant a key is
// pressed, or an action (`r`) typed right after could hit a stale selection.
export function useSearch<T extends PackItem>(args: { items: Accessor<T[]>; query: Accessor<string> }) {
	const trimmedQuery = createMemo(() => args.query().trim());

	// Rebuilt only when the item set changes, not on every keystroke.
	const index = createMemo(() => new Fuse(args.items(), FUSE_OPTIONS));

	const filteredItems = createMemo<T[]>(() => {
		const query = trimmedQuery();
		if (query.length === 0) {
			return args.items();
		}
		return index()
			.search(query)
			.map((result) => result.item);
	});

	return { query: trimmedQuery, filteredItems };
}
