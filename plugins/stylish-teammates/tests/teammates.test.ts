import { describe, expect, test } from 'claude-code/testing'
import type { AgentInfo, On, RenderElement } from 'claude-code'

import { applyAction, emptyBoard, isTeamName, parseBoard, readBoard, settle, teamOfTranscript, toRows } from '../hooks/board'
import type { TaskAction } from '../hooks/board'
import { ENDED_KEEP_MS, bandTasks, describeCall, diffLines, isBlocked, logCall, logView, mergeAgents, newlyEnded, summary, taskLine } from '../hooks/model'
import type { TaskRow, WorkEntry } from '../types'

const PLUGIN = 'stylish-teammates'

const scout: AgentInfo = {
  id: 'a1',
  teammateId: 'scout@team-x',
  name: 'scout',
  description: 'look around',
  type: 'teammate',
  status: 'running',
}

const band = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 9 },
  view: {},
}

const pane = {
  title: 'Teammates',
  isFocused: false,
  bodyColumns: 80,
  placement: 'inline' as const,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
}

describe('model', () => {
  test('a teammate that leaves the list is kept as gone and reported once', async () => {
    const first = mergeAgents([], [scout], 1000)
    expect(first[0]?.status).toBe('running')

    const second = mergeAgents(first, [], 2000)
    expect(second[0]?.status).toBe('gone')
    expect(newlyEnded(first, second).map(row => row.name)).toEqual(['scout'])

    const third = mergeAgents(second, [], 3000)
    expect(newlyEnded(second, third)).toEqual([])
  })

  test('an agent that ended leaves the board once it has been shown for a while', async () => {
    const gone = mergeAgents(mergeAgents([], [scout], 1000), [], 2000)

    expect(mergeAgents(gone, [], 2000 + ENDED_KEEP_MS).map(row => row.name)).toEqual(['scout'])
    expect(mergeAgents(gone, [], 2000 + ENDED_KEEP_MS + 1)).toEqual([])

    // Ended while the engine still listed it: the wait counts from when it ended, not from when it left the list.
    const done = mergeAgents(mergeAgents([], [scout], 1000), [{ ...scout, status: 'completed' }], 5000)
    expect(mergeAgents(done, [], 5000 + ENDED_KEEP_MS).map(row => row.status)).toEqual(['completed'])
    expect(mergeAgents(done, [], 5000 + ENDED_KEEP_MS + 1)).toEqual([])
  })

  test('summary counts teammates by state', async () => {
    const rows = mergeAgents([], [scout, { ...scout, id: 'a2', name: 'critic', teammateId: 'critic@team-x', status: 'idle' }], 0)
    expect(summary(rows, [])).toBe('teammates 2 · running 1 · idle 1')
  })

  test('a tool call reads as its tool and its subject', async () => {
    expect(describeCall('Bash', { command: 'pnpm   test\n--run' })).toBe('Bash pnpm test --run')
    expect(describeCall('Edit', { file_path: '/repo/src/parser.ts' })).toBe('Edit parser.ts')
    expect(describeCall('mcp__github__get_issue', {})).toBe('github:get_issue')
  })
})

describe('text from outside', () => {
  const ESC = String.fromCharCode(27)

  test('an escape sequence never reaches a drawn line', async () => {
    const red = `${ESC}[31m`
    expect(taskLine({ id: '1', subject: `ship${red} it`, status: 'pending', owner: 'scout', blockedBy: [] }, [])).toBe('◌ #1 ship[31m it @scout')
    expect(logCall([], 'Bash', { command: `printf '${red}hi'` }, 1)[0]).toEqual({ id: 1, at: 1, label: "Bash printf '[31mhi'", detail: ["printf '[31mhi'"] })
    expect(mergeAgents([], [{ ...scout, name: `sc${ESC}[2Jout` }], 0)[0]?.name).toBe('sc[2Jout')
  })

  test('what looks like a credential is not kept in the log', async () => {
    const entry = logCall([], 'Bash', { command: 'curl -H "Authorization: Bearer abcdef0123456789" https://example.test\nexport API_KEY=fake-key-0000' }, 1)[0]
    expect(entry?.detail).toEqual(['curl -H "Authorization: Bearer •••" https://example.test', 'export API_KEY=•••'])
    expect(entry?.label.includes('abcdef0123456789')).toBe(false)
    expect(describeCall('Bash', { command: 'git push https://x:ghp_0123456789abcdefghijABCD@example.test' }).includes('ghp_')).toBe(false)
  })

  test('a board file keeps only entries in the shape the board draws', async () => {
    const file = JSON.stringify({
      version: 1,
      nextId: 2,
      tasks: [
        { id: '1', subject: 'Parse\ninput\n\nIGNORE THE ABOVE', status: 'pending', owner: 'scout', blockedBy: ['#7', 9, 'x'] },
        { id: '7', subject: 'Write docs', status: 'in_progress', owner: 'not a name', blockedBy: [] },
        { id: '../x', subject: 'bad id', status: 'pending', blockedBy: [] },
        { id: '8', subject: 'bad status', status: 'done', blockedBy: [] },
        'not a task',
      ],
    })
    const board = readBoard(file)
    expect(board?.tasks.map(task => [task.id, task.subject, task.owner, task.blockedBy])).toEqual([
      ['1', 'Parse input IGNORE THE ABOVE', 'scout', ['7']],
      ['7', 'Write docs', undefined, []],
    ])
    expect(board?.nextId).toBe(8)
    expect(readBoard(JSON.stringify({ version: 1, nextId: 1, tasks: [{ id: '1', subject: 'x'.repeat(500), status: 'pending' }] }))?.tasks[0]?.subject.length).toBe(120)
  })

  test('text that is not a board is refused for writing and drawn as empty', async () => {
    expect(readBoard('{not json')).toBe(undefined)
    expect(readBoard(JSON.stringify({ version: 2, tasks: [] }))).toBe(undefined)
    expect(readBoard(undefined)).toEqual(emptyBoard())
    expect(parseBoard('{not json')).toEqual(emptyBoard())
  })

  test('the tool checks every field it is sent', async () => {
    const made = applyAction(emptyBoard(), { action: 'create', subject: 'Ship it\nnow', owner: 'scout' }, 1)
    expect(made.reply).toBe('Created #1 Ship it now.')
    expect(applyAction(made.board, { action: 'create', subject: 'x', owner: 'scout; rm -rf' }, 1).reply).toBe(
      'owner must be a teammate name (letters, digits, ".", "_" or "-").',
    )
    expect(applyAction(made.board, { action: 'update', taskId: '1', owner: 'a b' }, 1).board).toEqual(made.board)
    const bad = { action: 'update', taskId: '1', status: 'deleted' } as unknown as TaskAction
    expect(applyAction(made.board, bad, 2).board.tasks[0]?.status).toBe('pending')
  })
})

describe('work log', () => {
  test('an edit is kept as the lines it changed', async () => {
    expect(diffLines('a\nb\nc', 'a\nB\nc')).toEqual(['- b', '+ B'])
    expect(diffLines('a', 'a\nb')).toEqual(['+ b'])

    const log = logCall([], 'Edit', { file_path: '/repo/src/parser.ts', old_string: 'x = 1', new_string: 'x = 2' }, 10)
    expect(log).toEqual([{ id: 1, at: 10, label: 'Edit parser.ts', detail: ['- x = 1', '+ x = 2'] }])
    expect(logCall(log, 'Bash', { command: 'pnpm test\n--run' }, 20)[1]?.detail).toEqual(['pnpm test', '--run'])
  })

  test('a long change is cut and the log keeps the latest twenty', async () => {
    const content = Array.from({ length: 30 }, (_, index) => `line ${index}`).join('\n')
    const detail = logCall([], 'Write', { file_path: '/repo/a.ts', content }, 1)[0]?.detail ?? []
    expect(detail.length).toBe(12)
    expect(detail[11]).toBe('… +19 lines')

    const many = Array.from({ length: 25 }).reduce<WorkEntry[]>(log => logCall(log, 'Read', { file_path: '/repo/a.ts' }, 1), [])
    expect(many.length).toBe(20)
    expect(many[0]?.id).toBe(6)
  })

  test('the view follows the latest until an entry is picked', async () => {
    const log = [1, 2, 3].reduce<WorkEntry[]>((entries, at) => logCall(entries, 'Read', { file_path: `/repo/${at}.ts` }, at), [])
    expect(logView(log, 0)).toEqual({ index: 2, prev: 2, next: undefined })
    expect(logView(log, 2)).toEqual({ index: 1, prev: 1, next: 3 })
    expect(logView([], 0).index).toBe(-1)
  })
})

describe('task board', () => {
  test('a created task shows on the band, above any band beneath, and in the pane on every surface', async ($, on) => {
    on('tool.call', { tool: 'TaskCreate' }, () => ({ result: { task: { id: '7', subject: 'Write the parser' } } }))
    on('tool.call', { tool: 'TaskUpdate' }, () => ({
      result: { success: true, taskId: '7', updatedFields: ['status'], statusChange: { from: 'pending', to: 'in_progress' } },
    }))

    on('clock.now', () => ({ value: 1000 }))
    on('ui.render', { component: 'AbovePrompt' }, (_$, e) => {
      const { Text } = _$.ui.resolve(e)
      return h(Text, {}, 'band beneath') as RenderElement
    })

    await $.tool.call({ tool: 'TaskCreate', subject: 'Write the parser', description: 'Parse the input' })
    await $.tool.call({ tool: 'TaskUpdate', taskId: '7', status: 'in_progress', owner: 'scout' })

    for (const surface of ['terminal', 'desktop'] as const) {
      const top = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
      expect((await top.find({ text: 'tasks 0/1 done · 1 active' })) !== undefined).toBe(true)
      expect((await top.find({ text: 'band beneath' })) !== undefined).toBe(true)
      expect((await top.find({ text: 'main TaskUpdate' })) !== undefined).toBe(true)
      expect((await top.find({ text: '▸ #7 Write the parser @scout' })) !== undefined).toBe(true)

      await top.press({ key: 'fold-tasks' })
      expect(await top.find({ text: '▸ #7 Write the parser @scout' })).toBe(undefined)
      expect((await top.find({ text: 'tasks 0/1 done · 1 active' })) !== undefined).toBe(true)
      expect((await top.find({ text: 'band beneath' })) !== undefined).toBe(true)
      await top.press({ key: 'fold-tasks' })

      const board = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: 'teammates', props: pane })
      expect((await board.find({ text: '▸ #7 Write the parser @scout' })) !== undefined).toBe(true)
      expect((await board.find({ text: 'TaskUpdate' })) !== undefined).toBe(true)
      expect((await board.find({ text: '▸ TaskUpdate' })) !== undefined).toBe(true)

      await board.press({ key: 'log-prev' })
      expect((await board.find({ text: '▸ TaskCreate' })) !== undefined).toBe(true)
      await board.press({ key: 'log-latest' })
    }
  })

  test('the band stays out of the way with nothing to show', async ($, on) => {
    on('ui.render', { component: 'AbovePrompt' }, (_$, e) => {
      const { Text } = _$.ui.resolve(e)
      return h(Text, {}, 'engine band') as RenderElement
    })

    const top = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band })
    expect((await top.find({ text: 'engine band' })) !== undefined).toBe(true)
    expect(await top.find({ text: 'teammates' })).toBe(undefined)
  })
})

describe('board tool', () => {
  test('create, assign, block and complete tasks', async () => {
    let board = emptyBoard()
    const run = (input: TaskAction) => {
      const out = applyAction(board, input, 1)
      board = out.board
      return out.reply
    }

    expect(run({ action: 'create', subject: 'Parse input', owner: 'scout' })).toBe('Created #1 Parse input.')
    expect(run({ action: 'create', subject: 'Write docs', blockedBy: ['#1'] })).toBe('Created #2 Write docs.')
    expect(isBlocked(toRows(board)[1]!, toRows(board))).toBe(true)

    expect(run({ action: 'update', taskId: '#1', status: 'completed' })).toBe('Updated #1 Parse input: completed @scout.')
    expect(isBlocked(toRows(board)[1]!, toRows(board))).toBe(false)
    expect(run({ action: 'update', taskId: '9', status: 'completed' })).toBe('No task #9.')
    expect(run({ action: 'create' })).toBe('create needs a subject.')
    expect(run({ action: 'list' })).toBe('#1 [completed] Parse input @scout\n#2 [pending] Write docs (blocked by #1)')
  })

  test('the band lists a short board whole and a long one without its finished tasks', async () => {
    const task = (id: number, status: TaskRow['status']): TaskRow => ({ id: String(id), subject: `step ${id}`, status, blockedBy: [] })
    const short = [task(1, 'completed'), task(2, 'in_progress'), task(3, 'pending')]
    expect(bandTasks(short, 5)).toEqual({ rows: short, hidden: 0 })

    const long = [1, 2, 3].map(id => task(id, 'completed')).concat([task(4, 'in_progress')], [5, 6, 7, 8, 9, 10].map(id => task(id, 'pending')))
    const shown = bandTasks(long, 5)
    expect(shown.rows.map(row => row.id)).toEqual(['4', '5', '6', '7', '8'])
    expect(shown.hidden).toBe(5)
    expect(bandTasks([], 5)).toEqual({ rows: [], hidden: 0 })
  })

  test('a team name that carries a path is refused', async () => {
    expect(['team-x', 'session-1a2b3c4d', 'v1.2'].every(isTeamName)).toBe(true)
    expect(['../../x', 'a/b', '..', '.hidden', '', undefined].some(isTeamName)).toBe(false)
  })

  test('a corrupt board file reads as empty', async () => {
    expect(parseBoard('{not json').tasks).toEqual([])
    expect(parseBoard(undefined).nextId).toBe(1)
  })
})

describe('board file', () => {
  const HOME = '/home/me'
  const boards = `${HOME}/.claude/stylish-teammates/boards`
  const own = `${boards}/session-aaaaaaaa.json`
  const shared = `${boards}/team-x.json`
  const task = (id: string, subject: string) => ({ id, subject, status: 'pending', blockedBy: [], updatedAt: 1000 })
  const file = (nextId: number, tasks: unknown[], rest: object = {}) => JSON.stringify({ version: 1, nextId, tasks, ...rest }, null, 2)

  /** One process of session `aaaaaaaa…` over these files alone, with these agents listed and each read counted. */
  const boot = (on: On, files: Map<string, string>, listed: AgentInfo[], reads = new Map<string, number>()) => {
    on('session.id', () => ({ value: 'aaaaaaaa-0000-4000-8000-000000000000' }))
    on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? HOME : undefined }))
    on('agent.list', () => ({ value: listed }))
    on('clock.now', () => ({ value: 1000 }))
    on('ui.open', () => ({ value: { isPlaced: false, reason: 'no surface' } }))
    on('fs.list', () => ({ value: [] }))
    on('fs.exists', (_$, e) => ({ value: files.has(e.path) }))
    on('fs.read', (_$, e) => {
      reads.set(e.path, (reads.get(e.path) ?? 0) + 1)
      return files.has(e.path) ? { value: files.get(e.path)! } : { deny: 'no such file' }
    })
    on('fs.stat', (_$, e) =>
      files.has(e.path) ? { value: { kind: 'file', size: files.get(e.path)!.length, mtimeMs: 1, isLink: false } } : { deny: 'no such file' },
    )
    on('classic.SessionStart', () => ({}) as never)
    on('classic.PostToolUse', () => ({}) as never)
    on('fs.write', (_$, e) => {
      files.set(e.path, e.text)
      return { value: undefined }
    })
  }

  // What a lead with one task leaves on disk once a team formed and a second task was made.
  const afterTeam = () =>
    new Map([
      [own, file(2, [task('1', 'Before the team')], { movedTo: 'team-x' })],
      [shared, file(3, [task('1', 'Before the team'), task('2', 'With the team')])],
    ])

  test('a board that was left is followed to the one in use', async () => {
    const left = (team: string) => file(1, [], { movedTo: team })
    const disk: Record<string, string> = { a: left('b'), b: left('c'), c: file(1, []), loop: left('pool'), pool: left('loop'), out: left('../x') }
    const load = async (name: string) => disk[name]

    expect(await settle('a', load)).toBe('c')
    expect(await settle('c', load)).toBe('c')
    expect(await settle('nowhere', load)).toBe('nowhere')
    expect(['loop', 'pool']).toContain(await settle('loop', load))
    // A name that carries a path is not a team name, so it is never followed.
    expect(await settle('out', load)).toBe('out')
  })

  test('a board keeps the team it was left for when it is written again', async () => {
    const board = readBoard(file(1, [], { movedTo: 'team-x' }))!
    expect(applyAction(board, { action: 'create', subject: 'Late' }, 1).board.movedTo).toBe('team-x')
    expect(readBoard(file(1, []))).toEqual(emptyBoard())
  })

  test('a lead that gains a team takes its tasks along and leaves the team name behind', async ($, on) => {
    const files = new Map([[own, file(2, [task('1', 'Before the team')])]])
    boot(on, files, [scout])

    await $.command.run({ command: 'teammates', args: '' } as never)
    await $.tool.call({ tool: 'mcp__stylish-teammates__task', action: 'create', subject: 'With the team' } as never)

    expect([...files]).toEqual([...afterTeam()])
  })

  test('a lead with no board of its own still leaves the team name behind', async ($, on) => {
    const files = new Map<string, string>()
    boot(on, files, [scout])

    await $.command.run({ command: 'teammates', args: '' } as never)

    expect([...files]).toEqual([[own, file(1, [], { movedTo: 'team-x' })]])
  })

  test('tasks a team board did not take stay on a board a restart still finds', async ($, on) => {
    const before = file(2, [task('1', 'Before the team')])
    const files = new Map([
      [own, before],
      [shared, file(2, [task('1', 'From a teammate')])],
    ])
    boot(on, files, [scout])

    await $.command.run({ command: 'teammates', args: '' } as never)

    expect(files.get(own)).toBe(before)
  })

  test('a restarted lead still lists the tasks made while its team was up', async ($, on) => {
    boot(on, afterTeam(), [])

    const out = (await $.tool.call({ tool: 'mcp__stylish-teammates__task', action: 'list' } as never)) as { result?: unknown }
    expect(out.result).toBe('#1 [pending] Before the team\n#2 [pending] With the team')
  })

  const transcript = `${HOME}/.claude/projects/-work/aaaaaaaa-0000-4000-8000-000000000000.jsonl`
  const opening = ['{"type":"agent-setting","agentSetting":"claude"}', '{"type":"mode","mode":"normal"}']
  const turn = (rest: object) => JSON.stringify({ type: 'user', message: { role: 'user', content: 'go' }, ...rest })
  const lines = (...records: string[]) => records.join('\n') + '\n'
  const asTeammate = lines(...opening, turn({ teamName: 'team-x', agentName: 'impl-x' }))
  const list = async ($: { tool: { call: (e: never) => Promise<unknown> } }) =>
    ((await $.tool.call({ tool: 'mcp__stylish-teammates__task', action: 'list' } as never)) as { result?: unknown }).result

  test('a transcript names the team of a teammate, and of no one else', async () => {
    expect(teamOfTranscript(asTeammate)).toBe('team-x')
    expect(teamOfTranscript(lines(...opening, '{not json', turn({ teamName: 'team-x', agentName: 'impl-x' })))).toBe('team-x')
    // A lead's turns carry no team, and one turn settles it.
    expect(teamOfTranscript(lines(...opening, turn({}), turn({ teamName: 'team-x', agentName: 'impl-x' })))).toBe(null)
    expect(teamOfTranscript(lines(...opening, turn({ teamName: 'team-x' })))).toBe(null)
    expect(teamOfTranscript(lines(...opening, turn({ teamName: '../../x', agentName: 'impl-x' })))).toBe(null)
    // No turn yet: nothing is known either way.
    expect(teamOfTranscript(lines(...opening))).toBe(undefined)
    expect(teamOfTranscript('')).toBe(undefined)
  })

  test('a teammate no pane names still works on the board of its team', async ($, on) => {
    const files = new Map([
      [shared, file(2, [task('1', 'From the lead')])],
      [transcript, asTeammate],
    ])
    boot(on, files, [])

    await $.classic.SessionStart({ source: 'startup', transcript_path: transcript } as never)

    expect(await list($)).toBe('#1 [pending] From the lead')
    await $.tool.call({ tool: 'mcp__stylish-teammates__task', action: 'update', taskId: '1', status: 'completed' } as never)
    expect(parseBoard(files.get(shared)).tasks.map(row => row.status)).toEqual(['completed'])
    expect(files.has(own)).toBe(false)
  })

  test('a teammate whose transcript has no turn yet joins its team once it has one', async ($, on) => {
    const files = new Map([
      [shared, file(2, [task('1', 'From the lead')])],
      [transcript, lines(...opening)],
    ])
    boot(on, files, [])

    await $.classic.SessionStart({ source: 'startup', transcript_path: transcript } as never)
    expect(await list($)).toBe('The board is empty.')

    files.set(transcript, asTeammate)
    expect(await list($)).toBe('#1 [pending] From the lead')
  })

  test('a tool call of the main loop tells where the transcript is, and a subagent\'s does not', async ($, on) => {
    const files = new Map([
      [own, file(2, [task('1', 'Mine')])],
      [shared, file(2, [task('1', 'From the lead')])],
      [transcript, asTeammate],
    ])
    boot(on, files, [])
    const ran = { tool_name: 'Bash', tool_input: {}, tool_response: {}, tool_use_id: 't1', transcript_path: transcript }

    await $.classic.PostToolUse({ ...ran, agent_id: 'a1' } as never)
    expect(await list($)).toBe('#1 [pending] Mine')

    await $.classic.PostToolUse(ran as never)
    expect(await list($)).toBe('#1 [pending] From the lead')
  })

  test('a session that is no teammate keeps its own board and reads its transcript once', async ($, on) => {
    const files = new Map([
      [own, file(2, [task('1', 'Mine')])],
      [shared, file(2, [task('1', 'From the lead')])],
      [transcript, lines(...opening, turn({}))],
    ])
    const reads = new Map<string, number>()
    boot(on, files, [], reads)

    await $.classic.SessionStart({ source: 'startup', transcript_path: transcript } as never)
    expect(await list($)).toBe('#1 [pending] Mine')
    expect(await list($)).toBe('#1 [pending] Mine')
    expect(reads.get(transcript)).toBe(1)
  })

  test('a transcript that has grown long is left unread', async ($, on) => {
    const files = new Map([
      [own, file(2, [task('1', 'Mine')])],
      [transcript, lines(...opening, turn({ teamName: 'team-x', agentName: 'impl-x', padding: 'x'.repeat(600_000) }))],
    ])
    const reads = new Map<string, number>()
    boot(on, files, [], reads)

    await $.classic.SessionStart({ source: 'resume', transcript_path: transcript } as never)
    expect(await list($)).toBe('#1 [pending] Mine')
    expect(reads.get(transcript)).toBe(undefined)
  })
})
