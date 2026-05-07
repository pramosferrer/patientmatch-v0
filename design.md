# PatientMatch Design System

## Overview

**Aesthetic direction: Meridian** — editorial, warm, trustworthy. Designed to feel like a premium health publisher, not a tech startup or a hospital form. Patients are making serious decisions; the design earns trust through restraint, warmth, and clarity.

**Core principles:**
- Warmth over coldness — cream backgrounds, organic greens, soft aurora gradients instead of clinical white/grey
- Editorial typography — Fraunces display font for all hero headlines; Inter for body; Manrope for nav/labels
- Condition colors — every condition in the system has a unique hex that drives dot indicators, stat colors, and tinted section backgrounds
- No decorative chrome — no border-top accent cards, no icon-in-box grids, no dashed connectors; let type and color carry the weight

---

## Color Palette

All colors are defined as CSS variables in `globals.css` and mapped to Tailwind in `tailwind.config.js`.

### Base palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-background` | `#FAF8F5` | Page background (warm off-white) |
| `--color-foreground` | `#1F2933` | Primary text (rich near-black) |
| `--color-muted` | `#4F5B6A` | Secondary text |
| `--color-muted-foreground` | `#5F6B7A` | De-emphasized text, placeholders |
| `--color-border` | `#D7D2C9` | Default borders (warm grey) |
| `--color-border-strong` | `#C2BCB0` | Stronger dividers |
| `--color-card` | `#FFFFFF` | Card surfaces |

### Brand

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#2D9B70` | Brand green — buttons, links, icons, eyebrow text |
| `--color-primary-strong` | `#247A5A` | Hover/active state for primary |
| `--color-primary-foreground` | `#FFFFFF` | Text on primary buttons |

### Surfaces

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--color-surface-cream` | `#FAF8F5` | `bg-warm-cream` | Default page surface |
| `--color-surface-petal` | `#EEE2D6` | `bg-warm-petal` | Warm tinted accents |
| `--color-surface-rose` | `#F6DAD1` | `bg-warm-rose` | Warm pink accents |
| `--color-surface-sage` | `#E8EDE6` | `bg-warm-sage` | Alternating section bg (Timeline, CtaBand) |

> **Rule:** Marketing sections alternate between `bg-white` and `bg-[#E8EDE6]` (sage). Never use `--color-background` (#FAF8F5) as a section bg — reserve it for the page body only.

### Aurora (ambient background blobs)

| Token | Value |
|-------|-------|
| `--aurora-mint` | `#BCE7D6` |
| `--aurora-blush` | `#F5CFC5` |
| `--aurora-coral` | `#F7B09F` |
| `--aurora-amber` | `#F6DAB7` |

Aurora blobs appear on the Hero section only. They animate at 26s ease-in-out. Use the `<AuroraBG>` component; do not recreate the animation manually.

### Semantic accent palette

These break the monochromatic green and convey specific meanings:

| Token | Value | Semantic |
|-------|-------|---------|
| `--color-urgency` | `#D97706` | Amber — "enrolling now", time-sensitive |
| `--color-distance` | `#0369A1` | Sky blue — location/proximity |
| `--color-phase` | `#7C3AED` | Violet — trial phase indicators |
| `--color-sponsor` | `#64748B` | Slate — sponsor/org info |
| `--color-caution` | `#CA8A04` | Yellow-amber — "opening soon" |
| `--color-invitation` | `#2563EB` | Blue — "by invitation" |

### Condition color system

Each condition has a unique hex color. These drive:
- Dot indicators (8–9px circles)
- Count/stat text color
- Hover tints on cards (`${hex}09`)
- Section backgrounds (`${hex}07`, ~2.7% opacity)
- CTA band borders (`${hex}18`)

Use `getConditionHex(slug)` from `components/icons/ConditionIcon.tsx`. It returns an explicit hex for ~25 major conditions and falls back to a deterministic 12-color palette for unknowns.

**Explicit hex assignments (top conditions):**

| Condition | Hex |
|-----------|-----|
| Long COVID | `#047857` |
| Fibromyalgia | `#6D28D9` |
| Obesity | `#D97706` |
| Type 2 Diabetes | `#0891B2` |
| Depression | `#2563EB` |
| Migraine | `#7C3AED` |
| Breast Cancer | `#BE185D` |
| COPD | `#0369A1` |
| Rheumatoid Arthritis | `#DC2626` |
| Multiple Sclerosis | `#6D28D9` |

---

## Typography

### Font families

**Two fonts only: Fraunces + Inter.** This was an explicit decision in the design direction — three fonts is noise.

| Variable | Font | Tailwind class | Usage |
|----------|------|----------------|-------|
| `--font-display` | Fraunces | `font-display` | Hero headlines, section headings, large stat numbers |
| `--font-body` | Inter | `font-sans` (default) | All body copy, UI labels, navigation, eyebrows, descriptions |

> **Manrope (`font-heading`) and Merriweather (`font-serif`) are still loaded in `layout.tsx` but should not be used in new work.** Both are legacy — Manrope was the previous heading font, Merriweather was the wordmark font. Replace any `font-heading` or `font-serif` usage with `font-sans` (Inter) at weight 500–600 for UI labels, or `font-display` (Fraunces) for editorial headings.

> **Critical rule:** Fraunces (`font-display`) is always `font-normal` (weight 400) for display headings. Never use `font-bold` or `font-semibold` with Fraunces — the letter-forms are designed for normal weight. Fraunces `font-light` (300) is used for large numeral stats and step indicators.

> **Inter for UI:** Navigation links, eyebrows, footer column headers, card labels, and button text all use Inter (`font-sans`) at weight 500 (`font-medium`) or 600 (`font-semibold`). Inter 500/600 at small sizes is cleaner and more confident than Manrope for these contexts.

### Type scale

| Role | Size | Weight | Tracking | Line-height | Notes |
|------|------|--------|----------|-------------|-------|
| Hero H1 | `clamp(36px, 4.2vw, 56px)` | `font-normal` | `-0.022em` | `1.08` | `font-display`, with italic green `<em>` |
| Page H1 (condition detail) | `clamp(44px, 5.5vw, 68px)` | `font-normal` | `-0.024em` | `1.06` | `font-display`, larger for editorial pages |
| Section H2 | `clamp(28px, 3.5vw, 44px)` | `font-normal` | `-0.018em` | — | `font-display` |
| Checklist H2 | `clamp(26px, 3vw, 40px)` | `font-normal` | `-0.015em` | `1.14` | `font-display` |
| Inline CTA H2 | `clamp(28px, 4vw, 48px)` | `font-normal` | `-0.022em` | `1.1` | `font-display` |
| Card H2 / Prose H2 | `28px` fixed | `font-normal` | `-0.015em` | — | `font-display` |
| Step numeral | `76px` | `font-light` | `-0.05em` | none | `font-display text-primary/[0.22]` |
| Condition stat | `clamp(28px, 3.5vw, 44px)` | `font-light` | `-0.03em` | — | `font-display`, condition color |
| Featured card numeral | `56px` | `font-light` | `-0.04em` | `0.92` | `font-display`, condition color |
| Body / Subhead | `17–17.5px` | `font-normal` | — | `relaxed (1.5–1.6)` | `text-muted-foreground` |
| UI body | `15–15.5px` | `font-normal` | — | `1.55–1.62` | `text-muted-foreground` |
| Label / caption | `13.5–14.5px` | `font-medium` or `font-semibold` | — | — | |
| Eyebrow | `11px` | `font-semibold` or `font-bold` | `0.12–0.14em` | — | `uppercase text-primary` or `text-muted-foreground/60` |
| Micro trust line | `12–12.5px` | `font-normal` | — | — | `text-muted-foreground/70` |

> **Italic green em:** Hero H1 uses `<em className="not-italic italic text-primary">` for the trailing phrase. This is the only place italics appear in display copy.

---

## Spacing & Layout

### Container

```css
.pm-container {
  margin: 0 auto;
  width: 100%;
  max-width: 1280px; /* screen-xl */
  padding: 0 1.5rem; /* px-6 */
}
```

### Section padding

- Marketing sections: `py-24` (96px top/bottom)
- Hero: uses `pm-section` = `py-16 md:py-24`
- Tight sections (TrustBar): `py-14`
- Condition header band: `pb-14 pt-14`

### Grid layouts

| Component | Layout |
|-----------|--------|
| Hero | `lg:grid-cols-2` gap-16 / lg:gap-[72px] |
| TrustBar | `grid-cols-2 md:grid-cols-4` gap-y-8 |
| Timeline steps | `md:grid-cols-3` gap-14 |
| Checklist | `md:grid-cols-[5fr_7fr]` gap-20 |
| Conditions featured | `lg:grid-cols-3 sm:grid-cols-2` gap-4 |
| Conditions directory | full-width column of rows |
| Condition detail editorial | `md:grid-cols-2` gap-16 |
| Condition detail header | `lg:grid-cols-[1fr_auto]` gap-12 |
| Trial cards | `md:grid-cols-2 lg:grid-cols-3` gap-4 |

### Sticky sidebar pattern

Used in Checklist and Condition detail (MicroScreener container):
```tsx
<div className="md:sticky md:top-20">
  {/* Left/sidebar content */}
</div>
```

---

## Borders, Radius & Shadows

### Border radius

| Size | Value | Usage |
|------|-------|-------|
| `rounded-lg` | `1rem` | Standard cards |
| `rounded-xl` | `1.25rem` | Input fields |
| `rounded-2xl` | `1.75rem` | Featured cards, form containers |
| `rounded-3xl` | `1.875rem` | MicroScreener card |
| `rounded-[11px]` | `11px` | Internal form pill inputs, submit buttons |
| `rounded-full` | `9999px` | Dots, badge pills |

### Borders

- Hairline dividers: `border-border/40` or `border-border/42` (opacity variants)
- Section borders: `border-border/50`
- Card borders: `border-border/45`
- Focus ring: `3px solid var(--color-focus)` with `outline-offset: 3px`
- `--pm-hairline`: `rgba(148, 163, 184, 0.45)` — used on nav bar

### Shadows

| Name | Value | Usage |
|------|-------|-------|
| Card soft | `0 2px 4px rgba(45,80,60,0.05), 0 16px 48px -12px rgba(45,80,60,0.12)` | Cards, MicroScreener |
| Hero form | `0 2px 4px rgba(45,80,60,0.04), 0 20px 56px -16px rgba(45,80,60,0.15)` | Search form floating card |
| CTA button | `0 4px 20px rgba(45,155,112,0.28)` | Primary brand button on sage bg |
| CTA button hover | `0 8px 32px rgba(45,155,112,0.32)` | |
| Aurora ambient | `0 46px 140px -88px rgba(45,155,112,0.25)` | Below hero |

---

## Components

### Eyebrow

Always the same treatment: `text-[11px] font-semibold uppercase tracking-[0.12em]`

Two color variants:
- **Brand**: `text-primary` — used when the eyebrow leads into a section with a clear value prop
- **Muted**: `text-muted-foreground/60` — used for classification labels (e.g., "What trials involve")

```tsx
<div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
  How it works
</div>
```

### Section heading (H2)

Always `font-display font-normal` with negative tracking. Size varies by context (see type scale). Always immediately follows an eyebrow.

```tsx
<h2
  className="font-display font-normal text-foreground tracking-[-0.018em]"
  style={{ fontSize: "clamp(28px, 3.5vw, 44px)" }}
>
  Three steps to your best match
</h2>
```

### Badge / pill

Meta badges in condition detail header and throughout:
```tsx
<span className="rounded-full border border-border/50 bg-white/80 px-3 py-1 text-[12px] font-medium text-muted-foreground">
  Free to join
</span>
```

### Dot indicator

Colored circle for condition categories. 8–9px, condition hex, glow ring on hover:
```tsx
<span
  className="shrink-0 rounded-full transition-shadow duration-150"
  style={{
    width: 9, height: 9,
    background: hex,
    boxShadow: hovered ? `0 0 0 3px ${hex}22` : "none",
  }}
/>
```

### Divider row (checklist pattern)

Used in Checklist and Condition detail editorial sections:
```tsx
<div className="grid grid-cols-[20px_1fr] gap-4 py-6 border-b border-border/40">
  <span className="text-[13px] font-bold text-primary mt-[3px]">✓</span>
  <div>
    <div className="text-[16px] font-semibold text-foreground mb-1.5">{title}</div>
    <p className="text-[14.5px] text-muted-foreground leading-[1.62]">{body}</p>
  </div>
</div>
```

### Primary button (brand)

```tsx
<Button variant="brand" className="px-6 h-11">
  Find my match
</Button>
```

The `brand` variant is defined in `components/ui/button.tsx`. On sage backgrounds, always add the green shadow:
```tsx
className="shadow-[0_4px_20px_rgba(45,155,112,0.28)] hover:shadow-[0_8px_32px_rgba(45,155,112,0.32)] hover:-translate-y-0.5 transition-all"
```

### Secondary CTA

On sage backgrounds, the secondary is a plain text link (no outline button):
```tsx
<Link
  href={href}
  className="text-[15px] font-medium text-primary hover:opacity-75 transition-opacity"
>
  Browse trials →
</Link>
```

The `→` arrow is always a plain character, never an SVG icon.

### Live eyebrow (pulsing dot)

Used only in the Hero:
```tsx
<div className="inline-flex items-center gap-[9px] text-[11.5px] font-semibold uppercase tracking-[0.1em] text-primary">
  <span className="h-[7px] w-[7px] rounded-full bg-primary animate-pulse" />
  1.4M+ trial sites · Updated daily
</div>
```

### Condition color tinted sections

Used for condition detail page header band and inline CTA band:
```tsx
// Header band (very subtle 7% tint, fades to transparent)
style={{ background: `linear-gradient(180deg, ${hex}07 0%, transparent 100%)` }}

// Side radial glow
style={{ background: `radial-gradient(ellipse 50% 90% at -5% 50%, ${hex}09, transparent)` }}

// CTA band surface
style={{ background: `${hex}07`, border: `1px solid ${hex}18` }}
```

The `07` / `09` / `18` suffixes are hex alpha values (~2.7%, 3.5%, 9.4% opacity). Always keep these very subtle.

---

## Section Templates

### Hero
- **Background**: `<AuroraBG>` animated blob + `bg-gradient-to-r from-white/80 via-white/55 to-white/20` overlay
- **Layout**: 2-column `lg:grid-cols-2`, left = form, right = condition list
- **Padding**: `pm-section` (`py-16 md:py-24`)
- **Heading**: `font-display font-normal`, `clamp(36px, 4.2vw, 56px)`, with italic green `<em>`

### TrustBar
- **Background**: `bg-white`
- **Layout**: `grid-cols-2 md:grid-cols-4`
- **Style**: No icons. Pure text grid. `border-l border-border/50 pl-7` separator on items 2–4 (md+ only)

### Timeline ("How it works")
- **Background**: `bg-[#E8EDE6]` sage
- **Layout**: Centered heading block + `md:grid-cols-3` steps grid
- **Step format**: Large Fraunces numeral `01/02/03` at 76px `text-primary/[0.22]` (ghost numeral, not a bold number)
- **No** icon circles, dashed connectors, or border-top accents

### Checklist ("What you get")
- **Background**: `bg-white`
- **Layout**: `md:grid-cols-[5fr_7fr]` with sticky left panel
- **Left**: Sticky `top-20`, eyebrow + Fraunces heading + subpara + brand CTA button
- **Right**: Divider row list with ✓ checkmarks
- **No** icon-in-box components

### CtaBand
- **Background**: `bg-[#E8EDE6]` sage
- **Layout**: Centered, `max-w-[540px]`
- **Heading**: `font-display font-normal`, `clamp(28px, 4vw, 48px)`
- **Buttons**: Brand primary with green shadow + plain text secondary link

### Condition listing page header
- **Background**: Cream page bg + right-side `radial-gradient(ellipse 55% 70% at 95% 50%, rgba(45,155,112,0.05), transparent)` accent
- **Search**: `rounded-xl border border-border/50 bg-white` input, max-w-[480px]

### Condition detail header band
- **Background**: Condition-color `linear-gradient(180deg, ${hex}07 0%, transparent)` + left radial glow `${hex}09`
- **H1**: `font-display font-normal`, `clamp(44px, 5.5vw, 68px)`, condition name only
- **Stat**: `font-display font-light`, `clamp(28px, 3.5vw, 44px)`, condition color, "N recruiting trials"
- **Right col**: `MicroScreener` at `w-full lg:w-[280px]`

---

## Motion

### Principles
- Animate arrival, not departure — elements enter with subtle fade+translate, never exit dramatically
- `MotionSection` component wraps all marketing sections for scroll-triggered reveals
- Respect `prefers-reduced-motion` — all aurora and pulse animations pause

### Specific animations

| Name | Keyframe | Duration | Usage |
|------|----------|----------|-------|
| `auroraDrift` | translate ±8% + scale 1→1.04 + opacity 0.38→0.58 | `var(--aurora-speed)` = 26s | Background aurora blobs |
| `auroraPulse` | opacity 0.24→0.44 | 15.6s (26s × 0.6) | Secondary aurora layer |
| `animate-pulse` | opacity | Tailwind default | Live dot in Hero eyebrow |
| Card hover | `translateY(-2px)` | 180ms ease | `.pm-card` |
| Button hover | `translateY(-2px)` | 150ms | Primary brand button |
| Condition row hover | padding-left 0→10px, bg tint | 150ms | Hero condition list, directory rows |
| Link underline | `scaleX(0→1)` | 160ms ease | `.link-underline` utility |

### Transitions

```
Buttons/links:       150–160ms ease
Cards:               180ms ease
Aurora drift:        26s ease-in-out infinite
Screener inputs:     160ms ease (focus ring)
```

---

## Background Texture

A subtle SVG dot-matrix noise texture is applied globally via `body::before` in `globals.css`. It uses `fill="rgba(31,41,51,0.022)"` — barely visible, adds tactile depth. Never remove this; it prevents the cream background from feeling flat.

---

## Do Not

- **No border-top-4 accent color** on cards (removed in Meridian refresh)
- **No left-side colored status strips** on trial cards (same anti-pattern as border-top, just rotated)
- **No icon-in-box** grids (e.g., `rounded-lg bg-primary/10 p-3` around a Lucide icon)
- **No icon rows inside trial cards** — Building2, Brain, Cpu, Pill, Syringe, FlaskConical etc. for intervention type, sponsor, and duration read as "AI slop". Use plain text labels instead; the data itself is informative enough without decorative icons
- **No dashed connectors** between timeline steps
- **No "Popular:" pill labels** in the Hero
- **No purple gradients on white** — the aurora palette is warm (mint/blush/coral/amber)
- **No Manrope (`font-heading`)** in new code — use Inter (`font-sans`) at weight 500–600 for all UI text
- **No Merriweather (`font-serif`)** in new code — use Inter for wordmarks and nav
- **No `font-bold` Fraunces** — always `font-normal` or `font-light` for display type
- **Do not use `bg-background`** (`#FAF8F5`) as a named section alternating color — use `bg-white` or `bg-[#E8EDE6]`

---

## Consistency Checklist

When adding a new page or section, verify:

- [ ] Eyebrow: `text-[11px] font-semibold uppercase tracking-[0.12em]`
- [ ] Section heading: `font-display font-normal` with `clamp()` sizing + negative tracking
- [ ] Subhead: `text-muted-foreground leading-relaxed`, 15–17.5px
- [ ] Section bg alternates: `bg-white` → `bg-[#E8EDE6]` → `bg-white`
- [ ] `pm-container` wraps all content inside sections
- [ ] Primary CTA on sage bg gets `shadow-[0_4px_20px_rgba(45,155,112,0.28)]`
- [ ] Condition colors use `getConditionHex(slug)`, not hardcoded
- [ ] Aurora animations only on Hero, not on inner pages
- [ ] `MotionSection` wraps all new marketing sections for scroll reveal
