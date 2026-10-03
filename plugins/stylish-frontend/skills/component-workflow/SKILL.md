---
name: component-workflow
description: Full component development workflow - Figma design to tested React component
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

# Component Development Workflow

Orchestrate the complete component development process: from Figma design to production-ready, tested React component.

## Workflow Steps

### Step 1: Design to Code

Execute the `/stylish-frontend:figma-to-code` skill to:

- Extract design from Figma
- Generate JSX/Astro component
- Apply Tailwind CSS styles
- Validate accessibility

### Step 2: User Confirmation

After component generation:

- Show the generated component code
- Ask user to review and confirm
- Allow modifications if needed

### Step 3: Test Generation

Once component is confirmed, ask:
> "Component generated successfully. Would you like to generate tests with `/stylish-frontend:vitest-browser`?"

If user agrees, execute `/stylish-frontend:vitest-browser` to:

- Analyze component structure
- Classify as Simple or Complex
- Generate Vitest Browser Mode tests
- Include accessibility checks

## Usage

```bash
# Start the full workflow
/stylish-frontend:component-workflow [figma-url-or-node-id]

# With options
/stylish-frontend:component-workflow [figma-url] --react
/stylish-frontend:component-workflow [figma-url] --astro
```

## Workflow Diagram

```text
┌─────────────────┐
│  Figma Design   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ /stylish-figma  │
│   -to-code      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Review    │
│  & Confirmation │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate tests? │──No──▶ Done
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐
│ /stylish-vitest │
│    -browser     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Ready to Ship!  │
└─────────────────┘
```

## Requirements

- **Figma MCP server** must be configured for design extraction
- **Vitest Browser Mode** dependencies for test generation:
  - `@vitest/browser*`
  - `vitest-browser-react`

## Output

At the end of the workflow, you will have:

1. **Component file** (.tsx or .astro) with Tailwind styles
2. **Test file** (.test.tsx) with comprehensive browser tests

## Tips

- Review the generated component before proceeding to tests
- Request modifications if the component needs adjustments
- Tests are generated based on the final component structure
