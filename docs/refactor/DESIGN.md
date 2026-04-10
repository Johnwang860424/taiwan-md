# DESIGN.md — Taiwan.md Styling System

> Post-refactor (2026-04) guide for how styling works in this repo and
> how to add new UI without fighting the system.

## TL;DR

- **Design tokens** live in [`src/styles/tokens.css`](../../src/styles/tokens.css). Never hardcode container widths, spacing, colors, or fonts — use `var(--...)` or the equivalent Tailwind arbitrary value.
- **Site base** lives in [`src/styles/global.css`](../../src/styles/global.css) `@layer base` (typography, body, links, floating .md button, justfont). Don't add component CSS here.
- **New UI** uses inline Tailwind utilities (`class="flex items-center gap-4 p-6 rounded-xl ..."`). Reach for arbitrary values (`bg-[#007864]`, `[grid-template-areas:'toc_body_sidebar']`) when Tailwind doesn't ship the exact value.
- **Scoped `<style>`** is a tool, not a debt. Use it when a pattern repeats many times (row list, card grid) or cascades through state (JS-toggled `.active`, `.visible`, scroll-state machine). **Inlining 60 arbitrary variants across 8 repeating elements is worse than 10 lines of scoped CSS.**

## Architecture

```
tokens.css              ← design system SSOT (CSS vars only)
    ↓
global.css              ← @layer base (preflight + site typography/body/links)
    ↓ @layer utilities  ← Tailwind atomic utilities
    ↓
component scoped <style> ← highest priority, always wins
```

- Tailwind v4 is loaded via explicit layered imports so we control exactly which cascade layer the reset / utilities land in.
- No `@apply`, no `@layer components`, no `@theme` bridge — they were tried in Phase 2 and deleted in Phase 7 because nothing adopted them.
- The `components` layer doesn't exist. If you want a reusable pattern, keep it as scoped CSS in the component file.

## Decision tree: scoped `<style>` vs inline Tailwind

```
Is the style on a single DOM element that appears once in this component?
├── Yes → inline Tailwind
│       class="flex items-center gap-4 px-8 py-16 text-center"
│
└── No, it repeats or cascades
    │
    ├── Does it use JS-toggled state classes (.active, .hidden, .visible)?
    │       → scoped CSS (or `[&.active]:` arbitrary variant if <5 rules)
    │
    ├── Is it `:global()` styling for innerHTML-rendered content
    │  (markdown prose, JS-appended elements, search result items)?
    │       → scoped CSS with `:global(...)` — Tailwind can't reach them
    │
    ├── Does it use `@keyframes` referenced via `animation: var(--foo)`?
    │       → keyframes at global scope (global.css) or scoped CSS;
    │         Tailwind arbitrary animations can't resolve dynamic names
    │
    ├── Is it a pattern that repeats >5 times in a loop (card, row, chip)?
    │       → scoped CSS, with Tailwind for the outer layout
    │
    └── Is it a CSS-variable state machine (Header's transparent-hero ↔
        white-scrolled bar with 25+ cascaded variables)?
            → scoped CSS with `:root` / selector-scoped vars; inlining
              20+ [.scrolled_&]: variants per child element is worse
```

**The goal is NOT zero `<style>` blocks — it's "every line of CSS earns its place."**

## Examples

### 1. Simple single-use wrapper → inline Tailwind

```astro
<!-- Before: -->
<section class="hero">...</section>
<style>
  .hero {
    padding: 4rem 2rem;
    background: #1a3c34;
    color: white;
    text-align: center;
  }
</style>

<!-- After: -->
<section class="bg-[#1a3c34] px-8 py-16 text-center text-white">...</section>
```

### 2. Repeating card pattern → scoped CSS

```astro
<!-- 8 exhibition halls, each with ~15 child classes — inlining would
     produce 120+ class strings in the map loop. Keep scoped. -->{
  halls.map((hall) => (
    <div class="exhibition-hall">
      <div class="hall-divider">...</div>
      <div class="hall-body">
        <p>
          ... <a class="topic-pill">...</a> ...
        </p>
      </div>
      <div class="hall-picks">
        {hall.picks.map((p) => (
          <a class="pick-card">
            <span class="pick-head">...</span>
            <p class="pick-desc">...</p>
          </a>
        ))}
      </div>
    </div>
  ))
}
<style>
  .hall-divider {
    display: flex;
    align-items: center;
    margin: 4rem 0 2.5rem;
  }
  .hall-line {
    flex: 1;
    height: 1px;
    background: #e5e5e5;
  }
  .hall-label {
    padding: 0 1.5rem;
    font-family: 'Georgia', serif;
  }
  /* hall-body, topic-pill, pick-card, pick-head, pick-desc... */
</style>
```

### 3. JS-rendered content → `:global()` scoped CSS

```astro
<div class="hub-prose" set:html={markdownHtml} />
<style>
  /* The markdown body is innerHTML'd — its <h1>, <p>, <blockquote>
     elements can't be reached by Tailwind class="..." */
  .hub-prose :global(h1) {
    font-size: 2rem;
    color: #1a3c34;
  }
  .hub-prose :global(blockquote) {
    border-left: 4px solid var(--catColor);
  }
  .hub-prose :global(blockquote.callout-note) {
    border-left-color: #3b82f6;
  }
</style>
```

### 4. State machine → scoped CSS variables

```astro
<!-- Header has transparent-hero and white-scrolled states with
     25+ cascaded variables. Scoped vars are cleaner than inlining
     20+ [.scrolled_&]: variants on every child. -->
<header class:list={['header', { scrolled: !isHome }]}>
  <nav class="nav-desktop">
    <a class="nav-link">...</a>
  </nav>
</header>
<style>
  header {
    --nav-color: #475569;
    --nav-hover-bg: rgba(148, 163, 184, 0.1);
    --logo-color: #1a1a2e;
    /* 22 more variables below */
  }
  header[data-hero]:not(.scrolled) {
    --nav-color: #ffffff;
    --nav-hover-bg: rgba(255, 255, 255, 0.15);
    --logo-color: #ffffff;
    /* 22 more overrides below */
  }
  .nav-link {
    color: var(--nav-color);
  }
  .nav-link:hover {
    background: var(--nav-hover-bg);
  }
  .logo {
    color: var(--logo-color);
  }
</style>
```

### 5. JS-created elements → inline Tailwind class strings in the script

```astro
<script>
  const tooltip = d3
    .select('#chart')
    .append('div')
    // D3 creates this div dynamically. Instead of styling it via
    // :global(.tooltip), assign the Tailwind utility string directly.
    .attr(
      'class',
      'pointer-events-none absolute z-[100] max-w-[280px] rounded-lg bg-black/85 px-3 py-[10px] text-[0.85rem] leading-[1.5] text-white',
    )
    .style('opacity', 0);
</script>
```

## Patterns we landed during the refactor

Cataloged here so you don't have to rediscover them.

| Need                                   | Pattern                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| CSS variable inside arbitrary value    | `bg-[color-mix(in_srgb,var(--accent)_6%,#f8f1e9)]` (underscores for spaces)                    |
| Dynamic animation via CSS var          | `group-hover:[animation:var(--anim)_2.5s_ease-in-out_infinite]` + `@keyframes` in `global.css` |
| JS-toggled state class                 | `[&.active]:bg-[#2563eb]` / `[&.visible]:flex` / `[&.hidden]:hidden`                           |
| Style a descendant from parent         | `[&_.row-title]:font-bold` / `[&_a:hover]:underline` / `[&>strong]:block`                      |
| Style a specific child `id`            | `[&_#tts-play]:rounded-full [&_#tts-play]:bg-white/10`                                         |
| 3-column grid with named areas         | `grid grid-cols-[220px_1fr_200px] [grid-template-areas:'toc_body_sidebar']`                    |
| Move to single column below `lg`       | `max-lg:grid-cols-1 max-lg:[grid-template-areas:'body'_'sidebar']`                             |
| `group` + parent-triggered child state | `<a class="group"><span class="group-hover:translate-x-1">→</span></a>`                        |
| Reduced motion override                | `motion-reduce:transform-none motion-reduce:animate-none`                                      |
| Responsive custom breakpoints          | `max-[768px]:`, `max-[640px]:`, `max-[480px]:`, `max-[380px]:`                                 |
| CSS-var-driven per-instance size       | `style={\`--accent: ${color}; --min-h: ${h};\`}`+`min-h-[var(--min-h)] bg-[var(--accent)]`     |

## What NOT to do

- **Don't** add colors inline as `#hex` without going through tokens or Tailwind arbitrary. If it's a site-level color, add it to `tokens.css`. If it's one-off, use `bg-[#xxxxxx]`.
- **Don't** reach for `@apply` — it's disabled by the Phase 7 architecture. Use scoped CSS with `var(--token)` for anything complex.
- **Don't** create a "reusable class library" of `tw-btn`, `tw-card`, etc. Phase 2 built one and Phase 7 deleted it unused. If a pattern is reusable, extract an Astro component instead — components compose in JSX, classes don't.
- **Don't** leave dead `<style>` rules behind when migrating markup. If you inline a class, delete its scoped rule in the same commit.
- **Don't** rely on Tailwind's `@theme` to bridge tokens → utilities (`font-title`, `max-w-reading`, `bg-ink`). That bridge was deleted in Phase 7 because no markup used the generated classes.

## When in doubt

- Read [`docs/refactor/REFACTOR-LOG.md`](./REFACTOR-LOG.md) for the phase-by-phase history and the "why" behind every architectural choice.
- Read [`docs/refactor/ADR-001-tailwind-flip-timing.md`](./ADR-001-tailwind-flip-timing.md) for the Phase 3 decision to enable preflight early instead of at the end.
- Grep the repo for the pattern you're trying to build — chances are Phase 4–7.5 already landed something similar.
