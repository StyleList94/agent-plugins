import type { AgentInfo } from 'claude-code'

import type { AgentRow, TaskRow, WorkEntry } from '../types'
import { masked, plain, tidy } from './text'

export const STALE_MS = 5 * 60_000
export const ENDED_KEEP_MS = 60_000
const MAX_ENDED = 12
const DETAIL_MAX = 48

const LIVE = new Set(['pending', 'running', 'waiting'])
const ENDED = new Set(['completed', 'failed', 'killed', 'gone'])

const MAX_LOG = 20
const MAX_DETAIL = 12

function capped(lines: string[]): string[] {
  if (lines.length <= MAX_DETAIL) return lines
  return [...lines.slice(0, MAX_DETAIL - 1), `… +${lines.length - (MAX_DETAIL - 1)} lines`]
}

/** The lines two texts differ by: what both open and close with is left out. */
export function diffLines(before: string, after: string): string[] {
  const old = before.split('\n')
  const fresh = after.split('\n')
  let head = 0
  while (head < old.length && head < fresh.length && old[head] === fresh[head]) head += 1
  let tail = 0
  while (
    tail < old.length - head &&
    tail < fresh.length - head &&
    old[old.length - 1 - tail] === fresh[fresh.length - 1 - tail]
  ) {
    tail += 1
  }
  return [
    ...old.slice(head, old.length - tail).map(line => `- ${line}`),
    ...fresh.slice(head, fresh.length - tail).map(line => `+ ${line}`),
  ]
}

function callDetail(tool: string, input: Record<string, unknown>): string[] {
  const text = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : undefined)

  if (tool === 'Edit') return diffLines(text('old_string') ?? '', text('new_string') ?? '')
  if (tool === 'MultiEdit' && Array.isArray(input.edits)) {
    return (input.edits as Record<string, unknown>[]).flatMap(one =>
      diffLines(typeof one.old_string === 'string' ? one.old_string : '', typeof one.new_string === 'string' ? one.new_string : ''),
    )
  }
  if (tool === 'Write') return (text('content') ?? '').split('\n').map(line => `+ ${line}`)

  const body = text('command') ?? text('prompt') ?? text('query') ?? text('pattern') ?? text('url')
  return body === undefined ? [] : body.split('\n')
}

export function logCall(log: WorkEntry[], tool: string, input: Record<string, unknown>, at: number): WorkEntry[] {
  const entry: WorkEntry = {
    id: (log[log.length - 1]?.id ?? 0) + 1,
    at,
    label: describeCall(tool, input),
    detail: capped(callDetail(tool, input)).map(line => plain(masked(line))),
  }
  return [...log, entry].slice(-MAX_LOG)
}

/** The entry the pane shows in full, and the ids a step back and forward lead to. */
export function logView(log: WorkEntry[], at: number): { index: number; prev?: number; next?: number } {
  const found = log.findIndex(entry => entry.id === at)
  const index = found === -1 ? log.length - 1 : found
  return { index, prev: log[index - 1]?.id, next: log[index + 1]?.id }
}

export const MAIN: AgentRow = { id: 'main', name: 'main', type: 'main', status: 'idle', isTeammate: false, turns: 0, changedAt: 0 }

export const isLive = (status: string) => LIVE.has(status)
export const isEnded = (status: string) => ENDED.has(status)

export function isStale(row: AgentRow, now: number): boolean {
  if (row.status !== 'running') return false
  const since = row.lastToolAt ?? row.changedAt
  return now - since > STALE_MS
}

export function mergeAgents(rows: AgentRow[], list: AgentInfo[], now: number): AgentRow[] {
  const byId = new Map(rows.map(row => [row.id, row]))
  const listed = new Set(list.map(info => info.id))

  const current = list.map((info): AgentRow => {
    const prev = byId.get(info.id)
    return {
      id: info.id,
      name: tidy(info.name ?? info.description ?? info.type, DETAIL_MAX),
      type: info.type,
      status: info.status,
      isTeammate: info.teammateId !== undefined,
      lastTool: prev?.lastTool,
      lastToolAt: prev?.lastToolAt,
      turns: prev?.turns ?? 0,
      changedAt: prev !== undefined && prev.status === info.status ? prev.changedAt : now,
    }
  })

  // The engine drops an agent from its list soon after it ends; keep it for a
  // short while so the board still says what finished, then let it go.
  const departed = rows
    .filter(row => !listed.has(row.id))
    .map(row => (isEnded(row.status) ? row : { ...row, status: 'gone', changedAt: now }))
    .filter(row => now - row.changedAt <= ENDED_KEEP_MS)
    .slice(-MAX_ENDED)

  return [...current, ...departed]
}

export function newlyEnded(before: AgentRow[], after: AgentRow[]): AgentRow[] {
  const was = new Map(before.map(row => [row.id, row.status]))
  return after.filter(row => {
    const prev = was.get(row.id)
    return row.isTeammate && prev !== undefined && !isEnded(prev) && isEnded(row.status)
  })
}

export const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const oneLine = (text: string) => tidy(masked(text), DETAIL_MAX)

function basename(path: string | undefined): string | undefined {
  if (path === undefined) return undefined
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

export function describeCall(tool: string, input: Record<string, unknown>): string {
  const pick = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : undefined)
  const detail =
    pick('command') ??
    basename(pick('file_path')) ??
    pick('pattern') ??
    pick('url') ??
    pick('to') ??
    pick('description')
  const name = tool.startsWith('mcp__') ? tool.split('__').slice(1).join(':') : tool
  return detail === undefined ? name : `${name} ${oneLine(detail)}`
}

type TaskStatus = TaskRow['status']
const TASK_STATUSES: readonly string[] = ['pending', 'in_progress', 'completed']
const asTaskStatus = (value: unknown): TaskStatus | undefined =>
  typeof value === 'string' && TASK_STATUSES.includes(value) ? (value as TaskStatus) : undefined

const TODO_PREFIX = 'todo:'

/**
 * Folds one task-tool call into the board. Task tools share one list across the
 * team; TodoWrite is the lead's own checklist and replaces its rows wholesale.
 */
export function applyTaskCall(
  tasks: TaskRow[],
  tool: string,
  input: Record<string, unknown>,
  result: unknown,
): TaskRow[] {
  const out = (result ?? {}) as Record<string, unknown>

  if (tool === 'TaskCreate') {
    const task = out.task as { id?: unknown; subject?: unknown } | undefined
    if (typeof task?.id !== 'string') return tasks
    const row: TaskRow = {
      id: task.id,
      subject: typeof task.subject === 'string' ? task.subject : String(input.subject ?? task.id),
      status: 'pending',
      blockedBy: [],
    }
    return [...tasks.filter(one => one.id !== row.id), row]
  }

  if (tool === 'TaskUpdate') {
    const id = typeof input.taskId === 'string' ? input.taskId : undefined
    if (id === undefined || out.success === false) return tasks
    if (input.status === 'deleted') return tasks.filter(one => one.id !== id)
    return tasks.map(one => {
      if (one.id !== id) return one
      const blockedBy = Array.isArray(input.addBlockedBy)
        ? [...new Set([...one.blockedBy, ...input.addBlockedBy.filter((x): x is string => typeof x === 'string')])]
        : one.blockedBy
      return {
        ...one,
        subject: typeof input.subject === 'string' ? input.subject : one.subject,
        status: asTaskStatus(input.status) ?? one.status,
        owner: typeof input.owner === 'string' ? input.owner : one.owner,
        blockedBy,
      }
    })
  }

  if (tool === 'TaskList') {
    const listed = Array.isArray(out.tasks) ? (out.tasks as Record<string, unknown>[]) : undefined
    if (listed === undefined) return tasks
    const fresh = listed.flatMap((one): TaskRow[] => {
      const status = asTaskStatus(one.status)
      if (typeof one.id !== 'string' || status === undefined) return []
      return [
        {
          id: one.id,
          subject: String(one.subject ?? one.id),
          status,
          owner: typeof one.owner === 'string' ? one.owner : undefined,
          blockedBy: Array.isArray(one.blockedBy) ? one.blockedBy.filter((x): x is string => typeof x === 'string') : [],
        },
      ]
    })
    return [...tasks.filter(one => one.id.startsWith(TODO_PREFIX)), ...fresh]
  }

  if (tool === 'TodoWrite') {
    const todos = Array.isArray(out.newTodos) ? (out.newTodos as Record<string, unknown>[]) : undefined
    if (todos === undefined) return tasks
    const rows = todos.flatMap((todo, index): TaskRow[] => {
      const status = asTaskStatus(todo.status)
      if (status === undefined) return []
      return [{ id: `${TODO_PREFIX}${index}`, subject: String(todo.content ?? ''), status, blockedBy: [] }]
    })
    return [...tasks.filter(one => !one.id.startsWith(TODO_PREFIX)), ...rows]
  }

  return tasks
}

export function newlyCompleted(before: TaskRow[], after: TaskRow[]): TaskRow[] {
  const was = new Map(before.map(task => [task.id, task.status]))
  return after.filter(task => task.status === 'completed' && was.has(task.id) && was.get(task.id) !== 'completed')
}

export function isBlocked(task: TaskRow, tasks: TaskRow[]): boolean {
  if (task.status === 'completed') return false
  const done = new Set(tasks.filter(one => one.status === 'completed').map(one => one.id))
  return task.blockedBy.some(id => !done.has(id))
}

export function taskLine(task: TaskRow, tasks: TaskRow[]): string {
  const mark = task.status === 'completed' ? '✓' : task.status === 'in_progress' ? '▸' : isBlocked(task, tasks) ? '⊘' : '◌'
  const owner = task.owner === undefined ? '' : ` @${plain(task.owner)}`
  const id = task.id.startsWith(TODO_PREFIX) ? '' : `#${plain(task.id)} `
  return `${mark} ${id}${plain(task.subject)}${owner}`
}

/**
 * The tasks the band lists, in board order. A board that fits is shown whole;
 * a longer one gives up its completed tasks first, then its tail.
 */
export function bandTasks(tasks: TaskRow[], max: number): { rows: TaskRow[]; hidden: number } {
  const open = tasks.length <= max ? tasks : tasks.filter(task => task.status !== 'completed')
  const rows = open.slice(0, max)
  return { rows, hidden: tasks.length - rows.length }
}

export function summary(agents: AgentRow[], tasks: TaskRow[]): string {
  const parts: string[] = []
  const team = agents.filter(row => row.isTeammate)
  const subs = agents.filter(row => !row.isTeammate && !isEnded(row.status))

  if (team.length > 0) {
    const count = (pred: (row: AgentRow) => boolean) => team.filter(pred).length
    const failed = count(row => row.status === 'failed' || row.status === 'killed')
    const done = count(row => row.status === 'completed' || row.status === 'gone')
    const bits = [
      `teammates ${team.length}`,
      `running ${count(row => isLive(row.status))}`,
      `idle ${count(row => row.status === 'idle')}`,
    ]
    if (done > 0) bits.push(`done ${done}`)
    if (failed > 0) bits.push(`failed ${failed}`)
    parts.push(bits.join(' · '))
  }
  if (subs.length > 0) parts.push(`subagents ${subs.length}`)

  if (tasks.length > 0) {
    const done = tasks.filter(task => task.status === 'completed').length
    const active = tasks.filter(task => task.status === 'in_progress').length
    const blocked = tasks.filter(task => isBlocked(task, tasks)).length
    const bits = [`tasks ${done}/${tasks.length} done`]
    if (active > 0) bits.push(`${active} active`)
    if (blocked > 0) bits.push(`${blocked} blocked`)
    parts.push(bits.join(' · '))
  }

  return parts.join('  │  ')
}

export function ago(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.round(minutes / 60)}h`
}

export const GLYPH: Record<string, string> = {
  pending: '◌',
  running: '●',
  waiting: '◐',
  idle: '○',
  completed: '✓',
  failed: '✗',
  killed: '✗',
  gone: '·',
}

export function statusColor(row: AgentRow, now: number): string | undefined {
  if (row.status === 'failed' || row.status === 'killed') return 'error'
  if (isStale(row, now)) return 'warning'
  if (isLive(row.status)) return 'success'
  return undefined
}

export const pad = (text: string, width: number) =>
  text.length >= width ? `${text.slice(0, Math.max(0, width - 1))}…` : text.padEnd(width)
