---
name: cleanup-branch
description: Clean up merged and stale branches from local and remote
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

Clean up branches that have been merged or are no longer needed.
Handles squash merges correctly and cleans up associated worktrees.

## Use Case

- Remove merged feature branches after PR merge (including squash merge)
- Clean up stale branches that haven't been used
- Clean up orphaned git worktrees
- Keep repository tidy with minimal branch clutter

## Process

1. **Fetch latest**: `git fetch --prune origin`
2. **Check worktrees**: `git worktree list` to find associated worktrees
3. **Detect merged branches**: Use `gh` CLI for accurate squash merge detection
4. **Show preview**: List branches and worktrees to be deleted
5. **Confirm with user**: Ask before deletion
6. **Delete**: Remove worktrees first, then branches

## Branch Detection

### Step 1: Check gh CLI availability

```bash
command -v gh &>/dev/null && gh auth status &>/dev/null
```

### Step 2a: With gh CLI (preferred)

For each local branch (excluding protected), check if its PR was merged:

```bash
gh pr list --head <branch> --state merged --json number,title --limit 1
```

- Returns results → branch's PR was merged (works for squash merge, rebase merge, merge commit)
- Returns empty → branch has no merged PR, skip unless stale

### Step 2b: Without gh CLI (fallback)

List all non-protected local branches and show to user for manual selection.
Use `git branch -D` (force delete) since `git branch -d` cannot detect squash merges.

### Step 3: Stale Branch Detection (Optional)

Branches with no commits in 30+ days and no merged PR:
```bash
git for-each-ref --sort=-committerdate --format='%(refname:short) %(committerdate:relative)' refs/heads/
```

## Worktree Cleanup

Before deleting any branch, check for associated worktrees:

```bash
git worktree list --porcelain
```

If a target branch has a linked worktree:
1. Show the worktree path to user
2. Ask for confirmation
3. Run `git worktree remove <path>` (or `--force` if dirty)
4. Then proceed with branch deletion

Also detect orphaned worktrees (worktree directory missing):
```bash
git worktree prune
```

## Safety Features

- **Protected branches**: Never delete main, master, develop
- **Current branch**: Never delete the branch you're on
- **Worktree check**: Always check and clean worktrees before branch deletion
- **Preview first**: Always show what will be deleted before doing it
- **User confirmation**: Require explicit yes before deletion
- **Remote caution**: Extra confirmation for remote branch deletion
- **Dirty worktree**: Warn if worktree has uncommitted changes, require explicit force

## Execution Steps

1. Run `git fetch --prune origin` to sync
2. Run `git worktree prune` to clean orphaned worktree references
3. Detect default branch (main or master)
4. Check `gh` CLI availability
5. Find merged branches:
   - With `gh`: iterate local branches, check `gh pr list --head <branch> --state merged`
   - Without `gh`: list all non-protected branches for user selection
6. Run `git worktree list --porcelain` to find worktrees linked to target branches
7. Show preview to user (branches + worktrees)
8. Ask for confirmation
9. Delete in order:
   - Worktrees: `git worktree remove <path>`
   - Local branches: `git branch -D <branch>`
   - Remote branches (if --remote): `git push origin --delete <branch>`

## Examples

**Basic cleanup (with gh):**
```
/stylish-git:cleanup-branch
→ Fetching and analyzing branches...
→ Checking merged PRs via GitHub...
→ Found 3 merged branches:

  Merged PR (squash/merge):
  - feature/add-button (#42)
  - feature/fix-header (#38)
  - bugfix/typo (#45)

  Protected (skipped):
  - main
  - develop

→ Delete these 3 local branches? (y/n)
→ Deleted 3 branches ✅
```

**With worktree cleanup:**
```
/stylish-git:cleanup-branch
→ Fetching and analyzing branches...
→ Found 2 merged branches:

  Merged PR:
  - feature/add-button (#42)
  - feature/new-page (#50)

  Linked worktrees:
  - feature/new-page → ~/projects/repo-feature-new-page

→ Delete 2 branches and 1 worktree? (y/n)
→ Removed worktree: ~/projects/repo-feature-new-page
→ Deleted 2 branches ✅
```

**Without gh CLI (fallback):**
```
/stylish-git:cleanup-branch
→ gh CLI not available, showing all non-protected branches
→ Local branches:
  1. feature/add-button (3 days ago)
  2. feature/old-experiment (30 days ago)
  3. bugfix/typo (1 day ago)

→ Enter branch numbers to delete (e.g. 1,2): 1,2
→ Deleted 2 branches ✅
```

**With remote cleanup:**
```
/stylish-git:cleanup-branch --remote
→ Found 5 merged branches:

  Local:
  - feature/add-button (#42)
  - feature/fix-header (#38)

  Remote:
  - origin/feature/old-feature
  - origin/feature/completed-work
  - origin/bugfix/fixed

→ Delete 2 local + 3 remote branches? (y/n)
→ Deleted 5 branches ✅
```

**Nothing to clean:**
```
/stylish-git:cleanup-branch
→ Fetching and analyzing branches...
→ No merged branches found ✅
→ Repository is clean
```
