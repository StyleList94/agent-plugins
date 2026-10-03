---
name: react-tsdoc
description: Generate TSDoc comments for React components and hooks
argument-hint: "[file-path]"
tools: Bash, Read, Edit, Glob, Grep
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

Add TSDoc comments to React components and custom hooks.

## Language Detection

- Korean README.md → Korean comments
- English README.md → English comments
- No README.md → English default

## Props Type Documentation

Add individual JSDoc comments to each prop:

```typescript
export type ButtonProps = HTMLMotionProps<'button'> & {
  /**
   * Specifies the button style
   * @defaultValue 'solid'
   */
  variant?: ButtonVariant;
  /**
   * Specifies the button size
   * @defaultValue 'md'
   */
  size?: ButtonSize;
  /** Elements to render inside the button */
  children?: ReactNode;
};
```

### Rules

- Use `@defaultValue` tag when default value exists
- Single-line: `/** description */` format
- Multi-line: `/**` + newline + ` * description` format

## Component Function Documentation

```typescript
/**
 * Button component with various styles and sizes
 *
 * @remarks
 * - Supports Framer Motion animations
 * - Accessibility (a11y) compliant
 *
 * @example
 * ```tsx
 * <Button variant="solid" size="md">
 *   Click me
 * </Button>
 * ```
 *
 * @see {@link IconButton} - Icon-only button variant
 */
export const Button = ({ variant = 'solid', size = 'md', children, ...props }: ButtonProps) => {
  // ...
};
```

### Tags

| Tag | Purpose | Required |
| --- | ------- | -------- |
| (first line) | Component description (one line) | Yes |
| `@remarks` | Additional notes, caveats | Optional |
| `@example` | Usage example (tsx code block) | Yes |
| `@see` | Related component references | Optional |

## Custom Hooks Documentation

```typescript
/**
 * Manages toggle state
 *
 * @param initialValue - Specifies the initial value
 * @defaultValue false
 * @returns Toggle state and control functions
 *
 * @remarks
 * - Safe for SSR environments
 * - State changes trigger re-renders
 *
 * @example
 * ```tsx
 * const [isOpen, toggle, setIsOpen] = useToggle(false);
 *
 * <Button onClick={toggle}>Toggle</Button>
 * <Button onClick={() => setIsOpen(true)}>Open</Button>
 * ```
 */
export const useToggle = (initialValue = false): UseToggleReturn => {
  // ...
};
```

### Hook Return Type Documentation

Document each element in tuple/object returns:

```typescript
export type UseToggleReturn = [
  /** Current toggle state */
  boolean,
  /** Toggles the state */
  () => void,
  /** Sets the state directly */
  Dispatch<SetStateAction<boolean>>
];
```

Object returns:

```typescript
export type UseCounterReturn = {
  /** Current count value */
  count: number;
  /** Increments count by 1 */
  increment: () => void;
  /** Decrements count by 1 */
  decrement: () => void;
  /** Resets count to initial value */
  reset: () => void;
};
```

## Compound Component Pattern

```typescript
/**
 * Tab container component
 *
 * @example
 * ```tsx
 * <Tabs defaultValue="tab1">
 *   <TabsList>
 *     <TabsTrigger value="tab1">Tab 1</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="tab1">Content 1</TabsContent>
 * </Tabs>
 * ```
 *
 * @see {@link TabsList} - Tab button group
 * @see {@link TabsTrigger} - Individual tab button
 * @see {@link TabsContent} - Tab content panel
 */
export const Tabs = (props: TabsProps) => { /* ... */ };
```

## Behavior

1. Specify target file or component
2. Detect README.md language
3. Add JSDoc to Props types
4. Add TSDoc to component/hook functions
5. Add `@see` tags for related components
