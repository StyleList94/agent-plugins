const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/g

const SECRET =
  /((?:token|secret|password|passwd|api[-_]?key|authorization)["']?\s*[:=]\s*["']?(?:bearer\s+)?)[^\s"']{6,}|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/gi

/**
 * Text drawn here comes from tool calls, board files other processes write and agent names.
 * Control and direction-override characters are dropped, so an escape sequence in it cannot
 * reach the terminal.
 */
export const plain = (text: string) => text.replace(CONTROL, '')

/** One line of at most `max` characters, safe to draw and to read back to the model. */
export function tidy(text: string, max: number): string {
  const flat = plain(text).replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

/** Commands and file contents are kept for the pane; what looks like a credential is not. */
export const masked = (text: string) => text.replace(SECRET, (_match, lead: string | undefined) => `${lead ?? ''}•••`)
