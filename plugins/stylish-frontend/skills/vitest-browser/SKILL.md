---
name: vitest-browser
description: Generate Vitest Browser Mode tests with intelligent component classification (Simple/Complex)
argument-hint: "[file-path] [--simple|--complex]"
tools: Bash, Read, Write, Edit, Glob, Grep
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

# Vitest Browser Mode Test Generation

Generate comprehensive browser-based component tests using Vitest Browser Mode with intelligent component classification.

## Workflow

1. **Detect Project Configuration**
   - Check for `vitest.config.ts` or `vitest.config.js`
   - Verify browser mode dependencies:
     - `@vitest/browser*` (e.g., `-playwright`, `-webdriverio`)
     - `vitest-browser-react` (for React render)
   - **Check tsconfig for Vitest globals** (determines import strategy)
   - Identify testing utilities available

2. **Analyze Component Structure**
   - Read component source file(s)
   - Identify props, state management, sub-components
   - Detect patterns (compound components, controlled state, etc.)

3. **Classify Component**
   - Apply scoring heuristics (see Classification below)
   - Determine: **Simple** or **Complex**

4. **Generate Test File**
   - Apply appropriate test suite template
   - Use Testing Library style queries
   - Include edge cases and accessibility checks

5. **Validate Coverage**
   - Ensure all props are tested
   - Verify interaction patterns covered
   - Check edge cases addressed

## Component Classification

### Scoring Heuristics

**Simple Indicators (+1 each):**
| Indicator | Description |
|-----------|-------------|
| Single file | Component in one file, no separate sub-components |
| Visual props only | Props control appearance (variant, size, color) |
| No sub-components | No compound component pattern |
| forwardRef only | Simple ref forwarding, no complex hooks |
| < 150 LOC | Less than 150 lines of code |

**Complex Indicators (+2 each):**
| Indicator | Description |
|-----------|-------------|
| Object.assign pattern | `Object.assign(Component, { Sub1, Sub2 })` |
| useControllableState | Controlled/uncontrolled state management |
| Provider/Context | Uses `*Provider` or `use*Context` |
| value + onChange pair | Controlled component pattern |
| File/Date/Validation | File handling, date logic, or validation |

### Classification Rule

```
IF simpleScore >= 3 AND complexScore < 3:
  → Simple Component
ELSE:
  → Complex Component
```

### Detection Patterns

**Simple Component Examples:**
- Tag, Badge, Button (visual only)
- Typography, Icon, Avatar
- Spinner, Skeleton, Divider

**Complex Component Examples:**
- DatePicker, TimePicker
- FileUpload, Dropzone
- Select, Combobox, Autocomplete
- Dialog, Modal, Drawer
- Tabs, Accordion

**Code Pattern Detection:**

```tsx
// → Complex: Object.assign compound pattern
Object.assign(Select, {
  Trigger: SelectTrigger,
  Content: SelectContent,
  Item: SelectItem,
});

// → Complex: Controllable state
import { useControllableState } from './hooks';

// → Complex: Context pattern
const SelectContext = createContext<SelectContextValue | null>(null);
export function SelectProvider({ children }) { ... }

// → Complex: Controlled component
interface Props {
  value?: string;
  onValueChange?: (value: string) => void;
}
```

## Vitest Globals Detection

Check if Vitest globals are configured in tsconfig to determine import strategy.

**Detection Logic:**

1. Read `tsconfig.json` (or `tsconfig.app.json`, `tsconfig.test.json`)
2. Check `compilerOptions.types` array for `"vitest/globals"`

**tsconfig with globals (no vitest import needed):**

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

**Import Strategy:**

| Globals Configured | Import Statement |
|--------------------|------------------|
| Yes (`vitest/globals` in types) | No `vitest` import needed |
| No | `import { expect, describe, it, vi, beforeEach } from 'vitest'` |

**Always Required Imports (regardless of globals):**

```tsx
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
```

## Flags

- `--simple`: Force Simple component test generation
- `--complex`: Force Complex component test generation

## References

@references/vitest-browser-api.md
@references/test-patterns.md

## Usage Examples

```
# Auto-detect and generate tests
/stylish-vitest-browser src/components/Button.tsx

# Force simple component tests
/stylish-vitest-browser src/components/Tag.tsx --simple

# Force complex component tests
/stylish-vitest-browser src/components/DatePicker/index.tsx --complex
```

## Test File Location

Generated test files follow the pattern:
- Source: `src/components/Button.tsx`
- Test: `src/components/Button.test.tsx`

Or for complex components with directory structure:
- Source: `src/components/Select/index.tsx`
- Test: `src/components/Select/Select.test.tsx`
