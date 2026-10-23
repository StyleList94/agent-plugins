#!/usr/bin/env bash
# Read the two things the commit convention takes from a repository: the language
# of its human commit subjects, and what of a branch commit survives the merge.
#
# Lives in a script rather than in SKILL.md on purpose: skill bodies are passed
# through slash-command argument substitution, which rewrites every $0..$9 it
# finds. awk field references are exactly that shape, so an invocation carrying
# arguments would silently replace $1/$2 with the argument text and the
# measurements would come back plausible and wrong. Script files are not
# substituted.
#
# Usage: commit-profile.sh [-n SAMPLE] [-x EXTRA_BOT_REGEX] [-s TOOL_SUBJECT_REGEX]
#   -n  commits to sample (default 400)
#   -x  additional author-name regex (POSIX ERE) to exclude, for bots the
#       default filter misses. Read the author histogram below and re-run with
#       it when one shows up.
#   -s  subject regex (POSIX ERE) to exclude, for commits a tool generates under
#       a human's name. Read the repeated-shapes list below and re-run with it
#       when one shows up.

set -u

N=400
export EXTRA_BOT=''
export TOOL_SUBJ=''

while getopts ':n:x:s:' opt; do
  case "$opt" in
    n) N=$OPTARG ;;
    x) EXTRA_BOT=$OPTARG ;;
    s) TOOL_SUBJ=$OPTARG ;;
    *) echo "usage: $(basename "$0") [-n SAMPLE] [-x EXTRA_BOT_REGEX] [-s TOOL_SUBJECT_REGEX]" >&2; exit 2 ;;
  esac
done

git rev-parse --git-dir >/dev/null 2>&1 || { echo "not a git repository" >&2; exit 1; }

S=$(mktemp)
trap 'rm -f "$S" "$S.subj" "$S.lang"' EXIT

# The bot filters stay written as awk regex literals. Passing them through
# `awk -v` would run escape processing over the value and turn `\[` into `[`,
# which silently widens the pattern into one that excludes every author.
# Only the caller-supplied patterns are variable, and they arrive via ENVIRON,
# which does no escape processing.

# What survives the merge. A squash can keep every branch subject on the mainline
# while dropping every branch body, so the history alone cannot answer this.
# Printed even for a young repo: its settings are readable before its history is.
merge_settings() {
  if command -v gh >/dev/null 2>&1; then
    # Without admin rights the API leaves these fields null; that is unknown, not "off".
    gh api 'repos/{owner}/{repo}' --jq 'if .squash_merge_commit_message == null then "merge settings     : unreadable (no admin access to the repository settings)" else "merge settings     : squash=\(.allow_squash_merge) merge=\(.allow_merge_commit) rebase=\(.allow_rebase_merge)\nsquash title       : \(.squash_merge_commit_title)\nsquash message     : \(.squash_merge_commit_message)" end' 2>/dev/null \
      || echo "merge settings     : unreadable (no GitHub remote or no access)"
  else
    echo "merge settings     : unreadable (gh not installed)"
  fi
  # Whether branch commits land as commits, for when the settings are unreadable.
  git log -n "$N" --pretty=format:'%p' | awk '{c[NF]++} END {for (k in c) printf "%s-parent: %d\n", k, c[k]}'
}

git log --no-merges -n "$N" --pretty=format:'%an%x09%ae%x09%s' \
  | awk -F'\t' 'BEGIN {ex = ENVIRON["EXTRA_BOT"]; ts = ENVIRON["TOOL_SUBJ"]}
      $1 !~ /\[.*[Bb]ot.*\]|[-_ ][Bb]ot$/ &&
      $2 !~ /\[.*bot.*\]|bot@|actions@github\.com/ &&
      (ex == "" || $1 !~ ex) && (ts == "" || $3 !~ ts)' > "$S"
cut -f3 "$S" > "$S.subj"

T=$(wc -l < "$S" | tr -d ' ')
echo "sample             : $T human commits (of $N scanned)"
echo "authors:"
awk -F'\t' '{print $1}' "$S" | sort | uniq -c | sort -rn | head -5

# Subjects that differ only in a bracketed path or a number are usually a tool's
# output under a human name. Counted, they can decide the language.
echo "repeated shapes (>=3, check for tool output):"
sed -E 's/\[[^]]*\]/[..]/g; s/[0-9a-f]{7,40}/H/g; s/[0-9][0-9.]*/N/g' "$S.subj" | sort | uniq -c | sort -rn | awk '$1>=3' | head -5

# The language is read from subjects whose shape is not repeated: one generator
# committing in English under a person's name can otherwise outvote every person.
sed -E 's/\[[^]]*\]/[..]/g; s/[0-9a-f]{7,40}/H/g; s/[0-9][0-9.]*/N/g' "$S.subj" | paste - "$S.subj" \
  | awk -F'\t' '{n[$1]++; l[NR]=$0} END {for (i=1;i<=NR;i++) {split(l[i],f,"\t"); if (n[f[1]]<3) print f[2]}}' > "$S.lang"
L=$(wc -l < "$S.lang" | tr -d ' ')
if [ "$L" -lt 5 ]; then
  echo "language           : unreadable (below 5 human subjects); ask the user"
else
  LC_ALL=C awk -v t="$L" '/[\200-\377]/ {n++} END {printf "non-ascii subjects : %d%% of %d  -> %s\n", 100*n/t, t, (n*2 > t ? "write in the language of the non-ASCII subjects below" : "write in English")}' "$S.lang"
  # Read for the language only. Their form is not the convention.
  echo "recent subjects (language only):"
  head -3 "$S.lang" | sed 's/^/  /'
fi

merge_settings
