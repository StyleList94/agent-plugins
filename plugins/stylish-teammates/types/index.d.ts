export type AgentRow = {
  id: string
  name: string
  type: string
  /** An AgentStatus, or `gone` once the engine no longer lists the agent. */
  status: string
  isTeammate: boolean
  lastTool?: string
  lastToolAt?: number
  turns: number
  changedAt: number
}

export type TaskRow = {
  id: string
  subject: string
  status: 'pending' | 'in_progress' | 'completed'
  owner?: string
  blockedBy: string[]
}

/** One tool call of the main loop, with what it changed or ran. */
export type WorkEntry = {
  id: number
  at: number
  label: string
  /** Diff lines for an edit (`+ ` / `- `), the command or prompt otherwise. */
  detail: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'stylish-teammates': {
      agents: AgentRow[]
      /** The main loop, which the engine's agent list leaves out. */
      main: AgentRow
      /** The main loop's latest tool calls, oldest first. */
      log: WorkEntry[]
      /** The `id` of the entry the pane shows in full; 0 follows the latest. */
      logAt: number
      tasks: TaskRow[]
      board: TaskRow[]
      /** The band's task rows are folded away; its summary line stays. */
      isTasksFolded: boolean
      /** The team whose board this session writes, once a teammate named it. */
      team: string
      now: number
    }
  }
}
