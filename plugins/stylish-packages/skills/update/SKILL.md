---
name: update
description: Smart bulk update of npm/pnpm/yarn/bun dependencies. Skips frameworks and packages with their own upgrade CLI, and aligns @types/node with the latest Node major installed locally. Use whenever the user wants to bump dependencies, refresh outdated packages, run a dependency upgrade pass, "update all packages", check what's outdated, or sync types after a Node version change — even if they don't explicitly say "smart update".
tools: Bash, Read, AskUserQuestion
---

## Agent compatibility

This skill is shared by Claude Code and Codex, through native plugins or the skills CLI.
Use the host's available tools for shell commands, file reads, edits, and user questions.
Tool names in this document describe capabilities; do not call tools that the host does not expose.
If a question tool is unavailable, ask in conversation and wait for the answer before dependent actions.
Respect the host's instruction hierarchy and the user's existing authorization.
In Codex, follow applicable AGENTS.md instructions; in Claude Code, follow applicable CLAUDE.md instructions.
Resolve bundled files relative to the directory containing this loaded SKILL.md, even when the target repository is elsewhere.
Claude slash-command examples are examples of user intent. In Codex, invoke the discovered skill by its name; for cross-skill steps, load the named sibling skill if available.
If a required sibling skill is missing, report the dependency rather than inventing its instructions.

Bulk-update project dependencies safely: bump everything that's truly safe, hold back frameworks that need manual migration, hand off packages that ship their own upgrade CLI, and keep `@types/node` aligned with the user's actual Node runtime — not with whatever version the registry happens to publish next.

The reason these distinctions matter: a naïve `npm update --latest` will silently move frameworks (TypeScript, Next.js, React, etc.) across breaking versions, will fight with tools that have first-party upgrade scripts (Storybook, shadcn, Prisma), and will install `@types/node` versions that describe APIs the user's runtime doesn't have. Each of those is a separate failure mode, and each needs a different treatment.

## When this skill triggers

User says any of (non-exhaustive):
- "update all dependencies", "bump everything", "refresh packages"
- "what's outdated?", "run an upgrade pass", "update node modules"
- "sync @types/node to my node version"
- "smart update", "bulk dep update"

Also trigger when the user changes Node versions (via nvm/fnm/volta) and asks to bring types in line.

## Detection phase

### 1. Resolve the package manager from the lockfile

Check in this order — first match wins:

| Lockfile present                  | Package manager |
|-----------------------------------|------------------|
| `pnpm-lock.yaml`                  | `pnpm`           |
| `bun.lock` or `bun.lockb`         | `bun`            |
| `yarn.lock`                       | `yarn` (detect berry vs classic via `yarn --version`) |
| `package-lock.json`               | `npm`            |
| none                              | fall back to `npm`, warn the user |

Also read `package.json` `packageManager` field if present — it overrides lockfile detection.

### 2. Resolve the target Node major

The goal: find the highest Node major version the user has actually installed on this machine, and use that as the target for `@types/node`. Don't use the latest published Node — types should describe a runtime the user can run.

Probe in this order, collect all versions found, then take the max major:

```bash
# nvm (sourced into shell)
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm ls --no-colors 2>/dev/null

# fnm
command -v fnm >/dev/null && fnm list 2>/dev/null

# volta
command -v volta >/dev/null && volta list node 2>/dev/null

# asdf
command -v asdf >/dev/null && asdf list nodejs 2>/dev/null

# system node (fallback)
command -v node >/dev/null && node --version
```

Parse out all `v<major>.<minor>.<patch>` strings, take `max(major)`. That major is the `@types/node` target.

If nothing is found, ask the user which Node major to target.

### 3. Collect outdated packages

```bash
<pm> outdated --json
```

Works on npm, pnpm, yarn (berry), and bun. Parse the JSON to get `{ package, current, wanted, latest, type }` per entry.

For older yarn classic, fall back to parsing `yarn outdated` table output.

## Classification

For each outdated package, classify into one of four buckets:

### Bucket A — `@types/node` (special-cased)

Target the latest version on the major matching the installed Node max-major. Example: installed majors `[18, 20, 22]` → install `@types/node@22` (resolves to latest 22.x). Don't follow `latest` from `outdated` here; it may be ahead of the runtime.

### Bucket B — Frameworks (skip auto-bump, surface to user)

Major bumps here usually require a migration guide. Skip silently for patches/minors? No — skip them entirely from the auto-update set, but list them in the report so the user knows they're outdated. Reason: even minor bumps of these can ship behavior changes the user wants to review.

Framework list (match by name or scope prefix):

- `typescript`
- `next`
- `react`, `react-dom`, `react-native`
- `vue`, `@vue/*`, `nuxt`, `@nuxt/*`
- `svelte`, `@sveltejs/*`
- `@angular/*`, `@angular-devkit/*`
- `@nestjs/*`
- `express`, `fastify`, `koa`, `hapi`
- `vite`
- `webpack`, `webpack-cli`
- `@remix-run/*`
- `gatsby`, `gatsby-*`
- `astro`, `@astrojs/*`
- `solid-js`, `@solidjs/*`
- `qwik`, `@builder.io/qwik*`

### Bucket C — Self-upgrading packages (skip auto-bump, surface CLI hint)

These ship their own upgrade tooling that does more than bump a version (codemods, config rewrites, schema sync). Bumping them via plain `<pm> update` skips the migration work.

| Match               | Recommended upgrade command                          |
|---------------------|------------------------------------------------------|
| `storybook`, `@storybook/*` | `npx storybook@latest upgrade`                       |
| `@shadcn/ui`, `shadcn-ui`, `shadcn` | `npx shadcn@latest add` (re-add components as needed) |
| `prisma`, `@prisma/*` | `pnpm add -D prisma@latest && npx prisma generate`  |
| `@cypress/*`, `cypress` | `npx cypress install` after bump                    |
| `tailwindcss` (major) | follow Tailwind v3→v4 guide; use `npx @tailwindcss/upgrade` for v4 |
| `@sentry/*` (major) | follow Sentry migration guide                        |
| `expo`              | `npx expo install --check` then `npx expo install --fix` |
| `@nx/*`, `nx`       | `npx nx migrate latest`                              |
| `@angular/cli` (major) | `ng update @angular/core @angular/cli`            |

For patches/minors of these, it's *usually* safe to bump normally — but err on the side of surfacing them so the user can decide.

### Bucket D — Everything else (safe-bump candidates)

Normal libraries: utility packages, eslint plugins (non-config-breaking), testing helpers, lint formatters, etc. Patches and minors get bumped without confirmation. Majors get listed for individual confirmation.

## Preview before applying

Always show the preview before running any install command. Group by bucket:

```
Package manager: pnpm
Target Node major (for @types/node): 22

@types/node alignment:
  @types/node  20.11.5 → 22.x (latest matching installed Node 22)

Safe bumps (patches + minors, will apply automatically):
  zod              3.22.4 → 3.22.7
  date-fns         2.30.0 → 2.30.4
  @types/react     18.2.45 → 18.2.79

Major bumps (need your confirmation, one by one):
  vitest           1.6.0 → 3.0.0
  zustand          4.5.0 → 5.0.0

Held back — frameworks (review the changelog yourself):
  typescript       5.3.3 → 5.6.2
  next             14.1.0 → 15.0.3
  react            18.2.0 → 19.0.0

Held back — self-upgrading (run the package's CLI):
  storybook        7.6.10 → 8.4.7   → npx storybook@latest upgrade
  prisma           5.8.1 → 5.22.0   → pnpm add -D prisma@latest && npx prisma generate
```

After the preview, ask: "Apply the safe bumps + @types/node now? Then I'll walk through the majors and ask about held-back packages individually."

After the safe bumps succeed, **proactively go through the Held-back list with AskUserQuestion** — one prompt per held-back package (or one batched multi-select for the framework list) — asking whether to also bump it. Don't just leave them in the report. The user explicitly said they want to be asked, not silently skipped.

## Update commands by package manager

### npm

```bash
npm install <pkg>@<version>      # explicit version
npm install <pkg>@latest         # major jump
```

### pnpm

```bash
pnpm update <pkg>                # within range (safe)
pnpm update --latest <pkg>       # cross-major
pnpm add -D <pkg>@latest         # for devDeps when promoting major
```

### yarn (berry)

```bash
yarn up <pkg>                    # within range
yarn up <pkg>@latest             # cross-major
```

### yarn (classic)

```bash
yarn upgrade <pkg> --latest
```

### bun

```bash
bun update <pkg>                 # respects range
bun add <pkg>@latest             # cross-major
```

Run multi-package bumps in a single command per package manager where possible — saves one full install cycle per package.

## @types/node alignment — the precise recipe

1. From the detection step you have `nodeMajor` (e.g. `22`).
2. Resolve the latest published `@types/node` on that major:
   ```bash
   npm view @types/node@<nodeMajor> version
   ```
   This returns the latest version on that major line (e.g. `22.10.5`).
3. Install pinning to the major:
   ```bash
   <pm> add -D @types/node@<nodeMajor>
   ```
   This will land on the latest patch/minor under that major and let normal range-update bring in future fixes.

If the user has `@types/node` as a regular dep (not devDep), preserve that location.

## Safety rules

- **Always preview first.** Never run an install command before the user has seen what will change.
- **Confirm before any major.** Patches and minors of Bucket D can be auto-applied after the preview is approved as a batch. Majors of Bucket D get individual `y/n`.
- **Never auto-bump Buckets B or C.** Surface them, explain why, hand off the CLI command, and ask if the user wants to bump anyway.
- **Lockfile is the rollback.** Before applying, remind the user the lockfile is the rollback path (`git checkout <lockfile>` + `<pm> install`).
- **Post-update: suggest verification.** After the bumps land, suggest running `<pm> run typecheck` and `<pm> test` (only if those scripts exist in `package.json`).
- **Monorepos**: if `pnpm-workspace.yaml`, `lerna.json`, `nx.json`, or `package.json` `workspaces` exists, ask the user whether to update root-only or recurse into workspaces. Default to asking — the right answer is project-specific.

## Process summary

1. Detect package manager from lockfile + `packageManager` field.
2. Detect installed Node majors (nvm/fnm/volta/asdf/system) → take max → that's the `@types/node` target.
3. Run `<pm> outdated --json` and parse.
4. Classify into Buckets A/B/C/D.
5. Resolve `@types/node` target version via `npm view @types/node@<major> version`.
6. Show the preview report.
7. On user approval: apply Bucket A + Bucket D (patch/minor) in one batch.
8. For Bucket D majors: ask one-by-one.
9. For Buckets B and C: ask the user (one prompt per package, or batched multi-select) whether to bump despite the warning. If yes, run the upgrade — for Bucket C, prefer the recommended CLI over plain `<pm> update`.
10. After applying: suggest `typecheck` and `test` runs if those scripts exist.

## Examples

**Standard run (pnpm project, Node 22 installed via nvm):**
```
/stylish-packages:update
→ Detected: pnpm, target Node major 22
→ Running pnpm outdated...
→ 12 packages outdated.

Preview:
  @types/node alignment: 20.11.5 → 22.10.5
  Safe bumps (7): zod, date-fns, @types/react, eslint-plugin-react, ...
  Major (needs y/n): vitest 1→3, zustand 4→5
  Frameworks held back: typescript, next, react
  Self-upgrading held back: storybook (→ npx storybook@latest upgrade)

→ Apply safe bumps + @types/node now? (y/n)
→ y
→ Running: pnpm add -D @types/node@22 && pnpm update zod date-fns ...
→ Done. Now the held-backs:
  Bump vitest 1.6.0 → 3.0.0? (y/n)
  Bump zustand 4.5.0 → 5.0.0? (y/n)
  Bump typescript 5.3.3 → 5.6.2 (framework, review changelog)? (y/n)
  Run storybook upgrade now (npx storybook@latest upgrade)? (y/n)
  ...
→ Suggest running: pnpm typecheck && pnpm test
```

**Nothing to do:**
```
/stylish-packages:update
→ Detected: bun, target Node major 22
→ Running bun outdated...
→ All packages up to date ✅
```

**Multiple Node versions installed, user has older runtime than @types/node latest:**
```
/stylish-packages:update
→ Detected installed Node majors: 18, 20, 22 (via nvm)
→ Target Node major: 22 (latest installed)
→ Note: @types/node 24.x is published, but installing @types/node@22 to match runtime.
```

**No lockfile detected:**
```
/stylish-packages:update
→ No lockfile detected. Falling back to npm.
→ Heads up: without a lockfile, exact reproducibility isn't guaranteed.
→ Continue? (y/n)
```
