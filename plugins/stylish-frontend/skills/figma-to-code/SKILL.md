---
name: figma-to-code
description: Convert Figma designs to JSX/Astro components with Tailwind CSS (requires Figma MCP server)
argument-hint: "[figma-url] [--react|--astro]"
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

# Figma to Code Conversion

Convert Figma designs to production-ready React/Astro components with Tailwind CSS using a structured 6-step workflow.

## Requirements

This skill requires **Figma MCP Server**. See [setup guide](https://github.com/figma/mcp-server-guide).

**Available MCP Tools:**

- `get_design_context()` - UI structure, styles, and layout
- `get_screenshot()` - Visual reference capture
- `get_variable_defs()` - Design tokens and variables
- `get_metadata()` - Node structure and hierarchy

## Workflow

### Step 1: Detect Project Context

Analyze the target project to determine available utilities and framework.

**Class Utility Detection:**

```tsx
// Check for cn/clsx/classnames helper
import { cn } from '@/lib/utils'        // shadcn pattern
import { clsx } from 'clsx'             // clsx
import classNames from 'classnames'     // classnames
```

**Framework Detection:**

- `.astro` files → Astro project
- `.tsx` files → React project
- Check `astro.config.*` for Astro configuration

### Step 2: Extract Design from Figma

Use Figma MCP tools to extract design information:

1. **`get_design_context()`** - Primary extraction
   - Component hierarchy and structure
   - Layout properties (flex, grid, spacing)
   - Typography styles
   - Color values and tokens
   - Border, shadow, and effect styles

2. **`get_screenshot()`** - Visual reference
   - Capture visual appearance for verification
   - Use for complex visual patterns

3. **`get_variable_defs()`** - Design tokens
   - Color tokens and semantic colors
   - Spacing scales
   - Typography tokens
   - Border radius tokens

4. **`get_metadata()`** - Structure analysis
   - Node hierarchy
   - Component instances
   - Auto-layout properties

### Step 3: Verify Design Understanding

Before generating code, confirm understanding with the user:

**Layout Structure:**

- Identify flex/grid containers
- Understand nesting hierarchy
- Recognize responsive patterns

**Spacing Values:**

- Extract padding and margin values
- Map to Tailwind spacing scale
- Note gap values for flex/grid

**Color Mapping:**

- Map Figma colors to Tailwind palette
- Identify semantic color usage
- Note transparency values

**Typography:**

- Font family, size, weight
- Line height and letter spacing
- Text color and decoration

**If unclear on any aspect:**
> Ask the user for clarification before proceeding

### Step 4: Generate JSX

**React (.tsx) - Default:**

```tsx
interface ComponentProps {
  className?: string
  children?: React.ReactNode
}

export function Component({ className, children }: ComponentProps) {
  return (
    <div className={cn('base-styles', className)}>
      {children}
    </div>
  )
}
```

**Astro (.astro) - For static content:**

```astro
---
interface Props {
  class?: string
}

const { class: className } = Astro.props
---

<div class:list={['base-styles', className]}>
  <slot />
</div>
```

**Astro + React (.tsx with client directive) - For interactive:**

```astro
---
import { InteractiveComponent } from './InteractiveComponent'
---

<InteractiveComponent client:load />
```

### Step 5: Apply Styles

**Tailwind v4 (Default):**

Use Tailwind v4 patterns with auto-calculated spacing:

```tsx
// Spacing: value * 4px
// p-13 = 52px, gap-18 = 72px

<div className="flex flex-col gap-6 p-8">
  <h1 className="text-2xl font-semibold text-gray-900">
    Title
  </h1>
  <p className="text-base text-gray-600">
    Description
  </p>
</div>
```

**Class Organization Order:**

1. Layout (flex, grid, position)
2. Sizing (w-*, h-*)
3. Spacing (p-*, m-*, gap-*)
4. Typography (text-*, font-*)
5. Colors (bg-*, text-*, border-*)
6. Effects (shadow-*, rounded-*)
7. Responsive (sm:, md:, lg:)
8. State (hover:, focus:)

**With CSS Variables (@theme):**

```css
@import 'tailwindcss';

@theme {
  --breakpoint-md: 992px;
  --font-sans: 'Inter', system-ui, sans-serif;
  --color-primary: oklch(0.7 0.15 250);
}
```

### Step 6: Validate

**Semantic HTML Checklist:**

- [ ] Appropriate heading hierarchy (h1-h6)
- [ ] Semantic elements (nav, main, section, article, aside, footer)
- [ ] Lists for list content (ul/ol/li)
- [ ] Buttons for actions, links for navigation

**Accessibility Checklist:**

- [ ] Alt text for images
- [ ] ARIA labels where needed
- [ ] Focus states for interactive elements
- [ ] Keyboard navigation support
- [ ] Color contrast compliance
- [ ] Screen reader considerations

**Responsive Design:**

- [ ] Mobile-first approach
- [ ] Breakpoint appropriateness
- [ ] Touch target sizes (min 44px)
- [ ] Content reflow for small screens

## Flags

- `--react`: Force React (.tsx) output
- `--astro`: Force Astro (.astro) output

## References

@references/tailwind-v4-patterns.md

## Usage Examples

```bash
# Basic conversion
/stylish-figma-to-code [figma-url-or-node-id]

# Force React output
/stylish-figma-to-code [figma-url] --react

# Force Astro output
/stylish-figma-to-code [figma-url] --astro
```

## Output Structure

Generated components follow project conventions:

**React Project:**

```text
src/components/
└── ComponentName/
    ├── index.tsx        # Main component
    └── ComponentName.tsx # (or single file)
```

**Astro Project:**

```text
src/components/
└── ComponentName.astro  # Astro component
```

## Best Practices

1. **Start with structure** - Get the HTML hierarchy right first
2. **Use semantic elements** - Choose elements by meaning, not styling
3. **Apply Tailwind systematically** - Follow class order convention
4. **Test responsiveness** - Verify at multiple breakpoints
5. **Validate accessibility** - Use dev tools and screen readers
6. **Ask when uncertain** - Clarify with user rather than assume
