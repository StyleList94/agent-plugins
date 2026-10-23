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
- **which alternatives were considered and rejected**, and why
- **what was deliberately left alone**, and what the merge or deploy depends on

That material exists only in the working session. Most of what a session holds is not that material: test runs, probe counts, tables of what was checked, the order in which things were found. The session is where the body's content is found, not a record to transcribe.

> **The session is the primary input. Git is the check.** Use the log and the diff to confirm the body is complete and accurate - never as the source it is derived from.

A skill that reads only git cannot escape producing a list of changes, and the diff already shows that list.

**Corollary - run this while the reasoning is still in hand**, before the branch is wrapped up, not as a final step that re-derives everything from the log. Once only the log remains, the cause and the rejected alternatives are gone. This is the same constraint as the `commit` skill's "draft the review-surface description first": this body is where the reasoning lives, and with no home it gets parked in commit messages instead.

## What gets in: one test

Every sentence of the body passes one test: **delete it - would the reviewer then ask a question, or decide differently** (approve, merge now, deploy in another order)? If neither, it goes. Whatever the diff, the commit list or the CI checks already show fails by construction:

- test counts and pass totals - the checks show them
- verification tables, probe counts, measurements - unless the number is the cause of the change
- lists of changes per file or per commit
- the title restated as the first sentence
- progress tracking (unverified, unfinished and undecided items) - open work goes to a ticket

A runtime check CI cannot show - the failure reproduced before the change and not after - is one clause in part 1, never a section of its own.

## Written for a person skimming

Assume the reader is a person with thirty seconds. Bots and automated reviewers read the body too, and they are not a licence for length: a body padded because "only an agent reads it" is the failure this skill exists to prevent, and a short body serves the bots as well.

- The first one to three sentences say what was done and why. A reader who stops there can decide.
- Length follows the size and risk of the change. A small fix is a few lines. Explanation that keeps growing belongs in a code comment or a document the body links to.

## Shape

One shape for every PR. **Do not branch on feature / fix / chore.** Type detection is unreliable, and a per-type template forces empty slots to be filled.

### 1. What was done and why - one to three sentences

For most PRs this is the entire body. Write it and stop.

Where the work is a set of distinct mechanism changes that prose cannot carry, this part may be a short list - at the level of **mechanism**, never of file or commit.

### 2. What the diff cannot show - only when it exists

Four optional slots, each one or two lines. Each fills on its own or stays empty. **Never prompt for one that is absent, and never emit an empty heading or "N/A".** Omit the whole part when no slot has content. A slot's content passes the same test as every other sentence.

A filled slot is a section: its label as a `##` heading (`## 원인` or `## Cause`), then one or two lines or a short list. `##` is the top level under the PR title, the level a bot's appended block (`## Summary by ...`) uses, and GitHub rules a line under it; a bold label or a `###` heading barely stands out from the body and does not read as a section. The labels are fixed, so the same question reads the same way in every PR. Part 1 takes no heading: it opens the body, and a reader who stops there has what they need.

Put a blank line before and after each heading and between paragraphs. Lines that are not separated by a blank line join into one paragraph on GitHub.

| Slot | Label (ko / en) | Content |
|---|---|---|
| cause | 원인 / Cause | what produced this behavior, as a chain |
| judgment | 판단 / Approach | why this approach, and the alternative rejected |
| scope | 범위 / Scope | what is affected, and what was deliberately left unchanged |
| rollout | 배포 / Rollout | manual steps, a deploy order inside this PR, a rollback that is not a plain revert, what to watch after deploy and where. Never the order against other PRs: that opens the body (part 3) |

Rollout is read by whoever merges and deploys: a wrong merge time can break production, so it stays even when no reviewer would ask. A plain revert is always the rollback and is never written.

### 3. Shapes decided by a signal, not by a type

These follow from something checkable, so they need no type guess:

- **The repository has a PR template** (`.github/pull_request_template.md` or similar, read fresh each time). Use its headings and answer only the items that apply. Remove placeholder text, warning blocks and checklist items that do not apply; never leave a template untouched.
- **The PR is one of a series, or depends on another PR.** The body's first sentence names the PRs that must go out first and what breaks if the order slips, The rollout slot does not repeat it. Do not copy the earlier PR's reasoning; link it.
- **A revert.** One line of why, and the PR it reverts.
- **A release or deploy PR.** Steps, how to confirm, how to roll back. Nothing else.

### Rules

- **Brevity is what this skill sells.** The forge already lists the commits. What earns this body its place is the handful of things only the session knows. A large template creates pressure to fill it, and that pressure is what produces padded bodies.
- **No section without content.** A heading with nothing under it, or "N/A", is never written.
- **No per-change bullet list**, no per-file table, no per-commit section, no "N commits" heading. The diff and the commit list show what changed.
- **Nothing from the working session.** No session links, commit SHAs, rebase narration, run IDs, names of the agents or tools that reviewed or verified, test counts, or raw measurements. A number stays only when it is the reason for the change.
- **No promises.** "Will be handled later" goes to a ticket, not the body.
- **Only the language follows the repository.** Write in the language the `commit` skill's script reads. Register and wording are fixed, not copied from merged PRs: in Korean, 합니다체 sentences in the body (the title is a commit subject and stays 한다체, step 3); in English, plain declarative sentences; slot labels from the table above. Never carry the register of the conversation into the body. Talk to the user in their own language.
- **Writing in Korean.** Korean sets the grammar of the sentence, not the language of every noun.
  - Keep technical terms, product and tool names, and identifiers in their original spelling. Never transliterate them into Hangul or translate them.
  - Attach a particle directly to an English word or code span, with no space.
  - One claim per sentence, with its reason in one clause (`~라서`, `~므로`). No scaffolding such as `~하기 위해서입니다`, `~로 봤습니다` or `~하도록 했습니다`.
- **References.** Another repository's PR is `owner/repo#N`; a bare `#N` links this repository's PR of that number. Link a ticket once; forge integrations often add their own link. Never silently backtick an `@` that looks like an intended mention - ask.

## Step 1: Gather context

```bash
branch=$(git rev-parse --abbrev-ref HEAD)
default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo main)

git log --oneline "origin/${default_branch}..HEAD"
git diff --stat "origin/${default_branch}...HEAD"
git diff "origin/${default_branch}...HEAD"
```

If `branch` equals `default_branch`, or nothing is ahead, stop and say so.

Read the diff to **check** the body you are about to write: everything user-visible in it should be accounted for, and nothing in the body should contradict it. Do not derive the body from it. A condition or rule the body lists must match the code exactly.

Then read the two things the repository decides: whether it has a PR template, and the language.

```bash
ls .github .github/PULL_REQUEST_TEMPLATE docs 2>/dev/null | grep -i 'pull_request_template'
bash "<loaded-skill-directory>/../commit/scripts/commit-profile.sh"
```

The script is the sibling `commit` skill's; it reports the language and the merge settings step 3 needs. Merged PR bodies are not read: their form is not the convention.

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

## Step 3: Build the title in the commit convention

The title is a subject in the `commit` skill's Layer 1 convention: `type(scope): description [KEY-123]`, in the language from step 1.

- The type is the one that covers the branch as a unit; a branch that needs two types is two PRs
- A scope only when the whole branch stays inside one app, package or module
- Never append a `(#N)` reference - the merge adds it
- The branch's ticket key always ends the title; the branch's other commit subjects carry none (`commit` rule 5)
- The description keeps the subject's register: in Korean 한다체, never the body's 합니다체
- When a one-commit branch's subject and this title differ, correct the one that breaks the convention; never bend a correct one toward the other

**Measure how the branch will land** rather than assuming squash:

```bash
git log -n 400 --pretty=format:'%p' | awk '{c[NF]++} END {for (k in c) printf "%s-parent: %d\n", k, c[k]}'
```

Nearly all 1-parent means the branch is squashed or rebased, so this title becomes the whole branch's entry in the history and must cover the branch as a unit. Check the squash settings the `commit` skill reports: where a single-commit PR takes its commit's subject as the mainline title, a one-commit branch needs a commit subject equal to this title, or the title never reaches the history. A substantial share of 2-parent commits means the individual commits survive and the title names the merge. A repo may be mixed; when it is, write the title as if it will be squashed.

## Step 4: Write the body, then cut it

Follow the shape above, in the language from step 1 and the fixed register. Include only the parts that have content.

Then make a separate pass over the finished draft before dispatch: put every sentence through the test in "What gets in", and delete each one that fails. Writing and cutting are two passes; a draft checked only while it is being written keeps what it was written with. In update mode the pass covers the whole body, not only the new part.

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

  Rewrite the body to describe the branch as it is now. Never append a round of changes, a "review response" section or a strike-through correction. Re-check the title, every claim against the current diff, and the state of any PR the body references. Keep blocks a bot appended to the body (a generated summary between its markers) as they are.

  ```bash
  gh pr edit --title "$title" --body "$body"
  ```

  If the user declines, fall back to copy mode so they can merge the changes by hand.

Report the PR URL.

## Notes

- This skill writes a summary and, with approval, opens or updates a PR. It never commits and never merges.
- Title and body follow fixed conventions; only their language is read from the repository.
