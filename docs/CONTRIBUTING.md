# Contributing

Thanks for helping improve SherpaCLI. The most useful contributions are usually **packs**: commands people reach for
often, with clear descriptions and honest safety levels.

## Setup

```bash
git clone https://github.com/cjrdz/sherpacli.git
cd sherpacli
bun install
bun run dev
```

You need [Bun](https://bun.sh) 1.4 or newer.

## Adding or improving a pack

1. Edit or add a JSON file under `packs/commands/` or `packs/scripts/`. [PACK_FORMAT.md](PACK_FORMAT.md) has the fields.
2. Write the content yourself or use sources whose license allows it. Do not paste content from GPL-licensed cheat
   sheets (such as quickref.me) into `packs/`. Users can import those locally with `sherpa import`.
3. Use placeholders (`<pod-name>`) instead of made-up values, so the form can ask for them.
4. Set `danger_level` honestly: anything that deletes data or can't be undone is `destructive`.
5. Run `bun run validate`, then open `bun run dev` and try the commands with `c`, `p` and `r`.

## Changing code

Before opening a pull request, run:

```bash
bun run check      # type-check
bun run lint       # Biome lint
bun run format     # Biome format (tabs, 120 columns)
bun run test       # unit and UI tests
bun run validate   # pack validation
```

UI tests in `apps/tui/src/app.test.tsx` drive the app with OpenTUI's headless renderer: they type keys and check
the rendered screen. Add one when you change keyboard behavior or layout. They point `XDG_CONFIG_HOME` at a
temporary folder, so they never touch your real favorites.

### Manual checklist for UI changes

Run `bun run dev` in a wide terminal and in an 80×24 one, then check:

- Typing in search never triggers shortcuts (`j`, `k`, `c`, `p`, `r`, `f`).
- `Esc` steps back (dialog → search → detail → results) and never quits. `q` quits.
- `c` on a command with placeholders opens the form, and the copied text has your values.
- `r` runs in the terminal, waits for a key, and returns to the same selection.
- `caution` asks for `y`. `destructive` asks for `yes`, and `Enter` alone does nothing.
- `?` shows the help, and it matches the actual keys (`KEY_HELP` in `apps/tui/src/hooks/useKeyMap.ts`).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `test:`,
`refactor:`, optionally with a scope (`feat(tui): …`, `feat(packs): …`).

## Releasing

Sherpa follows [Semantic Versioning](https://semver.org/). While the version is below 1.0, a minor release
(`0.2.0`) may change behavior and a patch release (`0.1.1`) only fixes bugs.

Every release gets a version bump, a changelog entry, a `vX.Y.Z` tag and a GitHub release:

1. Update `version` in `package.json` **and** `apps/tui/package.json`. `sherpa --version` reads the latter.
2. Move the items under `## [Unreleased]` in [CHANGELOG.md](../CHANGELOG.md) into a new `## [X.Y.Z] - YYYY-MM-DD` section.
3. Run the full check list above.
4. Commit and tag:

   ```bash
   git commit -am "chore(release): vX.Y.Z"
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin main --follow-tags
   ```

5. Publish the GitHub release with that version's changelog section as the notes:

   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <notes.md>
   ```
