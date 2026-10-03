---
name: squash
description: Squash commits on branch into one, with a message in the repository's own voice
argument-hint: "[N]"
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

# Squash Commits

Squash multiple commits into a single commit.

## Use Case

- Clean up commits before PR merge
- Combine multiple WIP commits into one
- Maintain clean commit history

## Arguments

| Argument | Description                          | Default |
|----------|--------------------------------------|---------|
| (none)   | All commits from base branch         | -       |
| `<N>`    | Squash only last N commits           | -       |

## Commit Message Format

```text
<subject>

<body - only when a constraint must be preserved>
```

**Do not build a body listing the commits being squashed.** The squash is what discards those
messages; writing them back into the body reinstates exactly what the squash removed, and the
individual commits are not reachable afterwards to make the list verifiable. The list carries
nothing a reader could not get from the PR.

Follow the `commit` skill for everything else:

- **Form** - subject language, prefix style, scope usage, case and length come from Layer 1 of
  the `commit` skill, measured against this repository. Do not assume a convention.
- **Body** - only when there is a constraint a future editor of this code must preserve
  (Layer 2, about three lines). Otherwise the subject is the whole message.
- **Evidence** - measurements, verification and alternatives go in the PR/MR description, not
  in the squashed commit.

Because the squashed subject becomes the whole branch's entry in the history, it must cover
the branch as a unit rather than describing whichever commit happened to be last.

## Process

1. **Safety check**: Prevent running on protected branches (main, master, develop)
2. **Detect range**:
   - No argument: Find merge base with `git merge-base origin/<base> HEAD`
   - Numeric argument: Use `HEAD~N`
3. **Show commits**: Display commits to squash (chronological order)
4. **Measure the repo**: Run Layer 1 of the `commit` skill so the subject matches this repo
5. **Get title**: Ask the user for the subject (using AskUserQuestion), offering a measured-form
   suggestion that covers the whole branch
6. **Build message**: Subject alone, plus a constraint body only when one exists
7. **Execute squash**: `git reset --soft <target> && git commit`
8. **Done**: Show push instructions (user pushes manually)

## Execution Steps

1. Get current branch with `git rev-parse --abbrev-ref HEAD`
2. Check if protected branch (main, master, develop)
3. Detect base branch (main or master)
4. Determine squash target:
   - No argument: `git merge-base origin/<base> HEAD`
   - Argument N: `HEAD~N`
5. Show commits with `git log --oneline --reverse <target>..HEAD` (chronological)
6. Measure the repository's commit form (`commit` skill, Layer 1)
7. Ask the user for the subject (using AskUserQuestion)
8. Build the commit message:
   - Subject line
   - A body only when the branch leaves behind a constraint worth recording, about three lines
   - Never a list of the squashed commits
9. Run `git reset --soft <target>`
10. Run `git commit` with HEREDOC for message
11. Show completion message and push instructions

## Safety Features

- **Protected branches**: Never squash on main/master/develop
- **No auto-push**: Only squash, user pushes manually

## Examples

Subjects below are written in the form measured from the example repository. In a repository
with a different measured form, the same skill produces a subject in that form instead.

**Squash all commits:**

```text
/stylish-git:squash

-> Current branch: feature/add-button
-> Base branch: main
-> Commits to squash (3):
   1. abc1234 feat: add button component
   2. def5678 fix: button style
   3. ghi9012 refactor: clean up

-> Measured profile: conventional prefix 97% · scope 5% · lowercase · median 24 / p90 37

-> Enter subject: feat: add button component with styling

-> Squashing...
-> Squashed 3 commits

-> Final commit message:
   +----------------------------------------
   | feat: add button component with styling
   +----------------------------------------

-> Run 'git push --force-with-lease' to update remote
```

**Squash with a constraint worth recording:**

```text
/stylish-git:squash 2

-> Commits to squash (2):
   1. def5678 fix: button style
   2. ghi9012 refactor: clean up

-> Enter subject: fix: improve button styling

-> Final commit message:
   +--------------------------------------------------------------
   | fix: improve button styling
   |
   | The focus ring is drawn with an outline rather than a shadow
   | because the shadow is clipped by the parent's overflow.
   +--------------------------------------------------------------

-> Run 'git push --force-with-lease' to update remote
```

**Protected branch error:**

```text
/stylish-git:squash

-> Error: Cannot squash on protected branch 'main'
-> Switch to a feature branch first
```

**No commits error:**

```text
/stylish-git:squash

-> No commits to squash
-> Current branch has no commits ahead of main
```
