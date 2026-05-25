# SherpaCLI

SherpaCLI is an offline-first, terminal-native command and script assistant built with OpenTUI, SolidJS, TypeScript, and Bun.

It helps you browse curated command packs, search quickly, inspect usage details, and run or copy commands from a keyboard-first interface.

## Quick Start

```bash
bun install
bun run dev
```

Run directly from the repository:

```bash
bun run sherpa
```

## Install Global CLI

Create a global `sherpa` command:

```bash
bun link
mkdir -p "$HOME/.bun/bin"
ln -sf "$(pwd)/bin/sherpa" "$HOME/.bun/bin/sherpa"
```

If needed, add Bun's bin directory to your shell `PATH`:

```bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Then run:

```bash
sherpa
```

## Core Usage

- `Tab`, `Left`, `Right`: switch panels
- `Up`/`Down` or `j`/`k`: move selection
- `/`: jump to search
- `Enter` on results: open focused detail
- `Enter` or `c` in detail: copy command
- `p` in detail: preview command output
- `r` in detail: run interactively
- `?`: toggle help
- `Esc` or `Ctrl+C`: exit

The status bar shows panel context, selected target, result count, and last run status.

## Pack Layout

Sherpa supports both command packs and script packs:

```text
packs/
  commands/
    custom/
    default/
    community/
  scripts/
    custom/
    default/
    community/
```

Scope resolution order:

1. `pack.scope` metadata
2. folder segment in path (`custom/default/community`)
3. author fallback

Backward compatibility is preserved: flat files like `packs/commands/*.json` and `packs/scripts/*.json` still work.

## Migrate Packs

Use Sherpa's migration utility to move flat packs into scoped folders.

Dry-run (default):

```bash
sherpa migrate --dry-run
```

Apply changes:

```bash
sherpa migrate --apply
```

Useful flags:

- `--target commands|scripts|all`
- `--from flat|scoped|auto`
- `--force`
- `--json`

See `docs/MIGRATE_DESIGN.md` for detailed behavior and conflict strategy.

## Development

- Validate packs: `bun run validate`
- Type-check TUI: `bun run check`
- Run tests: `bun test` (inside `apps/tui`)

Repository structure:

- `apps/tui`: OpenTUI + Solid application
- `packs`: command/script pack data
- `schemas`: JSON schemas for pack validation
- `scripts/validate-pack.ts`: validation entrypoint

## Documentation

- Pack format: `docs/PACK_FORMAT.md`
- Contributing guide: `docs/CONTRIBUTING.md`
- Migration design: `docs/MIGRATE_DESIGN.md`

## References

- OpenTUI: https://opentui.com/docs/getting-started/
- SolidJS: https://docs.solidjs.com/quick-start
