# Pack Format

A pack is a JSON file containing either **commands** (reference commands with examples) or **scripts** (local
programs Sherpa can run). Every pack is validated against a JSON schema in [`schemas/`](../schemas):

- `schemas/command-pack.schema.json`
- `schemas/script-pack.schema.json`

Add `"$schema"` at the top of a pack file to get completion and validation in editors such as VS Code:

```json
{ "$schema": "../../schemas/command-pack.schema.json" }
```

## Where packs live

Sherpa loads packs from two places, using the same folder layout in both:

| Location | Use it for |
| --- | --- |
| `packs/` in the repository | Bundled packs everyone gets |
| `~/.config/sherpa/packs/` (or `$XDG_CONFIG_HOME/sherpa/packs/`) | Your own packs and `sherpa import` output |

```text
packs/
├── commands/
│   ├── custom/
│   ├── default/
│   └── community/
└── scripts/
    ├── custom/
    ├── default/
    └── community/
```

If a user pack has the same `pack.id` as a bundled pack, the user pack replaces it.
Flat files such as `packs/commands/docker.json` also work. `sherpa migrate` can move them into scoped folders.

## Pack metadata

Both kinds of pack start with a `pack` object:

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Unique id, e.g. `docker`. Also used to store favorites (`<pack id>/<item id>`), so avoid renaming it |
| `name` | yes | Display name |
| `version` | yes | Your version of the pack, e.g. `1.0.0` |
| `description` | yes | One line about the pack |
| `icon` | yes | One emoji shown next to the name |
| `author` | yes | Author or team. Used for scope when there is no folder or `scope` |
| `tags` | yes | At least one tag |
| `scope` | no | `custom`, `default` or `community`. Overrides the folder |
| `source` | no | Where the content came from (URL or file). Set by `sherpa import` |
| `license` | no | License of the content when it differs from the project. Set by `sherpa import` |

## Command packs

```json
{
	"$schema": "../../schemas/command-pack.schema.json",
	"pack": {
		"id": "docker",
		"name": "Docker",
		"version": "1.0.0",
		"description": "Core Docker commands",
		"icon": "🐳",
		"author": "sherpacli-community",
		"tags": ["docker", "containers"]
	},
	"commands": [
		{
			"id": "docker-logs",
			"name": "View container logs",
			"description": "Show logs from a container.",
			"command": "docker logs <container>",
			"use_case": "Use when a container exits or misbehaves.",
			"category": "Debug",
			"tags": ["logs", "debug"],
			"examples": [{ "description": "Follow the last 100 lines", "command": "docker logs -f --tail 100 <container>" }],
			"requires": ["docker"],
			"danger_level": "safe"
		}
	]
}
```

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Unique within the pack |
| `name` | yes | Short title shown in results |
| `description` | yes | What the command does |
| `command` | yes | The command. May contain [placeholders](#placeholders) |
| `use_case` | yes | When to reach for it. Shown in Detail if it differs from the description |
| `category` | yes | Group label, e.g. `Debug`, `Cleanup` |
| `tags` | yes | Extra search words |
| `examples` | yes | At least one `{ "description", "command" }`. Pick them with `j`/`k` in Detail; the selected one is what `c`, `p` and `r` use |
| `requires` | no | Binaries the command needs. Detail shows ✗ next to any that aren't installed |
| `danger_level` | no | `safe` (default), `caution` or `destructive`. See [Safety](#safety) |
| `platform` | no | `linux`, `macos` and/or `windows`. Informational for now |
| `see_also` | no | Related item ids. Informational for now |

## Script packs

Script packs describe programs on your machine. An item's `execution.type` decides what runs:

| `type` | Runs | Fields |
| --- | --- | --- |
| `file` | An executable file | `path`, e.g. `/usr/local/bin/backup-home` |
| `inline` | A shell command | `command` |
| `menu` | One of several commands, picked from a menu | `options`: `[{ "label", "command" }]` |

Any type can add `args`, values to ask for before running (see [Placeholders](#placeholders)).

```json
{
	"$schema": "../../schemas/script-pack.schema.json",
	"pack": {
		"id": "home-scripts",
		"name": "Home scripts",
		"version": "1.0.0",
		"description": "Personal maintenance helpers",
		"icon": "🔧",
		"author": "me",
		"tags": ["maintenance"]
	},
	"scripts": [
		{
			"id": "backup-home",
			"name": "Back up home",
			"description": "Sync my home folder to a backup disk.",
			"category": "Maintenance",
			"tags": ["backup"],
			"requires": ["rsync"],
			"danger_level": "caution",
			"execution": {
				"type": "file",
				"path": "/usr/local/bin/backup-home",
				"args": [{ "name": "target", "prompt": "Backup folder", "default": "/mnt/backup" }]
			}
		},
		{
			"id": "restart-audio",
			"name": "Restart audio",
			"description": "Restart PipeWire or PulseAudio.",
			"category": "Desktop",
			"tags": ["audio"],
			"execution": {
				"type": "menu",
				"options": [
					{ "label": "PipeWire", "command": "systemctl --user restart pipewire pipewire-pulse wireplumber" },
					{ "label": "PulseAudio", "command": "pulseaudio -k" }
				]
			}
		}
	]
}
```

| Field | Required | Description |
| --- | --- | --- |
| `id`, `name`, `description`, `category`, `tags` | yes | Same as command items |
| `execution` | yes | See the table above |
| `icon` | no | Emoji for the item |
| `requires` | no | Binaries the script needs |
| `danger_level` | no | `safe` (default), `caution` or `destructive` |

## Placeholders

Values you fill in before Sherpa copies, previews or runs a command:

| Syntax | Meaning |
| --- | --- |
| `<name>` or `{{name}}` | Required value, e.g. `kubectl logs <pod-name>` |
| `<name:default>` or `{{name:default}}` | Value with a default, e.g. `docker run -p <port:8080>:80 nginx` |

- Names start with a letter and may contain letters, digits, `-` and `_`. The form label is the name with
  dashes and underscores turned into spaces (`pod-name` → "Pod name").
- Shell syntax is left alone: redirects (`< file`, `<<EOF`), brace expansion (`{1..5}`) and `%{http_code}`.
- The same name used twice is asked once and filled everywhere.
- Sherpa remembers the last value per name in `~/.config/sherpa/state.json` and pre-fills it next time.

Script `args` work the same way. Each arg has a `name`, a `prompt` (the form label) and an optional `default`:

- If the command contains a placeholder with the same name, the value goes there.
- Otherwise the value is added to the end of the command as a quoted argument, in the order the args are listed.

For example, `{ "path": "/usr/local/bin/backup-home", "args": [{ "name": "target", ... }] }` runs
`/usr/local/bin/backup-home /mnt/backup`.

## Safety

| `danger_level` | Use for | Before preview or run |
| --- | --- | --- |
| `safe` | Read-only commands (`ls`, `get`, `status`, `logs`) | Runs right away |
| `caution` | Commands that change state but can be undone (`restart`, `chmod`, `stop`, `push`) | Press `y` |
| `destructive` | Commands that delete data or can't be undone (`rm -rf`, `prune`, `reset --hard`, `kill -9`) | Type `yes` |

Copying never asks. When unsure, choose the stricter level.

## Scope

Scope groups packs in the Packs panel. It is decided in this order:

1. `pack.scope`
2. a `custom`, `default` or `community` folder in the file path
3. `author`: `sherpacli` → `default`, `sherpacli-community` → `community`, anything else → `custom`

## Validation

```bash
bun run validate        # every pack in packs/
```

The checks:

- Pack metadata is complete.
- Every command has at least one example.
- Every script has an `execution` block.
- The JSON matches the schema.

`sherpa import` validates what it generates before saving it.
User packs in `~/.config/sherpa/packs/` are loaded as-is; a file that can't be parsed is skipped with a warning.

## Migrating flat packs

`sherpa migrate` moves flat files (`packs/commands/docker.json`) into scoped folders (`packs/commands/community/docker.json`).
It only previews changes until you pass `--apply`.

```bash
sherpa migrate --dry-run                 # show the plan
sherpa migrate --apply                   # move the files, then validate
sherpa migrate --target commands --json  # only command packs, machine-readable report
```

| Option | Default | Description |
| --- | --- | --- |
| `--target commands\|scripts\|all` | `all` | Which packs to move |
| `--from flat\|scoped\|auto` | `auto` | Which source layout to read |
| `--apply` / `--dry-run` | dry run | Write changes or only preview them |
| `--force` | off | Overwrite files that already exist at the destination |
| `--json` | off | Print the report as JSON |

Files with invalid JSON, invalid packs, duplicate ids in a scope, or existing destinations are reported as skipped or
conflicts instead of being moved. With `--apply`, the command exits with code 1 if conflicts remain (without `--force`)
or if validation fails after moving.
