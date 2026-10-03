---
name: commit
description: Write a commit message in the target repository's own voice - conventions measured from its history, never assumed
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

Analyze the staged changes and write a commit message that matches **this repository's** history.

Two layers, answering different questions:

| Layer | Question | Source |
|---|---|---|
| **Observed** | What does a commit here *look like*? | Measured from the repo's own history |
| **Invariant** | What belongs *in* a commit rather than somewhere else? | Argued from how the history is consumed |

Nothing about form is declared in this skill. The governing rule:

> **Never invent a convention the repository does not already have.**

If it does not use scopes, do not attach one. If its subjects run long, do not truncate them to fit a limit borrowed from elsewhere.

## Layer 1 - Measure the repository

### 1. Run the measurement

```bash
bash "<loaded-skill-directory>/scripts/commit-profile.sh"
```

`-n` changes the sample size; `-x '<author regex>'` excludes a bot the default filter missed.

**The measurement lives in a script, and has to stay there.** A skill body is rewritten by
slash-command argument substitution before it reaches you: a `$` followed by a digit is replaced
with the words the user passed. awk field references have exactly that shape, so inlining awk here
means any invocation carrying arguments corrupts the programs *and* swallows the user's request.
It does not error - measured on a 400-commit repo it disabled the bot filter, moved every ratio,
and reported a subject length of `median 0 p90 0`. Script files are not substituted. Do not move
awk back into this file.

**Pitfalls the script encodes. Each of these has produced a wrong reading in practice:**

- **Bots.** A mainline that is half automated version bumps halves every ratio you compute. The filter catches the common naming patterns; the author histogram is printed so you can spot the ones it misses and re-run with `-x`.
- **The filter has to reach every axis, not just the subjects.** Any axis measured by a second, unfiltered `git log` quietly readmits the bots. Measured on a bot-heavy repo, an unfiltered body axis reported a median body of 1 line where the human median was 10 - and a 1-line median is exactly what tells the skill "this repo does not use bodies". The script prints the sample size on both the subject and body axes; if they differ, an axis is unfiltered.
- **Merge commits.** `--no-merges` is not optional - nobody wrote those subjects.
- **Squash detection.** Do not conclude "squash-merged" from a `(#N)` subject suffix. Whether it appears depends on the PR title convention, so it can be absent in a repo that squashes every PR. Use parent counts, and treat `(#N)` as a secondary signal only.
- **Trailers are not a body.** A commit whose body is only `Co-authored-by:` or `Signed-off-by:` lines registers as having one. In a repo that adds a co-author trailer to every squash this reads as near-total body usage with a median of 1 line - the same false signal as an unfiltered bot. They are stripped before deciding a body exists.
- **Never use NUL as an awk record separator.** `RS="\0"` is an empty string to awk, which silently switches it to paragraph mode and splits on blank lines instead. It does not error; it returns a plausible number. It reported 100% body usage against a true 41%. The script uses `\001`.
- **Never pass a regex through `awk -v`.** `-v` runs escape processing over the value, so `\[` arrives as `[` and the pattern silently widens. The bot filters are written as awk regex literals for this reason; the caller-supplied `-x` pattern comes in through `ENVIRON`, which does not.

### 2. Read the axes

What each measurement decides:

| Measurement | Decision |
|---|---|
| non-ascii ratio | the language of the subject - follow the majority, do not translate the repo |
| conventional prefix ratio | whether to use a `type:` prefix at all. Low ratio means the repo writes plain subjects; write one |
| scoped ratio + scope list | whether to attach a scope, and which scope vocabulary actually exists here |
| starts-uppercase, trailing period | capitalization and punctuation |
| length median and p90 | the length to aim for and the ceiling. There is no fixed character limit |
| type list | the type vocabulary. Use what appears; never import types the repo has never used |
| with-body %, median body lines | **one-directional**: if bodies are essentially absent, do not write one. A repo that has bodies does not oblige you to add one - Layer 2 decides that |
| parent counts | how branch work lands. A meaningful share of 2-parent commits means merge commits preserve branch history; nearly all 1-parent means squash or rebase discards it |
| `(#N)` suffix ratio | that suffix is added by the merge, not by the author. **Never fabricate one** - at commit time the number does not exist yet |

### 3. When the sample is too small

Below roughly 20 human commits there is no convention to observe. Say so and ask the user which convention to follow. Do not fill the gap with a default.

## Layer 2 - Invariants

Form belongs to the repository. Placement does not. These four hold in any repository, and each is argued from mechanics rather than taste.

### 1. Never write a bullet list of the sub-changes

Whichever merge style the repo uses, that list carries no information:

- **Squash or rebase repo** - branch commit messages are discarded at merge. The list is written to be thrown away.
- **Merge-commit repo** - those commits are already in the history, individually. The list duplicates them.

There is no repo shape in which the reader gains something `git log` would not already give them.

### 2. A body only when there is a constraint to preserve, about three lines

A commit body is read at `git blame` time, not at review time. Its reader is someone about to change this code, asking what they must not break. So write a body only when such a constraint exists:

- an ordering or timing requirement the diff does not show
- an upstream bug or API limitation being worked around
- a deliberate trade-off a future editor would otherwise "fix" back

If nothing in that class exists, the subject alone is the entire message.

### 3. Evidence goes to the review surface - when one exists

Measurements, sample sizes, verification output, alternatives considered, rollout notes: these are review-time artifacts and belong in the PR/MR description.

**Conditional.** With no review surface the commit is the only record, and this rule is void - keep the reasoning in the commit. Detect it:

```bash
[ -d .github ] || [ -d .gitlab ] || git log -n 200 --pretty=format:'%s' | awk '/\(#[0-9]+\)$|![0-9]+$/'
```

### 4. Draft the review-surface description before committing

This is the actual mechanism behind bloated commit messages: at commit time the PR does not exist yet, so the reasoning has nowhere to go and gets parked in the commit. Give it a home first, and the commit ends up short because everything else already has a place. Skip when rule 3 is void.

## Process

1. **Stage selectively.** Read `git status --porcelain`, then stage the files this task actually
   changed, naming each path. Never `git add -A` and never `git add .` - a working session leaves
   stray untracked files behind (tool and MCP configuration, editor state, scratch output), and a
   blanket add sweeps them into the commit. Report anything you deliberately left unstaged so the
   user can see what was excluded and why.
2. `git diff --staged`. If it is empty, stop and say so.
3. Run Layer 1 against this repository and report the measured profile before proposing anything.
4. Compose the subject in the measured form: language, prefix style, scope usage, case, length target.
5. Decide the body by Layer 2 - a constraint gets up to about three lines, otherwise no body. Never a bullet list.
6. If a review surface exists and this work becomes a PR, draft that description first.
7. Present the message, then the ready-to-run command.

Stage only what this task touched, and never push. Committing is the user's call unless they have already authorized it.

## Output

Report what was measured, then the message:

```text
profile: <language> · <prefix style> · scope <N>% · <case> · length median <M> p90 <P> · <merge style>

<subject>

<body, only when a constraint was recorded>
```

Then the commit command in a shell block for the user to run.
