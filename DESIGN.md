---
name: La Lista
description: Round-robin PR review assignment tool for engineering teams.
colors:
  primary: "oklch(0.52 0.19 258)"
  primary-light: "oklch(0.67 0.16 255)"
  primary-foreground: "oklch(1 0 0)"
  background: "oklch(0.985 0.004 254)"
  foreground: "oklch(0.205 0.01 258)"
  surface-card: "oklch(0.995 0.002 254)"
  surface-muted: "oklch(0.962 0.006 255)"
  surface-secondary: "oklch(0.955 0.008 255)"
  muted-foreground: "oklch(0.48 0.02 256)"
  border: "oklch(0.9 0.01 255)"
  input: "oklch(0.925 0.008 255)"
  ring: "oklch(0.69 0.12 258)"
  destructive: "oklch(0.58 0.22 27)"
  dark-background: "oklch(0.17 0.01 260)"
  dark-foreground: "oklch(0.965 0.004 255)"
  dark-primary: "oklch(0.67 0.16 255)"
  dark-border: "oklch(0.34 0.012 259)"
typography:
  display:
    fontFamily: "\"Space Grotesk\", system-ui, sans-serif"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "\"Space Grotesk\", system-ui, sans-serif"
    fontWeight: 600
    fontSize: "1.5rem"
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "\"Space Grotesk\", system-ui, sans-serif"
    fontWeight: 500
    fontSize: "1rem"
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, sans-serif"
    fontWeight: 400
    fontSize: "0.875rem"
    lineHeight: 1.6
  label:
    fontFamily: "\"Space Grotesk\", system-ui, sans-serif"
    fontWeight: 600
    fontSize: "0.6875rem"
    letterSpacing: "0.22em"
  mono:
    fontFamily: "\"JetBrains Mono\", monospace"
    fontWeight: 400
    fontSize: "0.75rem"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "oklch(0.46 0.19 258)"
  button-outline:
    backgroundColor: "oklch(0.985 0.004 254 / 0.7)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "8px 12px"
  chip-action:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "8px 12px"
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    padding: "8px 12px"
  calm-shell:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.3xl}"
    padding: "16px 24px"
  calm-section:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.3xl}"
    padding: "20px"
  input-field:
    backgroundColor: "{colors.input}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "8px 12px"
---

# Design System: La Lista

## 1. Overview

**Creative North Star: "The Quiet Cockpit"**

La Lista is a tool that earns trust by getting out of the way. The design system is built on the conviction that a developer assigning PRs wants to think about the PR, not the interface. Every surface decision — the restrained blue, the tinted neutrals, the calm panel system — follows from that premise. The interface should feel like a well-made instrument: legible at a glance, no friction on the primary action, nothing decorative.

The palette is restrained OKLCH blue. Not "developer tool blue" as a category reflex — the hue is a specific mid-blue (258°), used at controlled chroma (0.19), tinted into every neutral surface at near-zero chroma (0.004–0.012). The result is a surface that reads as near-white without being cold. Dark mode flips to a true dark (L 0.17, same hue), not a generic charcoal.

This system explicitly rejects: gradient text, hero-metric widgets (big number + small label in a box), glassmorphism as decoration, side-stripe border accents on cards or list items, and any pattern that could be recognized as "AI-generated developer tool" without seeing the product name. The reference is Linear — confident information hierarchy, every pixel purposeful, no ceremony.

**Key Characteristics:**
- Restrained OKLCH blue across surfaces and accents, same hue family throughout
- Space Grotesk for all headings and labels, tight −0.02em tracking
- JetBrains Mono for slugs, code references, and data identifiers
- A named surface system (`calm-shell`, `calm-section`, `calm-panel`) — not ad-hoc cards
- Light and dark themes; system-default, not forced
- Motion limited to state changes: opacity + translateY only, 560–720ms, exponential ease-out

## 2. Colors: The Restrained Blue Doctrine

One accent, one hue family, two luminance modes. The blue is never decorative — it marks primary actions, current selection, and active state indicators only.

### Primary
- **Instrument Blue** (`oklch(0.52 0.19 258)`, light mode): The one accent. Assign PR button, focus rings, active chip backgrounds, link hover. Never used for decoration. Dark mode shifts to `oklch(0.67 0.16 255)` to maintain contrast on dark surfaces.
- **Ring Blue** (`oklch(0.69 0.12 258)`): Focus rings only. Lower chroma than the primary to read as a guide, not a shout.

### Neutral
- **Cloud Surface** (`oklch(0.985 0.004 254)`): Page background, light mode. Hue-tinted (chroma 0.004) — never pure white.
- **Card Cream** (`oklch(0.995 0.002 254)`): Card and popover surface. Slightly lighter than background to lift card layers without shadow.
- **Quiet Ash** (`oklch(0.962 0.006 255)` / `oklch(0.955 0.008 255)`): Muted and secondary surfaces, chip backgrounds, tag backgrounds.
- **Slate Ink** (`oklch(0.205 0.01 258)`): Primary foreground text, light mode. Hue-tinted dark, not black.
- **Steel Mist** (`oklch(0.48 0.02 256)`): Secondary foreground. Metadata, labels, helper text.
- **Ghost Line** (`oklch(0.9 0.01 255)`): Borders and dividers. Consistently at 70% opacity in use (`border-border/70`) for depth.
- **Midnight Void** (`oklch(0.17 0.01 260)`): Dark mode background. Same hue family, deep.
- **Ember** (`oklch(0.58 0.22 27)`): Destructive state only. Warm red, not used elsewhere.

### Named Rules
**The One Hue Rule.** Every color in the system shares hue 255–260. Tints range from L 0.17 (dark background) to L 0.995 (card surface). No secondary accent hues are introduced. Pops of semantic color (red for urgent, amber for forced, sky for cross-team) are confined to status badges and never bleed into surfaces.

**The Opacity Layer Rule.** Surfaces use opacity variants (`bg-background/82`, `bg-muted/28`) over a shared hue-tinted background to create depth without explicit shadow stacking. The backdrop is always the same hue; only the opacity shifts.

## 3. Typography: The Two-Voice System

**Display Font:** Space Grotesk (Google Fonts, subsets: latin)
**Mono Font:** JetBrains Mono (Google Fonts, subsets: latin)
**Body / UI Font:** system-ui stack (no custom sans)

**Character:** Space Grotesk carries all headings and labels with its geometric-but-warm character — tight tracking at −0.02em makes headings dense and confident without feeling compressed. JetBrains Mono handles slugs, PR references, and identifiers, grounding the technical context without a separate icon language. Body copy uses the system stack for native rendering and maximum legibility.

### Hierarchy
- **Display** (Space Grotesk, weight 600, `text-2xl md:text-3xl`, −0.02em): Page h1 — the tool name / dashboard title. Used once per page.
- **Headline** (Space Grotesk, weight 600, `text-xl–2xl`, −0.02em): Card titles, section group headings. The reviewer name in the assignment card (`text-4xl font-bold`) is the single intentional exception — it IS the hero element on that surface.
- **Title** (Space Grotesk, weight 500, `text-lg`): Section h3/h4 inside panels. Used sparingly.
- **Body** (system-ui, weight 400, `text-sm`, line-height 1.6): All prose, descriptions, history item content. Keep to 65–75ch where prose runs long.
- **Label** (Space Grotesk, weight 600, `text-[11px]`, tracking 0.22em, uppercase): Section eyebrows (`calm-kicker`), section headers (HISTORY, AVAILABLE TEAMS), status overlines. The uppercase + wide tracking creates a clear label register distinct from body.
- **Mono** (JetBrains Mono, `text-xs`, `font-mono`): Team slugs (`/rmpe`), PR URLs, identifiers. Never used for labels or prose.

### Named Rules
**The Heading-Only Display Rule.** Space Grotesk is restricted to headings, labels, and the `calm-kicker` eyebrow. It is never used for body copy, button labels (those use the system font through the component default), or data tables. This keeps the two-voice distinction clear.

**The Reviewer Name Exception.** The current reviewer's name (`text-4xl font-bold`, primary color) is the single largest typographic element in the product. This is intentional — the whole tool exists to answer "who reviews this?" That name is the answer. Nothing else in the UI competes with it.

## 4. Elevation

La Lista uses a hybrid system: tonal layering as the foundation, with controlled ambient shadows on major shells only. Shadows are not structural — they don't indicate z-index or indicate that an element is "above" another. They add atmospheric depth to the page's main panels, making them feel like they float slightly above the background gradient.

The body carries a subtle top-bloom (`radial-gradient` at 9% primary) that tints the page crown without needing a hero image. Panel classes layer above this.

### Shadow Vocabulary
- **Shell Ambient** (`0 24px 80px -48px rgba(15,23,42,0.35)`): Used on `calm-shell`. Top-level page panels — PageHeader, AssignmentCard. The most elevated feel without visible hard edges.
- **Section Ambient** (`0 20px 72px -52px rgba(15,23,42,0.35)`): Used on `calm-section`. FeedHistory panel, secondary content areas. Slightly softer than Shell.
- **Panel Ambient** (`0 18px 60px -42px rgba(15,23,42,0.28)`): Used on `calm-panel`. Tertiary surfaces, nested panels.
- **Subtle Panel** (no shadow): `calm-subtle-panel` — background tint + border only, no shadow. Used for quiet inset surfaces.

### Named Rules
**The Atmospheric Shadow Rule.** Shadows are long, spread wide, and heavily blurred — never tight box shadows that create hard-edged depth. If a shadow is visible at 100% opacity in the final render, it is too strong. The ambient shadow disappears under the element, not around it.

**The Flat-By-Default Rule.** List items, table rows, chips, and badges are flat at rest. No shadow on hover — use `bg-muted/30` background fill instead. Elevation is reserved for the page's major structural shells.

## 5. Components

### Buttons
All buttons share `rounded-full` (9999px). This is a system-wide convention — not a single exception. Pill shape is the only shape.

- **Primary** (solid blue): `bg-primary text-primary-foreground rounded-full px-6 py-2.5`. The Assign PR button stretches full-width in its container. No icon except where it aids clarity (Plus for create actions).
- **Hover / Focus**: Darker primary (`oklch(0.46 0.19 258)`). Focus: `ring-2 ring-primary/50`. No scale transform on primary — transform reserved for icon-hint secondary CTAs.
- **Outline**: `border border-border/70 bg-background/70 rounded-full`. The dominant secondary variant — used for all utility controls in the header bar.
- **Ghost**: `bg-transparent hover:bg-muted/30 rounded-full`. Icon-only actions in icon bars (ThemeToggle, ChangelogDialog, etc.).
- **Destructive**: Red palette. Confined to confirmation dialogs; never appears inline as a primary action.

### Chips (Action Toggles)
The footer action row uses custom `rounded-full` toggle chips, not shadcn Button — height 40px (`h-10`), `px-3`, `text-xs`, `border-border/70`. Selected state swaps to solid primary background via inline style (not a Tailwind class, as color is computed from the tag's user-defined hex).

### Cards / Containers — The Calm Surface System

This is the signature of the system. Rather than ad-hoc `bg-white rounded-xl shadow` cards, every panel uses a named utility class:

- **`calm-shell`**: `rounded-3xl border border-border/70 bg-background/82 shadow-[shell-ambient] backdrop-blur-sm`. Top-level shells — PageHeader, the main AssignmentCard wrapper.
- **`calm-section`**: `rounded-3xl border border-border/70 bg-background/78 p-5 shadow-[section-ambient] backdrop-blur-sm`. Major content sections — FeedHistory, Events.
- **`calm-panel`**: `rounded-2xl border border-border/70 bg-background/72 shadow-[panel-ambient] backdrop-blur-sm`. Secondary panels.
- **`calm-subtle-panel`**: `rounded-2xl border border-border/60 bg-muted/28 backdrop-blur-sm`. Quiet inset surfaces with no shadow — used for subtle data containers.
- **`calm-list`**: `divide-y divide-border/60 rounded-2xl border border-border/60 bg-background/60 overflow-hidden`. Feed list container. Items inside use `hover:bg-muted/30` — never a card per item.

**Nesting rule:** `calm-shell` never nests inside `calm-shell`. `calm-section` may appear inside `calm-shell` only if the shell has no other padding. Never nest `calm-section` inside `calm-section`.

### Inputs / Fields
- **Style**: `rounded-2xl border border-border/70 bg-background/70` (`calm-input-surface`). Filled with a soft translucent background, not an outlined-only field.
- **Focus**: `ring-2 ring-primary/50` — a soft glow, not a hard 2px border swap.
- **Select**: Same surface treatment. `SelectTrigger` matches the input surface.

### Labels / Kickers
- **`calm-kicker`**: `text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/85`. The eyebrow label — appears above page titles ("LA LISTA") and section headers ("HISTORY", "AVAILABLE TEAMS"). This is the system's one use of uppercase + wide tracking.

### Signature Component: The Reviewer Display
The heart of the product. Centered in the AssignmentCard:
- **"LAST ASSIGNED"** label (kicker style, muted-foreground): Stacked above.
- **"Next Reviewer" pill**: `bg-primary/15 ring-1 ring-primary/25 rounded-full px-3 py-1 text-xs font-semibold text-primary` — subtle, pill-shaped announcement chip.
- **Reviewer name** (`text-4xl md:text-5xl font-bold text-primary`): The singular visual apex. Animated via TextMorph spring on change.
- **"UP NEXT" label + name** (kicker + `text-lg font-medium text-muted-foreground`): Stacked below, subdued.
- **Reviewer box background**: `bg-gradient-to-br from-primary/14 via-background to-primary/8 rounded-[2rem] border border-primary/16 shadow-[0_28px_72px_-44px_rgba(37,99,235,0.55)]`. The only surface in the product with a visible drop shadow directly tied to the primary blue — it frames the most important element.

## 6. Do's and Don'ts

### Do:
- **Do** use `calm-shell`, `calm-section`, `calm-panel`, `calm-subtle-panel`, and `calm-list` for all surface containers. Never write ad-hoc `rounded-xl bg-white shadow` cards.
- **Do** use OKLCH for all color values. Keep chroma ≤ 0.01 for neutral surfaces and ≤ 0.22 for accent tones. Never use `#000` or `#fff` — tint every neutral toward hue 255–260.
- **Do** restrict Space Grotesk to headings and `calm-kicker` labels. Use the system font for body copy and button text.
- **Do** use JetBrains Mono exclusively for technical identifiers: slugs, PR URLs, repo paths.
- **Do** apply `rounded-full` to all buttons and chips, without exception.
- **Do** keep the primary blue (`oklch(0.52 0.19 258)` / `oklch(0.67 0.16 255)`) confined to primary actions, focus rings, active states, and the reviewer name. Never use it decoratively.
- **Do** animate only `opacity` and `transform` (translateY, scale). Use `cubic-bezier(0.22, 1, 0.36, 1)` (expo-out equivalent) for page entrances; 150–250ms for state transitions.
- **Do** use uppercase + 0.22em tracking for section-level labels only (kickers, HISTORY, AVAILABLE TEAMS). Never on body copy, button labels, or data.
- **Do** respect `prefers-reduced-motion` — all `.page-enter`, `.urgent-card` animations have explicit `@media (prefers-reduced-motion: reduce)` blocks.
- **Do** mark exceptional history states (Urgent, Forced, Skipped, Cross-team) with badges. Do not badge the default/regular state — its absence IS the signal.

### Don't:
- **Don't** use a `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, callouts, or alerts. Rewrite with full borders, background tints, or nothing.
- **Don't** use `background-clip: text` with a gradient. Gradient text is forbidden. Use a solid `text-primary` or `text-foreground`.
- **Don't** use glassmorphism decoratively. `backdrop-blur-sm` is used only inside the named calm-surface utilities. Don't add `backdrop-blur` to ad-hoc elements.
- **Don't** build a hero-metric widget: big number + small label + icon in a bordered box. This is the banned SaaS template. If a count is needed, integrate it inline as a sentence fragment.
- **Don't** build identical card grids: same-sized cards, same icon + heading + text structure, repeated. Use `calm-list` for feeds, inline rows for teams.
- **Don't** reach for a modal as the first affordance. La Lista uses inline collapsibles, drawers (mobile), and dialogs (desktop) only when there is no inline path.
- **Don't** use em dashes (—) in UI copy. Use commas, colons, or parentheses.
- **Don't** add a "Regular" badge to normal history items. The absence of an exceptional badge is the signal. Badge only: Urgent, Forced, Skipped, Cross-team.
- **Don't** use `text-3xl` or larger for the page h1 (dashboard title). Tool headers are `text-2xl md:text-3xl` — confident, not domineering.
- **Don't** animate CSS layout properties (`height`, `width`, `padding`, `margin`). Animate `transform` and `opacity` only.
- **Don't** make the design feel like "a developer tool" as a category. La Lista is precise and professional, not dark-mode-by-default, not neon, not "productivity app beige." The personality is Linear: opinionated structure, every detail intentional.
