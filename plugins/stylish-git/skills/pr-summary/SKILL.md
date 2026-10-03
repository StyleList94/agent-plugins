---
name: pr-summary
description: Write a PR body from what the working session knows, then copy it to the clipboard or upload it to the PR (create or update)
argument-hint: "[upload]"
tools: Bash, Read, Grep, AskUserQuestion
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

# PR Summary

Write the pull request body for the current branch, then copy it to the clipboard (default) or upload it (`upload` argument).

## The input is the session, not the branch

`git log` and `git diff` show what changed. They cannot show:

- **the causal chain** - the code is the result, not the reason the result happened
- **what was measured** while working, and what it showed
- **which alternatives were considered and rejected**, and why
- **what else was closed** along the way, or deliberately left alone

That is the material worth reading, and it exists only in the working session.

> **The session is the primary input. Git is the check.** Use the log and the diff to confirm the body is complete and accurate - never as the source it is derived from.

A skill that reads only git cannot escape producing a list of changes, and the diff already shows that list.

**Corollary - run this while the reasoning is still in hand**, before the branch is wrapped up, not as a final step that re-derives everything from the log. Once only the log remains, the cause, the measurements and the rejected alternatives are gone. This is the same constraint as the `commit` skill's "draft the review-surface description first": this body is where the evidence lives, and with no home the evidence gets parked in commit messages instead.

## Shape

One shape for every PR. **Do not branch on feature / fix / chore.** Type detection is unreliable, and a per-type template forces empty slots to be filled.

### 1. What was done and why - one to three sentences

For most PRs this is the entire body. Write it and stop.

Where the work is a set of distinct mechanism changes that prose cannot carry, this part may be a short list - at the level of **mechanism**, never of file or commit.

### 2. What the diff cannot show - only when it exists

Four optional slots. Each fills on its own or stays empty. **Never prompt for one that is absent, and never emit an empty heading or "N/A".** Omit the whole part when no slot has content.

| Slot | Content | Fills for |
|---|---|---|
| cause | what produced this behavior, as a chain | a bug fix |
| judgment | why this approach, and what was rejected | a feature |
| evidence | what was measured or verified this time | anything tested |
| side effects | what else closed, or was left on purpose | an investigation |

The work type decides which slots have content. The skill never needs to know the type.

### Rules

- **Brevity is what this skill sells.** The forge already auto-generates a list of commit subjects. What earns this body its place is the handful of things only the session knows. A large template creates pressure to fill it, and that pressure is what produces padded bodies.
- **No section without content.** Same principle as the `commit` skill's "never invent a convention the repository does not already have".
- **No per-change bullet list.** The diff shows what changed.
- **Language.** Write the body, and its headings, in the user's working language. Communicate with the user in that language too.

## Step 1: Gather context

```bash
branch=$(git rev-parse --abbrev-ref HEAD)
default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo main)

git log --oneline "origin/${default_branch}..HEAD"
git diff --stat "origin/${default_branch}...HEAD"
git diff "origin/${default_branch}...HEAD"
```

If `branch` equals `default_branch`, or nothing is ahead, stop and say so.

Read the diff to **check** the body you are about to write: everything user-visible in it should be accounted for, and nothing in the body should contradict it. Do not derive the body from it.

## Step 2: Check the branch name against the repo's own pattern

Measure the naming actually in use rather than applying a list from elsewhere:

```bash
bash "<loaded-skill-directory>/scripts/branch-prefixes.sh"
```

The aggregation lives in a script because a skill body is rewritten by slash-command argument
substitution before it reaches you - a `$` followed by a digit becomes the words the user passed,
and awk field references have that exact shape. Do not inline awk here.

If the current branch departs from the observed pattern, say so and suggest a name that fits it. **Do not block** - report and continue.

**An empty result is not a finding.** A repository that deletes branches after merge leaves nothing
to measure, so zero prefixes means the convention is *unobservable here*, not that the repository
has none - and in a squash repo the merge commits cannot give the names back either. The script
says this outright rather than printing nothing, because a silent zero-line output reads as an
observation. Recover the pattern from merged PRs before concluding anything about naming:
`gh pr list --state all --json headRefName`.

## Step 3: Build the title in the repository's measured form

Run Layer 1 of the `commit` skill against this repository and write the title in the form it reports: language, prefix style, scope usage, case, and length target. Do not assume a convention the repo does not have.

- If the repo uses a `type` prefix, use the dominant change type across the branch, drawn from the repo's own type vocabulary
- Attach a scope only if the repo scopes its subjects, and only from its existing scope vocabulary
- Never append a `(#N)` reference - the merge adds it

**Measure how the branch will land** rather than assuming squash:

```bash
git log -n 400 --pretty=format:'%p' | awk '{c[NF]++} END {for (k in c) printf "%s-parent: %d\n", k, c[k]}'
```

Nearly all 1-parent means the branch is squashed or rebased, so this title becomes the whole branch's entry in the history and must cover the branch as a unit. A substantial share of 2-parent commits means the individual commits survive and the title names the merge. A repo may be mixed; when it is, write the title as if it will be squashed.

## Step 4: Write the body

Follow the shape above, in the user's working language. Include only the parts that have content.

## Step 5: Detect an existing PR

A PR for this branch may already be open, so the same invocation creates the first time and updates afterward:

```bash
pr_url=$(gh pr view --json url --jq '.url' 2>/dev/null || true)
```

## Step 6: The branch must reach the remote - and that is the user's call

A PR cannot be opened for a branch the remote does not have. **Sending it there is the user's decision, and this skill never makes it silently.** Ask explicitly, and keep working when the answer is no.

First, the upstream guard. A branch created without `--no-track` can end up tracking the default branch, and a bare send would land feature commits on it:

```bash
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)
remote_has=$(git ls-remote --heads origin "$branch" 2>/dev/null)

if [ -n "$upstream" ] && [ "$upstream" != "origin/$branch" ]; then
  echo "STOP: '$branch' tracks '$upstream', not 'origin/$branch'."
  echo "      Sending it would land these commits on '$upstream'."
  echo "      Fix: git branch --unset-upstream   then re-run."
fi
```

Stop on a mismatch and report it - do not continue to the dispatch step.

Otherwise, if `remote_has` is empty or the branch is behind its remote counterpart, show the user the exact command and ask for approval:

```bash
git push -u origin "$branch"      # no upstream yet
git push                          # already tracking origin/$branch
```

If the user declines, or the session cannot ask, **do not send anything**. Fall through to copy mode, hand over the body, and say that the branch still has to reach the remote before a PR can be opened.

## Step 7: Dispatch

**Default - copy mode:**

The title goes on the first line, because in a squashing repo it becomes the commit subject:

```bash
printf '%s\n\n%s\n' "$title" "$body" | pbcopy
```

Print the title separately so it can be pasted into the title field. If `pr_url` is set, point the user at the existing PR; otherwise tell them a new one can be opened.

**`upload` argument:**

Requires the branch on the remote (step 6). If it did not get there, fall back to copy mode.

- No PR yet:

  ```bash
  gh pr create --base "$default_branch" --head "$branch" --title "$title" --body "$body"
  ```

- PR exists: `gh pr edit` **overwrites** the body, discarding manual edits and checked boxes. Show the regenerated title and body and confirm before editing.

  ```bash
  gh pr edit --title "$title" --body "$body"
  ```

  If the user declines, fall back to copy mode so they can merge the changes by hand.

Report the PR URL.

## Notes

- This skill writes a summary and, with approval, opens or updates a PR. It never commits and never merges.
- The title follows the repository's measured commit form; the body follows the user's working language.
