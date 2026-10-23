---
name: commit
description: Write a commit message in a fixed Conventional Commits form - only the language is read from the target repository
tools: Bash, Read, Grep
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

# Commit

Write the commit message for the staged changes.

Two layers, answering different questions:

| Layer | Question | Source |
|---|---|---|
| **Convention** | What does a commit look like? | Fixed by this skill: Conventional Commits 1.0.0, extended below |
| **Invariant** | What belongs *in* a commit rather than somewhere else? | Argued from how the history is consumed |

**The form does not follow the repository's history.** A history accumulates whatever its authors and their tools wrote, and copying it reproduces the worst of it. The repository decides two things only: the **language** of the message, and **what survives the merge** (Layer 2 rule 1). A rule the repository enforces mechanically (a commit linter, a CI check on PR titles) outranks this convention, because a message it rejects never lands.

## Layer 1 - The convention

```text
type(scope): description [KEY-123]
```

### 1. type - one from this list

| type | when |
|---|---|
| `feat` | a behavior a user or consumer can use is added |
| `fix` | a wrong behavior is corrected |
| `perf` | same behavior, faster or lighter |
| `refactor` | same behavior, different structure |
| `test` | tests only |
| `docs` | documentation or comments only |
| `build` | build, dependencies, package configuration |
| `ci` | CI workflows |
| `chore` | maintenance that fits none of the above, formatting included |
| `revert` | a revert |

A change that fits two types is two commits. There is no `style`: the word reads as a stylesheet change, so formatting-only work is `chore`.

### 2. scope - only when the change stays inside one unit

The name of the one app, package or module the change is confined to, lowercase kebab-case. A change across several has no scope. Never a bracketed path (`[apps/x/y]`) in place of a scope or beside one.

### 3. description - in the repository's language, stating the behavior

The language is the one measured from the repository (below). Everything else about the description is fixed:

- **Korean**: 한다체, a sentence that states the behavior after the change. Never 합니다체, although the body and the PR description are written in it: in a squash repo this subject is also the PR title. Technical terms, product and tool names, and identifiers keep their original spelling, never transliterated into Hangul or translated; a particle attaches to them with no space.
- **English**: imperative, lowercase first letter, no trailing period (`treat an unparsable session as a guest`).
- **Any language**: a description that names no behavior is not one. "리뷰 반영", "lint 수정", "수정", "wip", "address review", "fix lint" and their kind are never subjects.

### 4. length - 50 characters at most

Counted in characters, without the ticket key. Past that, shorten the description or split the commit.

### 5. ticket key - only on a subject that is the title

The ticket key (`ABC-123`, read from the branch name) belongs to the title of the merged change: the PR title, or the mainline subject that takes its place. End that subject with ` [ABC-123]`. One key only, never in a `Refs:` footer, because a squash that drops bodies drops footers with them.

Other branch commits carry no key. Where subjects survive as lines under the squash title, or as commits behind a merge commit, the title already ties them to the ticket, and a key on every line is noise. A commit carries the key only when its subject can itself become the title:

- the branch's first commit, in a repository where a one-commit PR's subject becomes the mainline subject (Layer 2 rule 1)
- every commit, where there is no review surface (Layer 2 rule 5), because each one lands on the mainline as written

### 6. footers - none written by hand

No `BREAKING CHANGE` footer and no `!` marker: nothing here reads them to compute a version, and what a breaking change requires of others is rollout content for the PR description. The only trailer is the co-author line the committing tool adds. Never a session link or session trailer.

### 7. body language and `(#N)`

A body (Layer 2 decides whether there is one) is written in the measured language; in Korean, 합니다체. The register applies to the body only; the subject stays 한다체 (rule 3). Never append `(#N)`: the merge adds it, and at commit time the number does not exist.

## Reading the repository

```bash
bash "<loaded-skill-directory>/scripts/commit-profile.sh"
```

It reports two things: the **language** of the repository's human commit subjects, and its **merge settings**. Nothing else in the history is read, because nothing else decides anything.

- **Language**: write in the majority language of the subjects. Below 5 human subjects there is no majority to read; ask the user which language to use.
- **Merge settings**: Layer 2 rule 1 reads them.

`-n` changes the sample size; `-x '<author regex>'` excludes a bot the default filter missed; `-s '<subject regex>'` excludes commits a tool generated under a human's name.

**The measurement lives in a script, and has to stay there.** A skill body is rewritten by
slash-command argument substitution before it reaches you: a `$` followed by a digit is replaced
with the words the user passed. awk field references have exactly that shape, so inlining awk here
means any invocation carrying arguments corrupts the programs *and* swallows the user's request.
Script files are not substituted. Do not move awk back into this file.

**Pitfalls the script encodes:**

- **Bots and tools decide the language if they are counted.** An English release bot or a generator that commits under a person's name can outnumber the people. The author filter catches common bot names; the author histogram and the repeated-shapes list are printed so you can re-run with `-x` or `-s`.
- **Merge commits.** `--no-merges` is not optional - nobody wrote those subjects.
- **What survives the merge is a repository setting, not a history fact.** The history cannot show that branch bodies were dropped, because they are simply absent. The script reads the forge's merge settings; when it cannot, say so rather than inferring them, and fall back to parent counts only for whether branch commits survive as commits.
- **Never pass a regex through `awk -v`.** `-v` runs escape processing over the value, so `\[` arrives as `[` and the pattern silently widens. The bot filters are awk regex literals; the caller-supplied patterns come in through `ENVIRON`.

## Layer 2 - Invariants

Layer 1 fixes the form. These decide what goes where, hold in any repository, and each is argued from mechanics rather than taste.

### 1. Know what of this commit survives the merge

Read the merge settings the script reports. They decide who ever reads a branch commit:

| Setting | Subject | Body |
|---|---|---|
| merge commit or rebase | survives as written | survives |
| squash, message = commit messages, PR of one commit | becomes the mainline subject; the PR title is ignored | survives |
| squash, message = commit messages, PR of several commits | survives forever as a `* subject` line under the PR title | dropped |
| squash, message = PR body or blank | dropped | dropped |

Two consequences follow, and both are about the subject:

- **Where subjects survive, every subject is permanent history.** "address review", "fix lint", "wip", a revert and its revert all land on the mainline as lines of the squash. Write a subject that states a behavior, and fold a follow-up into the commit it corrects before the branch is pushed (`commit --amend`, or `commit --fixup` + `rebase --autosquash`). After a push, never rewrite; batch the next fixes into one commit.
- **Where a single commit becomes the mainline subject, write that subject as the PR title.** A PR title that differs from it never reaches the history.

A body is written for a reader who will see it. Where bodies are dropped, a constraint the next editor must keep goes into a code comment beside the code it constrains, or into the PR description - never only into the commit.

### 2. A commit is one change a reviewer reads as one story

A task, or one round's fixes to one area. Never one commit per finding, per tweak, or per message: a fix minutes after a commit belongs in that commit or in the next one. Do not fold unrelated areas together to cut the count either - two areas, two commits.

### 3. Never write a bullet list of the sub-changes

Whichever merge style the repo uses, that list carries no information:

- **Squash repo** - the subjects of the branch are what the merge keeps, if it keeps anything. A list in the body restates them or is thrown away.
- **Merge-commit or rebase repo** - those commits are already in the history, individually. The list duplicates them.

There is no repo shape in which the reader gains something `git log` would not already give them.

### 4. A body only when there is a constraint to preserve, about three lines

A surviving commit body is read at `git blame` time, not at review time. Its reader is someone about to change this code, asking what they must not break. So write a body only when such a constraint exists and rule 1 says the body survives:

- an ordering or timing requirement the diff does not show
- an upstream bug or API limitation being worked around
- a deliberate trade-off a future editor would otherwise "fix" back

If nothing in that class exists, the subject alone is the entire message. Deploy steps (merge order, manual teardown, a switch to flip) are review-time content: they go to the PR description even when they also appear here.

### 5. Evidence is not commit content - and does not move to the PR wholesale

Measurements, sample sizes, test counts and verification output are working material, not record. They stay out of the commit. Moving them into the PR description instead is the same mistake one place over: the PR keeps only what passes its own test (a cause, a rejected alternative, a deploy step), and the rest is dropped. A number survives only when it is the reason for the change.

**With no review surface** the commit is the only record: the cause, the rejected alternative and any deploy step stay in the commit body. Raw measurements and test counts still do not. Detect it:

```bash
[ -d .github ] || [ -d .gitlab ] || git log -n 200 --pretty=format:'%s' | awk '/\(#[0-9]+\)$|![0-9]+$/'
```

### 6. Draft the review-surface description before committing

This is the actual mechanism behind bloated commit messages: at commit time the PR does not exist yet, so the reasoning has nowhere to go and gets parked in the commit. Give it a home first, and the commit ends up short because everything else already has a place. Skip when there is no review surface (rule 5).

### 7. Nothing from the working session

A commit outlives the session that wrote it. Keep out of subjects, bodies and trailers: names of agents, reviewers or tools that found a problem, internal task or finding IDs, session links or session trailers, and verification narration. Reference another repository's PR as `owner/repo#N`; a bare `#N` links this repository's PR of that number.

## Process

1. **Stage selectively.** Read `git status --porcelain`, then stage the files this task actually
   changed, naming each path. Never `git add -A` and never `git add .` - a working session leaves
   stray untracked files behind (tool and MCP configuration, editor state, scratch output), and a
   blanket add sweeps them into the commit. Report anything you deliberately left unstaged so the
   user can see what was excluded and why.
2. `git diff --staged`. If it is empty, stop and say so.
3. Run the script and report the language and what survives the merge before proposing anything.
4. Compose the subject by Layer 1, in the measured language, with the branch's ticket key at the end only when rule 5 says this subject can become the title.
5. Decide the body by Layer 2 - a constraint gets up to about three lines when the body survives, otherwise no body. Never a bullet list.
6. If a review surface exists and this work becomes a PR, draft that description first.
7. Present the message, then the ready-to-run command.

Stage only what this task touched, and never push. Committing is the user's call unless they have already authorized it.

## Output

Report what was read, then the message:

```text
repo: <language> · survives: <subject/body per Layer 2 rule 1>

<subject>

<body, only when a constraint was recorded>
```

Then the commit command in a shell block for the user to run.
