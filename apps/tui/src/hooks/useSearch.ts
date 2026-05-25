import Fuse from "fuse.js";
import { createEffect, createMemo, createSignal } from "solid-js";
import type { Accessor } from "solid-js";
import type { PackItem } from "../types";

export function useSearch<T extends PackItem>(args: {
	items: Accessor<T[]>;
	query: Accessor<string>;
	selectedItemId: Accessor<string | null>;
	onStickySelection: (nextIndex: number) => void;
}) {
	const [debouncedQuery, setDebouncedQuery] = createSignal(args.query().trim());

	createEffect(() => {
		const value = args.query().trim();
		const handle = setTimeout(() => {
			setDebouncedQuery(value);
		}, 50);
		return () => clearTimeout(handle);
	});

	const filteredItems = createMemo<T[]>(() => {
		const query = debouncedQuery().toLowerCase();
		const source = args.items();
		if (query.length === 0) {
			return source;
		}

		const fuse = new Fuse(source, {
			threshold: 0.36,
			ignoreLocation: true,
			keys: [
				"name",
				"description",
				"command",
				"useCase",
				"category",
				"tags",
				"packName",
			],
		});

		return fuse.search(query).map((result) => result.item);
	});

	createEffect(() => {
		const selectedId = args.selectedItemId();
		const results = filteredItems();
		if (!selectedId || results.length === 0) {
			args.onStickySelection(0);
			return;
		}

		const stableIndex = results.findIndex((item) => item.id === selectedId);
		if (stableIndex >= 0) {
			args.onStickySelection(stableIndex);
			return;
		}

		args.onStickySelection(0);
	});

	return {
		debouncedQuery,
		filteredItems,
	};
}
