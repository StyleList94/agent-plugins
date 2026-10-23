# Tailwind CSS v4 Patterns Reference

## Auto-Calculated Spacing

Tailwind v4 extends spacing scale with auto-calculated values:

```
Formula: value * 4px

Common mappings:
p-1   = 4px
p-2   = 8px
p-3   = 12px
p-4   = 16px
p-5   = 20px
p-6   = 24px
p-8   = 32px
p-10  = 40px
p-12  = 48px
p-13  = 52px   (new in v4)
p-14  = 56px   (new in v4)
p-16  = 64px
p-18  = 72px   (new in v4)
p-20  = 80px
p-24  = 96px
```

## CSS-First Configuration

Tailwind v4 uses CSS-based configuration instead of JavaScript:

```css
@import 'tailwindcss';

@theme {
  /* Breakpoints */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;

  /* Custom breakpoints */
  --breakpoint-tablet: 992px;

  /* Fonts */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Colors (oklch for better color mixing) */
  --color-primary: oklch(0.7 0.15 250);
  --color-secondary: oklch(0.6 0.1 200);

  /* Spacing */
  --spacing-header: 72px;
  --spacing-sidebar: 256px;

  /* Animations */
  --animate-fade-in: fade-in 0.3s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## Class Organization Order

Apply classes in this order for consistency and readability:

### Order Convention

1. **Layout** - Display, position, flex/grid
2. **Sizing** - Width, height, min/max
3. **Spacing** - Padding, margin, gap
4. **Typography** - Font, text, whitespace
5. **Colors** - Background, text color, border color
6. **Effects** - Shadow, rounded, opacity
7. **Responsive** - sm:, md:, lg:, xl:
8. **State** - hover:, focus-visible:, active:, disabled:

### Examples

```tsx
// Good: Organized order
<div className="flex items-center justify-between w-full h-16 px-6 py-4 text-sm font-medium text-gray-900 bg-white border-b shadow-sm rounded-lg md:px-8 hover:bg-gray-50">

// Good: Multi-line for complex
<button
  className={cn(
    // Layout
    'inline-flex items-center justify-center',
    // Sizing
    'h-10 px-4',
    // Typography
    'text-sm font-medium',
    // Colors
    'text-white bg-blue-600',
    // Effects
    'rounded-md shadow-sm',
    // State
    'hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
    // Disabled
    'disabled:opacity-50 disabled:cursor-not-allowed'
  )}
>
  Submit
</button>
```

## Container Queries

Tailwind v4 native container query support:

```tsx
// Container context
<div className="@container">
  <div className="@md:flex @lg:grid @lg:grid-cols-2">
    {/* Responds to container width */}
  </div>
</div>
```

## Color Opacity Syntax

Modern opacity syntax:

```tsx
// Tailwind v4 syntax
<div className="bg-black/50 text-white/90 border-gray-200/75">

// Equivalent to
// background-color: rgb(0 0 0 / 0.5)
// color: rgb(255 255 255 / 0.9)
// border-color: rgb(229 231 235 / 0.75)
```

## Arbitrary Values

Custom values using square bracket notation:

```tsx
// Custom values
<div className="w-[350px] h-[calc(100vh-80px)] p-[13px] bg-[#1a1a1a]">

// CSS variables
<div className="bg-[var(--custom-color)] p-[var(--custom-spacing)]">

// Expressions
<div className="grid-cols-[200px_1fr_200px] gap-[clamp(1rem,2vw,2rem)]">
```

## Gradient Utilities

Enhanced gradient support:

```tsx
// Linear gradients
<div className="bg-gradient-to-r from-blue-500 to-purple-500">
<div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">

// With opacity
<div className="bg-gradient-to-r from-blue-500/80 to-purple-500/80">

// Gradient text
<span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
```

## Flexbox Patterns

Common flex layouts:

```tsx
// Center content
<div className="flex items-center justify-center">

// Space between with gap
<div className="flex items-center justify-between gap-4">

// Column layout with gap
<div className="flex flex-col gap-6">

// Wrap with gap
<div className="flex flex-wrap gap-3">

// Grow/shrink
<div className="flex">
  <div className="flex-none w-16">Fixed</div>
  <div className="flex-1">Grows</div>
  <div className="flex-none w-16">Fixed</div>
</div>
```

## Grid Patterns

Common grid layouts:

```tsx
// Basic grid
<div className="grid grid-cols-3 gap-4">

// Responsive grid
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

// Auto-fit
<div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">

// Named grid areas (arbitrary)
<div className="grid grid-cols-[200px_1fr] grid-rows-[auto_1fr_auto]">
  <header className="col-span-2">Header</header>
  <aside>Sidebar</aside>
  <main>Content</main>
  <footer className="col-span-2">Footer</footer>
</div>
```

## Typography Utilities

Text styling patterns:

```tsx
// Heading styles
<h1 className="text-4xl font-bold tracking-tight text-gray-900">
<h2 className="text-2xl font-semibold text-gray-900">
<h3 className="text-lg font-medium text-gray-900">

// Body text
<p className="text-base text-gray-600 leading-relaxed">
<p className="text-sm text-gray-500">

// Truncation
<p className="truncate">                  {/* Single line */}
<p className="line-clamp-2">              {/* Multi-line */}
<p className="line-clamp-3 sm:line-clamp-none">  {/* Responsive */}
```

## Responsive Design Patterns

Mobile-first responsive utilities:

```tsx
// Mobile-first
<div className="text-sm md:text-base lg:text-lg">

// Hide/show at breakpoints
<div className="hidden md:block">Desktop only</div>
<div className="md:hidden">Mobile only</div>

// Responsive spacing
<div className="p-4 md:p-6 lg:p-8">

// Responsive layout
<div className="flex flex-col md:flex-row md:items-center gap-4">
```

## Focus & Accessibility

Focus state patterns:

```tsx
// Focus ring, keyboard focus only (`:focus` would also ring on mouse click)
<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">

// Disabled states
<button className="disabled:opacity-50 disabled:cursor-not-allowed">

// Screen reader only
<span className="sr-only">Screen reader text</span>
```

## Animation Utilities

Built-in animations:

```tsx
// Spin
<svg className="animate-spin h-5 w-5">

// Pulse
<div className="animate-pulse bg-gray-200 rounded">

// Bounce
<div className="animate-bounce">

// Ping (notification dot)
<span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-sky-400 opacity-75">
```

## Dark Mode

Dark mode utilities:

```tsx
// Dark mode variants
<div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white">

// Dark mode with hover
<button className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">
```

## Figma to Tailwind Mapping

Common Figma property translations:

| Figma Property | Tailwind Class |
|----------------|----------------|
| Auto Layout (horizontal) | `flex flex-row` |
| Auto Layout (vertical) | `flex flex-col` |
| Gap: 16px | `gap-4` |
| Padding: 24px | `p-6` |
| Fill: Stretch | `flex-1` or `w-full` |
| Hug contents | `w-fit` |
| Fixed width: 200px | `w-[200px]` |
| Border radius: 8px | `rounded-lg` |
| Border radius: 9999px | `rounded-full` |
| Drop shadow | `shadow-md` |
| Font size: 14px | `text-sm` |
| Font weight: 600 | `font-semibold` |
| Line height: 1.5 | `leading-normal` |
| Letter spacing: -0.02em | `tracking-tight` |
| Opacity: 50% | `opacity-50` or `/50` |
