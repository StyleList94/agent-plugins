---
name: create-worktree
description: Create a git worktree in a sibling directory for isolated feature work
argument-hint: "[branch-name or description]"
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

# Create Worktree

Create a git worktree as a sibling directory of the current project and set up the development environment.

**Language rule:** Communicate with the user in the same language they are using. If Korean, respond in Korean. If English, use English. Only commands and file paths remain as-is.

## Step 1: Gather project info

```bash
git_root=$(git rev-parse --show-toplevel)
project_name=$(basename "$git_root")
parent_dir=$(dirname "$git_root")
default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
```

## Step 2: Determine branch name

Extract branch info from the user's request.

**Prefix** — infer from work context:

| Prefix | Purpose |
|--------|---------|
| `feature/` | New feature |
| `fix/` | Bug fix |
| `chore/` | Maintenance, refactoring |
| `docs/` | Documentation |

**Branch name** — extract keywords from the user's description.
- e.g., "login page work" → `feature/login-page`
- If the user specifies a prefix or name explicitly, use it as-is

If both prefix and name can be inferred confidently, propose and proceed. If uncertain, ask the user.

## Step 3: Create worktree

Directory name follows `{project}-{feature-keyword}` pattern.
Feature keyword is the core word(s) from the branch name without the prefix.

```bash
# e.g., project=my-app, branch=feature/login-page → my-app-login-page
worktree_dir="$parent_dir/${project_name}-${feature_keyword}"
git worktree add "$worktree_dir" -b "$branch_name"
```

**Conflict handling:**
- If a branch with the same name already exists, notify the user
- If the directory path already exists, ask the user before proceeding

## Step 4: Install dependencies (conditional)

Detect the package manager from the lockfile in the worktree root.
Skip this step if no lockfile is found.

| Lockfile | Install command |
|----------|----------------|
| `pnpm-lock.yaml` | `pnpm install` |
| `yarn.lock` | `yarn install` |
| `package-lock.json` | `npm install` |
| `bun.lockb` / `bun.lock` | `bun install` |

After installing dependencies, run the `build` script from `package.json` if it exists.
(Required for monorepos or projects with inter-package dependencies)

## Step 5: Copy configuration files

Worktrees do not include `.gitignore`d files, so copy necessary config from the original.

### Host configuration directories

For Claude Code, scan for `.claude/`; for Codex, scan for `.codex/` and `.agents/`. Copy only the host configuration needed for the worktree. Review ignored configuration before copying; do not copy credentials or unrelated caches. Set `host_config_dir` to one of those directory names, then run this for each required directory.

```bash
cd "$git_root"
fd -H -I -t d --glob "$host_config_dir" --exclude node_modules --exclude .git \
  | while read dir; do
      mkdir -p "$worktree_dir/$dir"
      cp -r "$dir/." "$worktree_dir/$dir/"
    done
```

### .env files

If `.env`, `.env.local`, or similar environment files exist, ask the user whether to copy them.

## Step 6: Ask for additional needs

Ask the user if they need anything else:

- Use a specific branch as base instead of the default branch
- Additional files or directories to copy
- Commands to run immediately after setup

## Step 7: Report completion

| Item | Value |
|------|-------|
| Path | /full/path/to/worktree |
| Branch | feature/login-page |
| Base | main (abc1234) |
| Dependencies | Installed (pnpm) |

## Notes

- Do NOT change the current working directory after creation (no `cd`)
- Worktree removal is handled by `/stylish-git:cleanup-branch`
