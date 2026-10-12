import type { TaskRow } from '../types'
import { plain, tidy } from './text'

export const TOOL_NAME = 'task'

/** `movedTo` names the team whose board took these tasks over; a process that reads it uses that board instead. */
export type Board = { version: 1; nextId: number; tasks: BoardTask[]; movedTo?: string }
export type BoardTask = TaskRow & { description?: string; updatedAt: number }

export type TaskAction = {
  action: 'create' | 'update' | 'list' | 'delete'
  subject?: string
  description?: string
  taskId?: string
  status?: TaskRow['status']
  owner?: string
  blockedBy?: string[]
}

export const TOOL_SPEC = {
  name: TOOL_NAME,
  description: [
    'Task list the person watches live above the prompt and in the /teammates pane, so keep it current.',
    'Use it for any work of several steps, alone or with a team: create the steps before starting, move each to in_progress when you begin it and to completed as soon as it is done.',
    'With a team, the lead creates tasks and assigns an owner (a teammate name), and each teammate moves its own tasks.',
    'Actions: create (subject, optional description, owner, blockedBy), update (taskId plus any of status, owner, subject, blockedBy), delete (taskId), list.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'update', 'list', 'delete'] },
      subject: { type: 'string', description: 'Short imperative title' },
      description: { type: 'string' },
      taskId: { type: 'string', description: 'Id from create or list, without the #' },
      status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
      owner: { type: 'string', description: 'Teammate name that owns the task' },
      blockedBy: { type: 'array', items: { type: 'string' }, description: 'Ids that must complete first' },
    },
    required: ['action'],
    additionalProperties: false,
  },
  isDeferred: false,
} as const

export const emptyBoard = (): Board => ({ version: 1, nextId: 1, tasks: [] })

const SUBJECT_MAX = 120
const DESCRIPTION_MAX = 2000
const STATUSES: readonly string[] = ['pending', 'in_progress', 'completed']
const isId = (value: unknown): value is string => typeof value === 'string' && /^\d{1,9}$/.test(value)
/** An owner is a teammate name, and it is read back to every agent on the board. */
const isOwner = (value: unknown): value is string => typeof value === 'string' && /^[\w.-]{1,64}$/.test(value)
const ids = (value: unknown) => (Array.isArray(value) ? value.map(id => (typeof id === 'string' ? id.replace(/^#/, '') : id)).filter(isId) : [])

/** The file is shared with other processes: an entry is kept only in the shape the board draws. */
function toTask(value: unknown): BoardTask | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const one = value as Record<string, unknown>
  if (!isId(one.id) || typeof one.subject !== 'string' || typeof one.status !== 'string') return undefined
  if (!STATUSES.includes(one.status)) return undefined
  const subject = tidy(one.subject, SUBJECT_MAX)
  if (subject === '') return undefined
  return {
    id: one.id,
    subject,
    description: typeof one.description === 'string' ? plain(one.description).slice(0, DESCRIPTION_MAX) : undefined,
    status: one.status as TaskRow['status'],
    owner: isOwner(one.owner) ? one.owner : undefined,
    blockedBy: ids(one.blockedBy),
    updatedAt: typeof one.updatedAt === 'number' ? one.updatedAt : 0,
  }
}

/** A board read for writing: `undefined` for text that is not a board, so it is never overwritten. */
export function readBoard(text: string | undefined): Board | undefined {
  if (text === undefined) return emptyBoard()
  try {
    const value = JSON.parse(text) as Partial<Board>
    if (value.version !== 1 || !Array.isArray(value.tasks)) return undefined
    const tasks = value.tasks.map(toTask).filter((task): task is BoardTask => task !== undefined)
    const top = tasks.reduce((max, task) => Math.max(max, Number(task.id)), 0)
    const nextId = typeof value.nextId === 'number' && Number.isInteger(value.nextId) ? value.nextId : 1
    return { version: 1, nextId: Math.max(nextId, top + 1), tasks, ...(isTeamName(value.movedTo) ? { movedTo: value.movedTo } : {}) }
  } catch {
    return undefined
  }
}

/** A board read for drawing: text that is not a board draws as an empty one. */
export const parseBoard = (text: string | undefined): Board => readBoard(text) ?? emptyBoard()

/** Applies one action; returns the next board and the line the model reads back. */
const BAD_OWNER = 'owner must be a teammate name (letters, digits, ".", "_" or "-").'
const status = (value: unknown) => (typeof value === 'string' && STATUSES.includes(value) ? (value as TaskRow['status']) : undefined)
const describe = (value: unknown) => (typeof value === 'string' ? plain(value).slice(0, DESCRIPTION_MAX) : undefined)

/** The input is whatever a model sent: every field is checked again here, not trusted from the schema. */
export function applyAction(board: Board, input: TaskAction, now: number): { board: Board; reply: string } {
  const strip = (id: unknown) => (typeof id === 'string' ? id.replace(/^#/, '') : undefined)
  const find = (id: string | undefined) => board.tasks.find(task => task.id === strip(id))

  switch (input.action) {
    case 'create': {
      const subject = tidy(String(input.subject ?? ''), SUBJECT_MAX)
      if (!subject) return { board, reply: 'create needs a subject.' }
      if (input.owner !== undefined && !isOwner(input.owner)) return { board, reply: BAD_OWNER }
      const task: BoardTask = {
        id: String(board.nextId),
        subject,
        description: describe(input.description),
        status: status(input.status) ?? 'pending',
        owner: input.owner,
        blockedBy: ids(input.blockedBy),
        updatedAt: now,
      }
      return {
        board: { ...board, nextId: board.nextId + 1, tasks: [...board.tasks, task] },
        reply: `Created #${task.id} ${task.subject}.`,
      }
    }
    case 'update': {
      const task = find(input.taskId)
      if (task === undefined) return { board, reply: `No task #${strip(input.taskId) ?? '?'}.` }
      if (input.owner !== undefined && !isOwner(input.owner)) return { board, reply: BAD_OWNER }
      const next: BoardTask = {
        ...task,
        subject: (input.subject === undefined ? '' : tidy(String(input.subject), SUBJECT_MAX)) || task.subject,
        description: describe(input.description) ?? task.description,
        status: status(input.status) ?? task.status,
        owner: input.owner ?? task.owner,
        blockedBy: input.blockedBy === undefined ? task.blockedBy : [...new Set([...task.blockedBy, ...ids(input.blockedBy)])],
        updatedAt: now,
      }
      return {
        board: { ...board, tasks: board.tasks.map(one => (one.id === task.id ? next : one)) },
        reply: `Updated #${next.id} ${next.subject}: ${next.status}${next.owner ? ` @${next.owner}` : ''}.`,
      }
    }
    case 'delete': {
      const task = find(input.taskId)
      if (task === undefined) return { board, reply: `No task #${strip(input.taskId) ?? '?'}.` }
      return { board: { ...board, tasks: board.tasks.filter(one => one.id !== task.id) }, reply: `Deleted #${task.id}.` }
    }
    case 'list':
      return { board, reply: listText(board) }
  }
}

export function listText(board: Board): string {
  if (board.tasks.length === 0) return 'The board is empty.'
  return board.tasks
    .map(task => {
      const owner = task.owner ? ` @${task.owner}` : ''
      const blocked = task.blockedBy.length > 0 ? ` (blocked by ${task.blockedBy.map(id => `#${id}`).join(', ')})` : ''
      return `#${task.id} [${task.status}] ${task.subject}${owner}${blocked}`
    })
    .join('\n')
}

export const toRows = (board: Board): TaskRow[] =>
  board.tasks.map(({ id, subject, status, owner, blockedBy }) => ({ id, subject, status, owner, blockedBy }))

export type TeamConfig = { leadSessionId?: string; members?: { tmuxPaneId?: string }[] }

/** A team name becomes a file name, so it may not carry a path. */
export const isTeamName = (name: string | undefined): name is string =>
  name !== undefined && /^[\w-][\w.-]*$/.test(name)

export const boardFile = (home: string, team: string) => `${home}/.claude/stylish-teammates/boards/${team}.json`

/** The board in use, starting from `team` and following each board that was left for another. */
export async function settle(team: string, load: (team: string) => Promise<string | undefined>): Promise<string> {
  const seen = new Set<string>()
  let name = team
  while (!seen.has(name)) {
    seen.add(name)
    const next = readBoard(await load(name))?.movedTo
    if (next === undefined) break
    name = next
  }
  return name
}
