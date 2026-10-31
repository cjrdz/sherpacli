# Changelog

All notable changes to SherpaCLI are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-31

First public release.

### Added

- Terminal UI with Packs, Results, Detail and Output panels, a help dialog (`?`), and a layout that adapts down to 80×24.
- Search across every pack. Multiple words are combined, and `pack:<name>` narrows the search to one pack.
- Copy (`c`), preview (`p`) and run (`r`) for any command. Running hands the terminal to the command and returns to
  Sherpa afterwards. Commands run in the directory where `sherpa` was started.
- Placeholder form for `<name>`, `<name:default>` and `{{name}}` in commands and for script `args`, with a live
  preview of the final command and remembered values.
- Safety levels: `caution` commands ask for `y` and `destructive` commands ask for `yes` before preview or run.
- Favorites (`f`) and recent commands, saved in `~/.config/sherpa/state.json`.
- User packs in `~/.config/sherpa/packs/`, loaded alongside the bundled packs.
- `sherpa import` to convert quickref.me / cheatsheets.zip sheets into local packs, with `--list`, `--file`,
  `--dry-run` and `--force`.
- `sherpa migrate` to move flat pack files into scoped folders.
- `sherpa --version` and `sherpa --help`.
- Script packs for local programs (`file`, `inline` and `menu` types), with a missing-tool check (`requires`).
- Bundled packs: Bash, curl, Docker, Git, grep, Kubernetes, Linux, Podman, SSH, and an example scripts pack.
- JSON schemas, pack validation (`bun run validate`), Biome formatting and linting, and unit plus headless UI tests.
- MIT license.

[Unreleased]: https://github.com/cjrdz/sherpacli/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cjrdz/sherpacli/releases/tag/v0.1.0
