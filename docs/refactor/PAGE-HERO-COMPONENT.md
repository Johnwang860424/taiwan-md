# PageHero — shared page hero component

**Status**: shipped 2026-04-11 (round 3: bgTone rename + about migrated → 10/10 main pages)
**Location**: `src/components/PageHero.astro`
**Complements**: `ArticleHero.astro` (individual articles with cover image + breadcrumb)

The top-level section index pages (`/soundscape`, `/resources`, `/contribute`, `/data`, `/map`, `/assets`, `/changelog`, `/about`) used to each hand-roll their own hero section. Adding a new hero axis (e.g. the broken `📊` emoji on `/data` that kept falling back to a box) meant editing one page at a time, and visual consistency drifted. `PageHero` collapses all those heroes into one component driven by enum props + slots.

## Pattern matrix (10 migrated pages, as of 2026-04-11)

| Page                        | bgVariant  | bgTone | titleVariant | titleFont | titleSize | containerWidth | Special slots / notes                   |
| --------------------------- | ---------- | ------ | ------------ | --------- | --------- | -------------- | --------------------------------------- |
| `/soundscape` (all 4 langs) | `none`     | light  | `solid`      | display   | lg        | full           | eyebrow / meta / footer                 |
| `/resources`                | `none`     | light  | `gradient`   | display   | lg        | full           | —                                       |
| `/contribute`               | `gradient` | dark   | `inherit`    | display   | lg        | full           | note                                    |
| `/map`                      | `solid`    | dark   | `inherit`    | display   | lg        | wide           | eyebrow                                 |
| `/data`                     | `none`     | dark   | `gradient`   | display   | clamp     | wide           | default (extra desc)                    |
| `/assets`                   | `none`     | light  | `solid`      | **sans**  | sm        | full           | —                                       |
| `/changelog`                | `none`     | light  | `solid`      | **sans**  | sm        | full           | meta (embedded link)                    |
| `/taiwan-shape`             | `none`     | light  | `solid`      | **sans**  | clamp     | **820 (num)**  | `eyebrowTracking=tight`                 |
| `/dashboard`                | `none`     | dark   | `inherit`    | display   | sm        | full           | nested inside custom rounded-card shell |
| `/about`                    | `none`     | light  | `solid`      | display   | lg        | wide           | first section of multi-section page     |

## All main pages now migrated

There are no remaining "deliberately not migrated" main pages. The earlier holdouts (`/about`, `/dashboard`, `/taiwan-shape`) all found a path in:

- **`/taiwan-shape`** uses `containerWidth: number` (820) + `eyebrowTracking: 'tight'` — two generic props that justified themselves
- **`/dashboard`** uses partial migration (nested PageHero inside the custom rounded-card shell)
- **`/about`** uses PageHero for its first section (the page-level hero), while the other 5 sections keep their own `.section-title` h2 styling — those h2s are _section_ headings, not page heroes

## Partial migration: `/dashboard`

Dashboard's outer shell is structurally unique (`rounded-2xl mb-4` card + animated EKG SVG background + JS-updated 3-stat row). Shoehorning all of that into PageHero would require `bgShape='rounded'` + `<slot name="background">` + stats slot — 3 new axes for 1 consumer.

Instead we **nest** `PageHero` inside the existing shell:

- **PageHero handles**: title (with inline emoji span), subtitle, meta (description), footer (cognitive-layer link)
- **Custom code handles**: rounded-card outer section, EKG SVG overlay, 3-stat flex row

Partial win: structural consistency for the "this page has a title" part, custom code only where it's genuinely unique. See `src/templates/dashboard.template.astro:15-90` for the full pattern.

## Single consumer = new prop?

`containerWidth: number` and `eyebrowTracking: 'tight'` were added specifically for `/taiwan-shape`. Justified because:

- Both are _generic_ axes that any future page might hit (not one-off hacks)
- Both default to the pre-existing behavior (`containerWidth` enum / `tracking-[0.15em]`), so existing consumers are untouched
- Taiwan-shape has clear editorial-voice reasons (narrower column + tighter kicker) that future editorial pages might also want

## API

### Props

```ts
interface Props {
  // ── Content (slot overrides prop) ──
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  subtitleHtml?: string; // for i18n set:html patterns

  // ── Title styling ──
  titleVariant?: 'solid' | 'gradient' | 'inherit'; // default 'solid'
  titleColor?: string; // when variant='solid'
  titleGradient?: string; // CSS `linear-gradient(...)` when variant='gradient'
  titleSize?: 'sm' | 'md' | 'lg' | 'clamp'; // default 'lg'
  titleFont?: 'display' | 'sans'; // default 'display'
  titleWeight?: 'normal' | 'bold' | 'extrabold' | 'black'; // default 'black'
  titleTracking?: 'tight' | 'normal' | 'wide'; // default 'tight'

  // ── Background ──
  /**
   * The tone of the BACKGROUND this hero sits on, NOT the text color.
   * `light` (default) → text cascades to dark (#1a1a2e).
   * `dark`            → text cascades to white.
   */
  bgTone?: 'light' | 'dark'; // default 'light'
  bgVariant?: 'none' | 'solid' | 'gradient'; // default 'none'
  bgColor?: string; // when bgVariant='solid'
  bgGradient?: string; // when bgVariant='gradient'

  // ── Layout ──
  containerWidth?: 'narrow' | 'default' | 'wide' | 'full' | number; // default 'default'
  // ↑ Number accepted as raw pixel width (e.g. 820) for one-off editorial columns.
  //   Handled via inline style since Tailwind JIT can't resolve dynamic arbitraries.
  padding?: 'compact' | 'default' | 'spacious'; // default 'default'

  // ── Accent ──
  accentColor?: string; // eyebrow color; falls back to bgTone default
  eyebrowTracking?: 'default' | 'tight'; // default 0.15em, tight 0.08em (taiwan-shape)
}
```

### Enum value meanings

| Prop             | Value      | CSS / behavior                                                                             |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `titleSize`      | `sm`       | `text-[2.2rem]` responsive → `1.6rem` (assets)                                             |
|                  | `md`       | `text-[2.8rem]` responsive → `2rem` (en/soundscape)                                        |
|                  | `lg`       | `text-[3.5rem]` responsive → `2.5rem → 2rem` (default)                                     |
|                  | `clamp`    | `text-[clamp(2.5rem,6vw,3.5rem)]` (data)                                                   |
| `titleFont`      | `display`  | adds `hero-title` class → justfont injects rixingsong-semibold                             |
|                  | `sans`     | `font-['jf-jinxuanlatte','Noto_Sans_TC','Source_Han_Sans_TC',sans-serif]`, no `hero-title` |
| `titleTracking`  | `tight`    | `-tracking-[0.02em]` (default — display faces)                                             |
|                  | `normal`   | no tracking                                                                                |
|                  | `wide`     | `tracking-[0.05em]` (changelog — spaced-out look)                                          |
| `containerWidth` | `narrow`   | `max-w-[900px]`                                                                            |
|                  | `default`  | `max-w-[1000px]`                                                                           |
|                  | `wide`     | `max-w-[1200px]`                                                                           |
|                  | `full`     | no max (for pages wrapped in their own container, or full-bleed with bg)                   |
| `padding`        | `compact`  | `py-8` (responsive `py-6`)                                                                 |
|                  | `default`  | `py-16` (responsive `py-8`)                                                                |
|                  | `spacious` | `py-20` (responsive `py-12`)                                                               |

### Slots

All optional. A slot, when present, **overrides** the matching prop.

| Slot       | Purpose                                             | First seen on                |
| ---------- | --------------------------------------------------- | ---------------------------- |
| `eyebrow`  | Small uppercase kicker above the title              | `/soundscape`                |
| `title`    | `<h1>` content (allows inline HTML)                 | —                            |
| `subtitle` | Subtitle paragraph (use for `<br>`, `<span>`, etc.) | `/soundscape`                |
| `meta`     | Small stats line under subtitle                     | `/soundscape`                |
| `note`     | Glass-rounded card below meta                       | `/contribute`                |
| `footer`   | Extra link / CTA at the very bottom                 | `/soundscape`                |
| default    | Fallback for fully custom extensions                | `/data` (second description) |

## Critical invariant

**Keep `hero-title` on the `<h1>` whenever `titleFont='display'`.** That class is how justfont's dynamic loader finds the element and injects `rixingsong-semibold`. Remove it and the title silently falls back to whatever the inherited `font-family` is — see `about.template.astro:1433-1437` for the hotfix history.

If a page wants a different display face, use `titleFont='sans'` explicitly. Don't try to hack it in via `titleColor` or some other prop — the font swap is the binary you care about.

## Usage examples

### 1. `/soundscape` — eyebrow + plain solid title + bilingual subtitle + meta + footer link

Sits inside an existing 900px wrapper, so `containerWidth='full'` opts out of extra max-width.

```astro
<PageHero containerWidth="full" titleColor="#1a3c34" accentColor="#065f46">
  <Fragment slot="eyebrow">🎧 Soundscape</Fragment>
  <Fragment slot="title">台灣聲景</Fragment>
  <Fragment slot="subtitle">
    有些故事，用耳朵聽比用眼睛看更真實。<br />
    <span class="text-[0.95rem] italic text-[#64748b]">
      Some stories are best told through ears.
    </span>
  </Fragment>
  <Fragment slot="meta">21 recordings · 23 wanted · 6 categories</Fragment>
  <Fragment slot="footer">
    📖 深度文章：<a href="/music/台灣聲音地景" class="...">台灣聲音地景</a>
  </Fragment>
</PageHero>
```

### 2. `/resources` — gradient-clip title + i18n HTML subtitle

```astro
<PageHero
  containerWidth="full"
  titleVariant="gradient"
  titleGradient="linear-gradient(135deg,#065f46,#059669,#10b981)"
  title={t('resources.hero.title')}
  subtitleHtml={t('resources.hero.subtitle.html')}
/>
```

### 3. `/contribute` — full-bleed gradient bg + white inherited title + note card

```astro
<PageHero
  bgVariant="gradient"
  bgGradient="linear-gradient(135deg,#2d5016,#4a7c59)"
  bgTone="dark"
  titleVariant="inherit"
  containerWidth="full"
  title={t('contribute.hero.title')}
  subtitle={t('contribute.hero.subtitle')}
>
  <p slot="note" set:html={t('contribute.hero.note.html')} />
</PageHero>
```

### 4. `/map` — solid dark color bg + eyebrow + white inherited title

```astro
<PageHero
  bgVariant="solid"
  bgColor="#1a3c34"
  bgTone="dark"
  titleVariant="inherit"
  containerWidth="wide"
  eyebrow={t('map.hero.kicker')}
  title={t('map.hero.title')}
  subtitle={t('map.hero.subtitle')}
  accentColor="rgba(255,255,255,0.7)"
/>
```

### 5. `/data` — gradient title + clamp size + extra description in default slot

```astro
<PageHero
  bgTone="dark"
  titleVariant="gradient"
  titleGradient="linear-gradient(135deg,#38bdf8,#818cf8,#c084fc)"
  titleSize="clamp"
  containerWidth="wide"
  title={t('data.hero.title')}
  subtitle={t('data.hero.subtitle')}
>
  <p class="mx-auto mt-4 max-w-[600px] text-base leading-[1.7] text-[#cbd5e1]">
    {t('data.hero.description')}
  </p>
</PageHero>
```

### 6. `/assets` — sans font, compact padding, solid green color

```astro
<PageHero
  containerWidth="full"
  padding="compact"
  titleFont="sans"
  titleWeight="normal"
  titleTracking="normal"
  titleSize="sm"
  titleColor="#2d5016"
  title={t('assets.hero.title')}
  subtitle={t('assets.hero.subtitle')}
/>
```

### 7. `/changelog` — sans font, wide tracking, custom meta slot with inline link

```astro
<PageHero
  containerWidth="full"
  padding="compact"
  titleFont="sans"
  titleTracking="wide"
  titleSize="sm"
  title={t('changelog.header.title')}
  subtitle={t('changelog.header.subtitle')}
>
  <p slot="meta" class="[&>a]:text-[#3b82f6]">
    {commits.length} updates · {sourceLabel} ·
    <a href="...">GitHub</a>
  </p>
</PageHero>
```

## Why `bgTone`, not `tone`

The prop is named `bgTone` (not `tone`) deliberately. An earlier iteration used `tone='dark'` and the migration of `/en/soundscape` triggered an invisible-text bug — I assumed `tone='dark'` meant "dark text" when it actually meant "dark background → white text cascades down". Took a screenshot + DOM inspection to figure out.

The rename to `bgTone` makes it impossible to misread: the prop describes the **background**, the resulting text color is the cascade.

**General rule**: when naming props, prefer words that describe the rendered effect (`bgTone`, `textColor`, `surfaceColor`) over words that describe the context (`tone`, `mood`, `theme`). If the docs need a sentence to clarify "what does this prop actually change?", the name is too abstract — rename the prop instead of writing the gotcha.

See the auto-memory entry `feedback_api_naming_effect_not_context.md` for the full lesson.

## Related files

- `src/components/PageHero.astro` — the component
- `src/components/ArticleHero.astro` — sibling for individual article pages (different concern: cover image, breadcrumb, TTS button)
- `src/templates/soundscape.template.astro` — reference consumer using `PageHero` + full data-driven template pattern
- `src/data/soundscape-data.ts` — reference data file showing the `Localized` + `localize()` i18n pattern for complex multi-language data

---

# Nav overview-first pattern

Related design work from the same round. The desktop header (`src/components/Header.astro`) has six dropdown navs: **關於 / 探索 / 地圖 / 數據 / 監測 / 參與**. All six had the same UX issue — when a nav item shows a dropdown arrow, users read it as a category folder and may not realize the top-level label is itself clickable and navigates to the parent page.

The fix is a unified "overview-first" pattern: every dropdown's **first item** is a `dropdown-section-header`-styled link back to the same destination as the top-level nav, followed by a `dropdown-divider`, then the real children.

```astro
<div class="dropdown-menu">
  <a href={parentUrl} class="dropdown-item dropdown-section-header">
    {t('nav.XXX')}
  </a>
  <div class="dropdown-divider"></div>
  {/* section anchors or sub-pages */}
</div>
```

**Clickability signal**: the overview item is visually distinct (bolder / different color via `dropdown-section-header`), and the divider separates it from the rest. Users learn that the top-level nav IS clickable — and if they're unsure, the dropdown's first item makes it explicit.

## Two kinds of dropdown

1. **Section-anchor dropdowns** (關於 / 數據 / 監測 / 參與) — the dropdown items are `#anchor` jumps to sections of the same parent page. The overview item is the parent page itself (top of page). Example:

   ```
   數據 ▾
     ├── 數據 📊            (overview → /data)
     ├── ───
     ├── 🌏 台灣 vs 世界     (→ /data#global)
     ├── 📡 數位民主         (→ /data#democracy)
     └── ...
   ```

2. **Sub-page dropdowns** (地圖 / 探索) — the dropdown items are real separate pages. The overview item descends to the parent's primary destination.
   - `/map` → 地理台灣 (interactive map) + 台灣的形狀 (/taiwan-shape)
   - `/探索` → overview to `/#categories` (home section), then knowledge graph, terminology, 12 category pages

## Naming rule: when the overview label collides with a child

For `/map`, the raw label "地圖" was too terse and collided with "台灣的形狀" (they're both about maps). Added a dedicated i18n key `nav.map.explore` = "地理台灣" / "Geographic Taiwan" / "地理で見る台湾" / "지리 타이완" to describe the interactive-map page specifically.

General rule: if the overview label and a child item are the same _concept_, give the overview a more descriptive label. If they're clearly different _aspects_ (like 數據 → 台灣 vs 世界 / 數位民主), the plain parent label is fine.

## Emoji duplication gotcha

Several zh-TW nav labels already include a trailing emoji (`探索 🕸️`, `地圖 📍`, `數據 📊`, `監測 🔬`, `參與 ✋`). When adding the overview item, **don't prefix another emoji** — you'll end up with `📊 數據 📊`. Use the label verbatim; the `dropdown-section-header` style is enough to distinguish it visually.

`/map` is the exception because it uses a custom label (`nav.map.explore` = "地理台灣") that has no emoji of its own, so the `📍` prefix is added explicitly.

## Mobile sub-links

Mobile nav (hamburger menu) is sparser than desktop. Only `/#categories` (→ graph, terminology) and `/map` (→ taiwan-shape) have mobile sub-links. Section-anchor dropdowns don't expose sub-items on mobile — users land on the parent page and scroll.

Rationale: mobile users have the whole page at their fingertips after one tap. A multi-level mobile nav creates more friction than it saves.
