# Pack Format

SherpaCLI packs are JSON files stored under `packs/commands` and `packs/scripts`.

Recommended scoped layout:

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

## Command Packs

Command packs define reference commands with examples, tags, and safety metadata.

Required top-level shape:

```json
{
	"pack": { "id": "...", "name": "...", "version": "..." },
	"commands": []
}
```

## Script Packs

Script packs define executable local scripts, including file-backed entries for tools in `/usr/local/bin`.

Required top-level shape:

```json
{
	"pack": { "id": "...", "name": "...", "version": "..." },
	"scripts": []
}
```

## Validation Rules

- Pack metadata is required.
- Commands need at least one example.
- Scripts need an execution block.
- JSON must conform to the schema in `schemas/`.

## Scope Resolution

Scope is resolved in this order:
1. `pack.scope` metadata
2. scope folder in path
3. author fallback

Fallback author rules:
- `author: "sherpacli"` => `default`
- `author: "sherpacli-community"` => `community`
- any other non-empty author => `custom`

Flat pack files are still supported for backward compatibility.

## Migration

Use `sherpa migrate` to move flat files into scoped paths.

- default is dry-run
- use `--apply` to persist filesystem changes
- use `--force` to overwrite destination collisions

See `docs/MIGRATE_DESIGN.md` for full behavior, conflicts, and exit codes.
