import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRow, TaskRow } from '../types'
import { TOOL_SPEC, applyAction, boardFile, isTeamName, parseBoard, readBoard, settle, toRows } from './board'
import type { TaskAction, TeamConfig } from './board'
import {
  GLYPH,
  MAIN,
  ago,
  applyTaskCall,
  bandTasks,
  describeCall,
  isBlocked,
  isEnded,
  isLive,
  isStale,
  logCall,
  logView,
  mergeAgents,
  newlyCompleted,
  newlyEnded,
  pad,
  sameValue,
  statusColor,
  summary,
  taskLine,
} from './model'

const PANE = 'teammates'
const POLL_MS = 2000
const BAND_CHIPS = 8
const BAND_TASKS = 5
const LOG_ROWS = 6
const OWN_TOOL = 'mcp__stylish-teammates__task'
const TASK_TOOLS = new Set(['TaskCreate', 'TaskUpdate', 'TaskList', 'TodoWrite'])

const agents = atom({ plugin: 'stylish-teammates', key: 'agents' } as const, [])
const main = atom({ plugin: 'stylish-teammates', key: 'main' } as const, MAIN)
const tasks = atom({ plugin: 'stylish-teammates', key: 'tasks' } as const, [])
const board = atom({ plugin: 'stylish-teammates', key: 'board' } as const, [])
const now = atom({ plugin: 'stylish-teammates', key: 'now' } as const, 0)
const log = atom({ plugin: 'stylish-teammates', key: 'log' } as const, [])
const logAt = atom({ plugin: 'stylish-teammates', key: 'logAt' } as const, 0)
const isTasksFolded = atom({ plugin: 'stylish-teammates', key: 'isTasksFolded' } as const, false)
const team = atom({ plugin: 'stylish-teammates', key: 'team' } as const, '')

/**
 * Finds the team this process belongs to: the lead by its session id, a
 * teammate in a terminal pane by the pane id the team's config recorded.
 * Falls back to a board of this session alone. A board that was left for a
 * team's sends a later process of the same session on to it.
 */
async function resolveBoardPath($: EngineInterface): Promise<string> {
  const home = (await $.env.get('HOME')) ?? '~'
  const sessionId = await $.session.id()
  const pane = await $.env.get('TMUX_PANE')
  const teamsDir = `${home}/.claude/teams`
  const boardOf = async (team: string) => boardFile(home, await settle(team, name => $.fs.read(boardFile(home, name)).catch(() => undefined)))

  const readConfig = async (team: string): Promise<TeamConfig | undefined> => {
    try {
      return JSON.parse(await $.fs.read(`${teamsDir}/${team}/config.json`)) as TeamConfig
    } catch {
      return undefined
    }
  }

  const guess = `session-${sessionId.slice(0, 8)}`
  if ((await readConfig(guess))?.leadSessionId === sessionId) return boardOf(guess)

  let entries: { name: string; mtimeMs: number }[] = []
  try {
    entries = (await $.fs.list(teamsDir)).filter(entry => entry.kind === 'dir').sort((a, b) => b.mtimeMs - a.mtimeMs)
  } catch {
    return boardOf(guess)
  }
  for (const entry of entries) {
    const config = await readConfig(entry.name)
    if (config?.leadSessionId === sessionId) return boardOf(entry.name)
    if (pane !== undefined && config?.members?.some(member => member.tmuxPaneId === pane)) return boardOf(entry.name)
  }

  return boardOf(guess)
}

let boardPath: string | undefined
let boardMtime = -1

async function pathOf($: EngineInterface): Promise<string> {
  if (boardPath !== undefined) return boardPath
  const adopted = await read($, team)
  boardPath = adopted === '' ? await resolveBoardPath($) : boardFile((await $.env.get('HOME')) ?? '~', adopted)
  return boardPath
}

// A resumed session's id can differ from the lead id its team recorded, so a
// teammate's `<name>@<team>` address is the reliable name. Tasks made before
// the first teammate move with the lead.
async function adoptTeam($: EngineInterface, name: string): Promise<void> {
  if ((await read($, team)) === name) return
  const target = boardFile((await $.env.get('HOME')) ?? '~', name)
  const current = await pathOf($)
  if (current !== target) {
    const text = await $.fs.read(current).catch(() => undefined)
    const left = readBoard(text)
    const isCarried = !(await $.fs.exists(target))
    if (isCarried && text !== undefined) await $.fs.write(target, text)
    // Tasks the team's board did not take keep their board, so a restart still finds them.
    if (left !== undefined && (isCarried || left.tasks.length === 0)) {
      await $.fs.write(current, JSON.stringify({ ...left, movedTo: name }, null, 2))
    }
  }
  await update($, team, () => name)
  boardPath = target
  boardMtime = -1
}

async function setBoard($: EngineInterface, after: TaskRow[]): Promise<void> {
  const before = await read($, board)
  if (sameValue(before, after)) return
  await update($, board, () => after)
  for (const task of newlyCompleted(before, after)) $.ui.toast(`✓ #${task.id} ${task.subject}`)
}

// The board file is shared with teammates in other processes; pick up their writes.
async function syncBoard($: EngineInterface): Promise<void> {
  const path = await pathOf($)
  let mtime: number
  try {
    mtime = (await $.fs.stat(path)).mtimeMs
  } catch {
    return
  }
  if (mtime === boardMtime) return
  boardMtime = mtime
  const text = await $.fs.read(path).catch(() => undefined)
  await setBoard($, toRows(parseBoard(text)))
}

async function refresh($: EngineInterface): Promise<void> {
  const [list, at, before] = await Promise.all([$.agent.list(), $.clock.now(), read($, agents)])
  const after = mergeAgents(before, list, at)

  const teamName = list.map(info => info.teammateId?.split('@')[1]).find(isTeamName)
  if (teamName !== undefined) await adoptTeam($, teamName)

  if (!sameValue(before, after)) {
    await update($, agents, () => after)
    for (const row of newlyEnded(before, after)) {
      $.ui.toast(`${GLYPH[row.status] ?? '·'} ${row.name} ${row.status}`)
    }
  }
  // Drives the elapsed and stale readings while anyone is still working.
  if (after.some(row => isLive(row.status) || row.status === 'idle')) {
    await update($, now, () => at)
  }
}

function agentLine(row: AgentRow, at: number): string {
  if (row.status === 'idle') return 'idle'
  if (isEnded(row.status)) return row.status
  if (row.lastTool === undefined) return row.status
  return `${row.lastTool} (${ago(at - (row.lastToolAt ?? at))})`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'teammates',
      description: 'Show agent-team teammates, what each is doing, and the task board',
    })
    await $.tool.register(TOOL_SPEC)
    $.clock.every(POLL_MS, () => {
      void refresh($).catch(() => undefined)
      void syncBoard($).catch(() => undefined)
    })

    return next(e)
  })

  on('command.run', { command: 'teammates' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: 'Teammates' })

    return { text: 'Teammates pane opened.' }
  })

  on('tool.call', { tool: 'mcp__stylish-teammates__task' }, async ($, e) => {
    const path = await pathOf($)
    const input = e as unknown as TaskAction
    // A file that is there but is not a board is left as it is: writing would erase what it held.
    const current = readBoard((await $.fs.exists(path)) ? await $.fs.read(path) : undefined)
    if (current === undefined) return { result: `The task board file is not a valid board and was left untouched: ${path}` }
    const { board: next, reply } = applyAction(current, input, await $.clock.now())
    if (input.action !== 'list') await $.fs.write(path, JSON.stringify(next, null, 2))
    await setBoard($, toRows(next))

    return { result: reply }
  }).catch(() => ({ result: 'The task board could not be read or written; try again.' }))

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const input = e as unknown as Record<string, unknown>

    if (e.agentId !== undefined) {
      const at = await $.clock.now()
      const label = describeCall(tool, input)
      await update($, agents, rows =>
        rows.map(row => (row.id === e.agentId ? { ...row, lastTool: label, lastToolAt: at } : row)),
      )
    } else {
      const at = await $.clock.now()
      const label = describeCall(tool, input)
      await update($, main, row => ({
        ...row,
        status: 'running',
        lastTool: label,
        lastToolAt: at,
        changedAt: row.status === 'running' ? row.changedAt : at,
      }))
      if (tool !== OWN_TOOL) await update($, log, entries => logCall(entries, tool, input, at))
    }

    const ran = await next(e)

    const isTaskCall = TASK_TOOLS.has(tool) && !(tool === 'TodoWrite' && e.agentId !== undefined)
    if (isTaskCall && 'result' in ran && ran.result !== undefined && ran.isError !== true) {
      const before = await read($, tasks)
      const after = applyTaskCall(before, tool, input, ran.result)
      if (!sameValue(before, after)) {
        await update($, tasks, () => after)
        for (const task of newlyCompleted(before, after)) $.ui.toast(`✓ ${task.subject}`)
      }
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    const at = await $.clock.now()
    await update($, main, row => ({ ...row, status: 'running', changedAt: row.status === 'running' ? row.changedAt : at }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    void refresh($).catch(() => undefined)

    return spawned
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      await update($, agents, rows =>
        rows.map(row => (row.id === e.agentId ? { ...row, turns: row.turns + 1 } : row)),
      )
    } else {
      const at = await $.clock.now()
      await update($, main, row => ({ ...row, status: 'idle', turns: row.turns + 1, changedAt: at }))
    }

    return next(e)
  })

  on('classic.TeammateIdle', async ($, e, next) => {
    void refresh($).catch(() => undefined)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const [rows, own, observed, at, mainRow, isFolded] = await Promise.all([
      read($, agents),
      read($, board),
      read($, tasks),
      read($, now),
      read($, main),
      read($, isTasksFolded),
    ])
    const all = [...own, ...observed]
    const shown = rows.filter(row => row.isTeammate || !isEnded(row.status))
    if (shown.length === 0 && all.length === 0) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    // The main loop alone never raises the band; it leads the chips once there is something else to show.
    const listed = [mainRow, ...shown]
    const chips = listed.slice(0, BAND_CHIPS)
    const more = listed.length - chips.length
    const list = bandTasks(all, BAND_TASKS)

    // The band is one instance: what another plugin or the engine draws beneath stays under these rows.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>
          <Text dimColor wrap="truncate-end">
            {summary(rows, all)}
          </Text>
          {all.length > 0 && (
            <Button
              key="fold-tasks"
              plain
              dimColor
              label={isFolded ? '▸ show tasks' : '▾ hide tasks'}
              onPress={() => update($, isTasksFolded, folded => !folded)}
            />
          )}
        </Box>
        {!isFolded &&
          list.rows.map(task => (
            <Text
              key={task.id}
              dimColor={task.status === 'completed'}
              bold={task.status === 'in_progress'}
              color={task.status === 'in_progress' ? 'suggestion' : isBlocked(task, all) ? 'warning' : undefined}
              wrap="truncate-end"
            >
              {taskLine(task, all)}
            </Text>
          ))}
        {!isFolded && list.rows.length > 0 && list.hidden > 0 && (
          <Text dimColor>… +{list.hidden} more in /teammates</Text>
        )}
        {chips.length > 0 && (
          <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
            {chips.map(row => (
              <Text key={row.id} color={statusColor(row, at)} wrap="truncate-end">
                {GLYPH[row.status] ?? '·'} {row.name}
                {isLive(row.status) && row.lastTool !== undefined ? ` ${row.lastTool.split(' ')[0]}` : ''}
              </Text>
            ))}
            {more > 0 && <Text dimColor>+{more}</Text>}
          </Box>
        )}
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const [rows, own, observed, at, mainRow, entries, shownAt] = await Promise.all([
      read($, agents),
      read($, board),
      read($, tasks),
      read($, now),
      read($, main),
      read($, log),
      read($, logAt),
    ])
    const listed = [mainRow, ...rows]
    const view = logView(entries, shownAt)
    const current = entries[view.index]
    const first = Math.max(0, Math.min(view.index - Math.floor(LOG_ROWS / 2), entries.length - LOG_ROWS))
    const window = entries.slice(first, first + LOG_ROWS)
    const all = [...own, ...observed]
    const width = e.props.bodyColumns
    const detailWidth = Math.max(10, width - 14 - 10 - 6)

    return (
      <Box flexDirection="column">
        <Text bold>Agents</Text>
        <Text dimColor>
          {pad('NAME', 14)}
          {pad('STATUS', 10)}
          {pad('TURNS', 6)}
          NOW
        </Text>
        {listed.map(row => (
          <Text key={row.id} color={statusColor(row, at)} dimColor={isEnded(row.status)} wrap="truncate-end">
            {pad(`${GLYPH[row.status] ?? '·'} ${row.name}`, 14)}
            {pad(isStale(row, at) ? 'stalled?' : row.status, 10)}
            {pad(String(row.turns), 6)}
            {pad(agentLine(row, at), detailWidth)}
          </Text>
        ))}
        {rows.length === 0 && <Text dimColor>No teammates or subagents yet.</Text>}
        <Text> </Text>
        <Text bold>Tasks</Text>
        {all.length === 0 && <Text dimColor>No tasks on the board.</Text>}
        {all.map(task => (
          <Text
            key={task.id}
            dimColor={task.status === 'completed'}
            color={task.status === 'in_progress' ? 'suggestion' : isBlocked(task, all) ? 'warning' : undefined}
            wrap="truncate-end"
          >
            {taskLine(task, all)}
          </Text>
        ))}
        <Text> </Text>
        <Box flexDirection="row" columnGap={2}>
          <Text bold>Recent work</Text>
          {view.prev !== undefined && (
            <Button key="log-prev" label="Prev" hotkey="p" onPress={() => update($, logAt, () => view.prev ?? 0)} />
          )}
          {view.next !== undefined && (
            <Button key="log-next" label="Next" hotkey="n" onPress={() => update($, logAt, () => view.next ?? 0)} />
          )}
          {view.next !== undefined && <Button key="log-latest" label="Latest" hotkey="l" onPress={() => update($, logAt, () => 0)} />}
        </Box>
        {entries.length === 0 && <Text dimColor>Nothing yet: the main loop's tool calls show here.</Text>}
        {window.map(entry => (
          <Text key={`log-${entry.id}`} bold={entry === current} dimColor={entry !== current} wrap="truncate-end">
            {entry === current ? '▸' : ' '} {entry.label} ({ago(at - entry.at)})
          </Text>
        ))}
        {current?.detail.map((line, index) => (
          <Text
            key={`detail-${index}`}
            color={line.startsWith('+ ') ? 'success' : line.startsWith('- ') ? 'error' : undefined}
            dimColor={!line.startsWith('+ ') && !line.startsWith('- ')}
            wrap="truncate-end"
          >
            {'  '}
            {line}
          </Text>
        ))}
      </Box>
    )
  })
}
