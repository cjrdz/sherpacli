# Contributing

## Workflow

1. Add or update pack JSON files.
2. Run `bun run validate`.
3. Optionally preview scoped migration: `./bin/sherpa migrate --dry-run`.
4. Run `bun run check`.
5. If runtime behavior changed, run tests in `apps/tui` with `bun test`.
6. Open a PR with a concise summary and screenshots/notes for affected TUI flows.

## TUI Regression Checklist

- Arrows and `j`/`k` navigation work in packs/results/detail panels.
- `/` opens search flow from any panel.
- `Tab` cycles panels and focused detail transitions remain correct.
- `?` help overlay reflects active keymap behavior.
- Selection remains stable while filtering results (sticky selection).
- Copy action shows transient `Copied!` feedback.
- Status bar context remains readable in compact and wide terminals.
