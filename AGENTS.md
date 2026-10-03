# Agent Plugins

Shared Claude Code and Codex plugin marketplace (`stylish-code`).

## Structure

- `plugins/*/skills/*/SKILL.md`: single skill source for native plugins and the skills CLI.
- `.claude-plugin/marketplace.json`: Claude catalog; plugin metadata may live here or in `plugins/*/.claude-plugin/plugin.json`.
- `.agents/plugins/marketplace.json`: Codex catalog; local source paths are relative to the repository root.
- `plugins/*/.codex-plugin/plugin.json`: Codex manifests with `skills: "./skills/"`.

## Conventions

- Keep both catalogs in sync and omit explicit plugin versions.
- Use kebab-case plugin and skill names; skill frontmatter includes `name` and `description`.
- Add shared agent compatibility instructions to each skill. Host-specific tool names describe capabilities; do not require unavailable tools.
- Run bundled shell scripts through bash from the loaded skill directory, not the target repository directory.
- Update README.md and README.ko.md for installation or behavior changes.

## Validation

```shell
bun scripts/validate.mjs
claude plugin validate .
npx skills add . --list
codex plugin list --available --json -m stylish-code \
  -c 'marketplaces.stylish-code.source_type="local"' \
  -c "marketplaces.stylish-code.source=\"$PWD\""
```

## Local Testing

Claude Code:

```text
/plugin marketplace add ./
/plugin install <plugin-name>@stylish-code
```

Codex:

```shell
codex plugin marketplace add "$PWD"
codex plugin add <plugin-name>@stylish-code
```

After local edits, rerun Codex `plugin add` and start a new session. Claude Code uses the Git HEAD as the version, so commit changes before updating its installed plugin.
