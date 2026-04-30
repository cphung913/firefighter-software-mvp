---
name: VFD Platform
description: Mission-critical operations software for volunteer fire departments.
colors:
  station-red: "#DB4038"
  station-red-foreground: "#FAFAFA"
  alarm-red: "#F53333"
  canvas: "#FFFFFF"
  ink: "#171717"
  field-gray: "#F5F5F5"
  smoke: "#737373"
  rule-line: "#E5E5E5"
  status-clear: "#22C55E"
  status-response: "#FACC15"
  status-oos: "#EF4444"
  caution-bg: "#FEF9C3"
  caution-fg: "#92400E"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.station-red}"
    textColor: "{colors.station-red-foreground}"
    rounded: "{rounded.md}"
    padding: "11px 20px"
  button-primary-hover:
    backgroundColor: "#C73930"
    textColor: "{colors.station-red-foreground}"
    rounded: "{rounded.md}"
    padding: "11px 20px"
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 20px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: VFD Platform

## 1. Overview

**Creative North Star: "The Station Standard"**

A visual system built to the same standard as a standing operating procedure. Nothing decorates. Nothing surprises. Every element is where it belongs because that is where it always is. The system earns trust by being identical at 8am and 2am, in good conditions and bad.

This is software used under pressure: post-incident logging, apparatus dispatch, shift handover at the end of an exhausting call. The visual language responds to that reality with high contrast, clear hierarchy, generous touch targets, and immediate feedback. It does not compete with the work; it supports it. A firefighter completes a task and returns to readiness without having thought about the interface.

The reference direction is government digital services (GOV.UK, USDS) and professional field operations tools (Procore, ServiceMax) — institutional polish, nothing wasted, nothing missing. Not startup minimalism, which mistakes sparse for serious. Not legacy fire software (Paladin), which mistakes cluttered for capable.

**Key Characteristics:**
- Near-achromatic neutral palette; Station Red reserved for action and status only
- Inter across all weights — function over typographic expression
- Flat surfaces at rest; structural shadow (`shadow-sm`) signals containment only
- 44px touch targets as a hard floor on every interactive element
- Transitions are direct and brief (100-150ms ease-out); no choreography, no bounce

## 2. Colors: The Station Palette

A disciplined palette built for operational clarity. Red commands attention; neutrals provide the field it operates on. Status colors are a closed set — they communicate only apparatus and system state, never decoration.

### Primary
- **Station Red** (`#DB4038`): The action color. Primary buttons, links, focus rings, the application brand mark. Used on ≤10% of any given screen. Its presence signals "this is the thing to do."

### Neutral
- **Canvas** (`#FFFFFF`): Page background, card surfaces, input backgrounds.
- **Ink** (`#171717`): All primary text. Near-black, not pure black — retains optical softness.
- **Field Gray** (`#F5F5F5`): Page-level backgrounds, secondary surface fill, loading skeleton base.
- **Smoke** (`#737373`): Secondary and descriptive text — unit type labels, helper copy, timestamps.
- **Rule Line** (`#E5E5E5`): All borders, dividers, input strokes, card outlines.

### Semantic Status
- **Status Clear** (`#22C55E`): Apparatus available, sync success, positive confirmation.
- **Status Response** (`#FACC15`): Apparatus responding, sync in progress, caution state.
- **Status OOS** (`#EF4444`): Apparatus out of service, sync error.
- **Alarm Red** (`#F53333`): Destructive actions, validation errors, critical system alerts.
- **Caution Background / Foreground** (`#FEF9C3` / `#92400E`): Offline-mode alert banners, non-critical warnings.

### Named Rules
**The Station Red Rule.** Red is reserved for action (primary buttons, links, focus rings) and system state (destructive, error). It is never used as a background fill on extended surfaces, never used decoratively, and never combined with another saturated hue on the same screen.

**The Status Pair Rule.** Status colors never stand alone. Every status indicator pairs a colored dot with a text label. Color-blind users read the label; sighted users read the color. Both paths work.

## 3. Typography

**Display / Body Font:** Inter (with `system-ui, sans-serif` fallback)

Loaded via Google Fonts with `font-display: swap`. A single sans-serif family throughout — no display/body split. Inter's engineering heritage makes it feel technical-precise without feeling cold. Weight contrast carries the full typographic hierarchy.

**Character:** Workmanlike. Zero expressiveness at body scale, deliberate authority at display scale. The typeface recedes; the content leads.

### Hierarchy
- **Display** (700, 1.875rem / 30px, line-height 1.2, tracking -0.02em): Page titles only. One per screen.
- **Headline** (600, 1.25rem / 20px, line-height 1.3): Section headings, modal titles, card group labels.
- **Title** (600, 1rem / 16px, line-height 1.4): Card titles, list item primary text, form section heads.
- **Body** (400, 1rem / 16px, line-height 1.5, max 65–75ch): All prose content, form descriptions, narrative fields.
- **Label** (500, 0.875rem / 14px, line-height 1): Form labels, button text, navigation items, status text.

### Named Rules
**The Plain English Rule.** Every visible string must be the shortest phrase the user would naturally say aloud. "Log Incident" not "Create NERIS Record". "Out of Service" not "OOS". "Sign In" not "Authenticate". No jargon survives without a plain-English companion.

## 4. Elevation

This system is flat by default. Depth is not decorative — it signals containment.

Cards carry a single structural shadow (`box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05)`) to lift them from the page surface. No other shadow level is in use. There is no `shadow-md`, no `shadow-lg`, no ambient glow. Interactive elements (buttons, inputs) signal focus through ring treatment, not shadow shifts.

### Shadow Vocabulary
- **Contained** (`0 1px 2px 0 rgba(0,0,0,0.05)`): Cards and panels only. Separates a grouped content block from the page.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. The single shadow step exists to mark containment, not to create visual drama. If a new component requires more than `shadow-sm` to feel grounded, the problem is color or spacing, not shadow depth.

## 5. Components

### Buttons
Tactile and direct. Substantial enough to hit without looking; responsive enough to confirm without overreacting. Transitions at 150ms ease-out — felt but not watched.

- **Shape:** Gently rounded (6px / `rounded-md`)
- **Primary:** Station Red background (#DB4038), off-white text (#FAFAFA), 44px height, 20px horizontal padding. Hover darkens 10% (#C73930). Active darkens 20% (#B83329).
- **Focus:** 2px white inner ring + 2px Station Red outer ring (`box-shadow: 0 0 0 2px #FFF, 0 0 0 4px #DB4038`).
- **Outline:** Canvas background, Ink text, Rule Line border (1px). Hover fills Field Gray.
- **Ghost:** Transparent at rest. Hover fills Field Gray. Used for secondary in-context actions.
- **Disabled:** 50% opacity, pointer-events none. No separate color.

### Cards / Containers
- **Corner Style:** 8px radius (`rounded-lg`)
- **Background:** Canvas (#FFFFFF)
- **Border:** 1px Rule Line (#E5E5E5)
- **Shadow:** Contained (`0 1px 2px 0 rgba(0,0,0,0.05)`)
- **Header Padding:** 24px
- **Content Padding:** 0 24px 24px

Never nest cards. Nested containment is hierarchy by accident; use spacing and dividers instead.

### Apparatus Status Card (Signature Component)
The most-used interactive element in the product. A tappable card that cycles apparatus status on each tap.

- **Layout:** Horizontal flex, 16px gap, 16px padding, 72px minimum height
- **Status Indicator:** 16px filled circle, color-coded (Clear / Response / OOS)
- **Unit Name:** Title weight (500), truncated with ellipsis on overflow
- **Unit Type:** Label weight (400), Smoke color (#737373), truncated
- **Status Label:** 14px / 600 weight, status-matched color; right-aligned, no-shrink
- **Interaction:** `cursor-pointer`, hover 85% opacity, active 70% opacity; 150ms ease-out

### Inputs / Fields
- **Style:** Canvas background, Rule Line border (1px), 6px radius, 44px height
- **Typography:** 16px body weight (prevents iOS auto-zoom on focus)
- **Focus:** Border shifts to Station Red; 2px Station Red ring at 20% opacity (`box-shadow: 0 0 0 2px rgba(219,64,56,0.2)`)
- **Error:** Alarm Red border (#F53333) + error message in Alarm Red below the field
- **Disabled:** 50% opacity, not-allowed cursor
- **Labels:** Always visible above the field, 14px / 500 weight, 8px gap

### Navigation Header
- **Style:** Sticky, 64px height, Canvas background, Rule Line bottom border (1px), z-index 20
- **Brand mark:** Station Red, 14px / 500 weight (mobile only; desktop shows sidebar nav)
- **Padding:** 16px horizontal on mobile, 24px on desktop

### Caution / Offline Banner
Used for the sync-offline alert that must always be visible when offline.
- **Background:** Caution Background (#FEF9C3)
- **Text:** Caution Foreground (#92400E)
- **Border:** 1px yellow-300 (#FDE047)
- **Shape:** 6px radius, 16px horizontal padding, 12px vertical padding
- **Typography:** 14px body text, no icons required (text must be self-sufficient)

## 6. Do's and Don'ts

### Do:
- **Do** reserve Station Red for action and status. Its rarity is what makes it readable.
- **Do** pair every status color with a text label. Never communicate state through color alone.
- **Do** maintain 44px as the absolute minimum for every interactive element — buttons, inputs, icon buttons, tappable cards.
- **Do** use Inter weight contrast (400 body / 500 label / 600 title / 700 display) to build hierarchy before reaching for size changes.
- **Do** keep transitions at 100-150ms with `cubic-bezier(0, 0, 0.2, 1)` (ease-out-quart equivalent). Responsive, not theatrical.
- **Do** write every label in plain English at the shortest natural phrasing.
- **Do** use `prefers-reduced-motion` to disable transitions for users who have opted out.
- **Do** target WCAG AA contrast minimums: 4.5:1 for body text, 3:1 for large text and UI components.

### Don't:
- **Don't** use SaaS-bold aesthetics: oversized hero metrics, gradient accents, celebration animations, "delight-first" motion.
- **Don't** use consumer app patterns: bottom tab nav carousels, onboarding mascots, pull-to-reveal easter eggs.
- **Don't** use gradient text (`background-clip: text`). Single solid color only.
- **Don't** use colored `border-left` stripes on cards, list items, or callouts as accent decoration. Rewrite with a background tint, a full border, or a leading icon.
- **Don't** use Paladin-style visual density: competing text sizes, colored table rows, icon overload.
- **Don't** use generic admin dashboard patterns: navy sidebars, hero-metric blocks (big number + small label + gradient accent), identical icon-heading-text card grids.
- **Don't** apply shadow-md or shadow-lg. One shadow step exists in this system; use it only on cards.
- **Don't** use Station Red as a background fill on extended surfaces. It is an action signal, not a brand wash.
- **Don't** introduce a second accent color. The palette is intentionally minimal; a second accent competes with status colors and undermines the Station Red Rule.
- **Don't** animate layout properties (width, height, padding, margin). Animate opacity and transform only.
