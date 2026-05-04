---
name: Halligan RMS
description: Records management software for volunteer and combination fire departments.
colors:
  box-red: "#c8362c"
  box-red-deep: "#8c2018"
  alert-stripe: "#e8a13a"
  station-ink: "#0e1013"
  apparatus-steel: "#1a1d22"
  tool-finish: "#242830"
  duty-log-cream: "#f3eee5"
  parchment-dim: "#d9d3c6"
typography:
  display:
    fontFamily: "Oswald, Impact, Arial Narrow, sans-serif"
    fontSize: "clamp(3.5rem, 7vw, 6rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "Oswald, Impact, Arial Narrow, sans-serif"
    fontSize: "clamp(2.25rem, 4.5vw, 4rem)"
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Oswald, Impact, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "0.02em"
  body:
    fontFamily: "Source Sans 3, Source Sans Pro, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.14em"
rounded:
  none: "0"
  sharp: "4px"
  frame: "8px"
  device: "14px"
spacing:
  xs: "14px"
  sm: "22px"
  md: "40px"
  lg: "80px"
  xl: "120px"
components:
  button-primary:
    backgroundColor: "{colors.box-red}"
    textColor: "{colors.duty-log-cream}"
    rounded: "{rounded.none}"
    padding: "12px 22px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.box-red-deep}"
    textColor: "{colors.duty-log-cream}"
    rounded: "{rounded.none}"
    padding: "12px 22px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.duty-log-cream}"
    rounded: "{rounded.none}"
    padding: "12px 22px"
  button-block:
    backgroundColor: "{colors.station-ink}"
    textColor: "{colors.duty-log-cream}"
    rounded: "{rounded.none}"
    padding: "14px 26px"
  button-block-hover:
    backgroundColor: "{colors.box-red}"
    textColor: "{colors.duty-log-cream}"
    rounded: "{rounded.none}"
    padding: "14px 26px"
---

# Design System: Halligan RMS

## 1. Overview

**Creative North Star: "The Duty Board"**

Every apparatus bay has a duty board: a whiteboard or grease-pencil board with the shift roster, unit assignments, and open calls. Nothing decorates it. Nothing on it is there because someone thought it looked good. It exists because it has to exist, and its authority comes from being complete, legible, and true. Halligan's visual system works the same way. Dark ink surfaces read like the board's backing. Warm cream records read like the chalk. Signal red fires like the indicator light over the door.

The palette is heavy where it needs to carry authority, warm where it needs to carry trust. Oswald condensed uppercase is stenciled apparatus lettering, not a typeface choice made in a branding meeting. JetBrains Mono is the CAD terminal, the log entry, the field label. Source Sans 3 is the body of the report, the words a chief actually reads. The system does not pursue visual novelty. It pursues legibility at speed, under pressure, on whatever device is at hand.

This system explicitly rejects the generic SaaS startup aesthetic: gradient-heavy hero sections, sans-serif minimalism with abstract blob illustrations, "AI-powered" badge language, and Intercom-style product screenshots. It rejects anything that reads as a pitch deck or a VC-backed tech company. A chief who picks up a department iPhone between calls should feel no friction between this interface and the rest of the station's visual world.

**Key Characteristics:**
- Dark-primary: station ink surfaces dominate, duty log cream surfaces are records and forms
- Condensed uppercase display type throughout all headings, navigation, and buttons
- Monospace for all machine-readable data: incident numbers, timestamps, field labels, meta
- Signal red is earned: reserved for active status, true calls to action, and the one brand accent
- Flat and tonal: depth through surface contrast, not shadows
- Sharp geometry: zero or minimal radius throughout; no soft corners

## 2. Colors: The Station Palette

Two surface worlds - dark duty and light record - held together by a single alarmed red.

### Primary
- **Box Red** (`#c8362c`): Engine red. The one active color in the system. Used for the primary CTA button, active nav states, incident status indicators, module numbers on dark surfaces, the brand mark accent, and form focus rings. Its rarity is its authority - when it appears, it signals action.
- **Box Red Deep** (`#8c2018`): Hover state for Box Red buttons only. Not used independently.

### Secondary
- **Alert Stripe** (`#e8a13a`): High-visibility amber. Used exclusively as the secondary module accent (EMS, apparatus alternates) and the amber variant of incident tags. Marks the secondary operational track. Not used in navigation, headings, or layout chrome.

### Neutral
- **Station Ink** (`#0e1013`): The primary dark surface. Hero background, features section, signup section, footer. Near-black with a barely perceptible cool undertone.
- **Apparatus Steel** (`#1a1d22`): The secondary dark surface. UI sidebar, titlebar, pullquote backgrounds. Lighter than Station Ink by enough to read as a distinct layer without a shadow.
- **Tool Finish** (`#242830`): Tertiary dark surface. Crew card backgrounds in the roster mockup. The darkest "lifted" surface within the dark world.
- **Duty Log Cream** (`#f3eee5`): The primary light surface. Mission section background, form card background, UI main panel, body text on dark. Warm parchment, not clinical white.
- **Parchment Dim** (`#d9d3c6`): Dimmed body text and secondary labels on dark surfaces. Never used as a background.

### Named Rules
**The Alarm Rule.** Box Red appears on 15% or less of any given screen. Its scarcity is the mechanism. When it appears on a button, a status pip, or an incident number, it reads as a live signal because it never appeared anywhere else. The moment it starts decorating headers, section backgrounds, or illustration fills, it stops alarming.

**The Two-World Rule.** Dark surfaces (Station Ink, Apparatus Steel, Tool Finish) and light surfaces (Duty Log Cream) do not mix within a single section. Sections alternate between worlds. Forms and records are always light. Operational content defaults to dark.

## 3. Typography: Stencil, Serif, Signal

**Display Font:** Oswald (condensed grotesque; fallback: Impact, Arial Narrow, sans-serif)
**Body Font:** Source Sans 3 (warm humanist sans; fallback: Source Sans Pro, sans-serif)
**Label/Mono Font:** JetBrains Mono (programming mono; fallback: Menlo, Consolas, monospace)

**Character:** Oswald at uppercase condensed reads as stenciled apparatus markings - immediate, industrial, zero ambiguity about hierarchy. Source Sans 3 softens the reading experience for longer text without losing the plainspoken register. JetBrains Mono distinguishes machine-readable data from human-readable copy at a glance, the same way a CAD terminal differs from a briefing report.

### Hierarchy
- **Display** (600, clamp(56px-96px), 0.95 lh, -0.005em ls, uppercase): Hero h1 only. Maximum one per section. Never sentence-case.
- **Headline** (500, clamp(36px-64px), 1.0 lh, -0.005em ls, uppercase): Section h2 headings. Drives the reading rhythm between sections.
- **Title** (500, 22px, 1.1 lh, 0.02em ls, uppercase): h3 feature headings, form headings, callout subheadings.
- **Body** (400, 17-19px, 1.6 lh): Mission text, feature descriptions, form copy. Maximum 65ch line length.
- **Label** (400, 10.5-13px, 1.4 lh, 0.14-0.20em ls, uppercase): All mono applications: incident numbers, timestamps, addresses, form field labels, section tags, navigation links, button text, meta lines, footer data. The visual register of operational data.

### Named Rules
**The Stencil Rule.** Oswald is always uppercase. Never sentence-case on headings, buttons, or navigation. Oswald in sentence case loses its condensed authority and reads as a cheap weight substitute. The only exception: quoted text inside blockquotes or pull quotes.

**The Terminal Rule.** Any piece of data that could appear on a CAD screen or a dispatch log - incident numbers, timestamps, radio designations, addresses, roster units, compliance codes (NERIS, NFPA, NEMSIS) - uses JetBrains Mono. Mixed-font lines (Oswald label + mono data) are a first-class pattern, not an edge case.

## 4. Elevation

This system is flat by design. Depth is conveyed through tonal contrast between surface layers (Station Ink to Apparatus Steel to Tool Finish; or Duty Log Cream to its border treatments), never through shadows on UI elements.

One structural exception: the hero mockup stage carries a single deep shadow (`0 24px 60px -20px rgba(0, 0, 0, 0.55)`) that physically floats the laptop and tablet frames above the page. This is a scene-setting device - the mockups are treated as physical objects in a photograph, not as UI surfaces. This shadow does not migrate to cards, callouts, form elements, or any surface inside the actual interface.

### Shadow Vocabulary
- **Structural Float** (`0 24px 60px -20px rgba(0, 0, 0, 0.55)`): Hero mockup device frames only. Nowhere else.

### Named Rules
**The Flat-By-Default Rule.** UI surfaces have no shadow at rest, hover, or focus. If depth is needed between two surfaces, step between Station Ink, Apparatus Steel, and Tool Finish. If a border is needed, use the rule tokens (`rgba(243, 238, 229, 0.14)` on dark, `#d6cfbf` on light). Shadows on interactive elements are prohibited.

## 5. Components

### Buttons
Buttons are sharp-cornered (0 radius) and uppercase Oswald throughout. No soft edges, no rounded pills.

- **Primary** (Box Red `#c8362c`, bone text, 0 radius, 12px 22px padding): The single action a section wants taken. "Request Early Access", "Submit Request". Hover: Box Red Deep `#8c2018`. One primary button per visual region maximum.
- **Ghost** (transparent, bone text, `rgba(243, 238, 229, 0.35)` border, 12px 22px padding): Secondary action alongside a primary. "Talk to the Team", "Sign In". Hover: `rgba(243, 238, 229, 0.08)` background fill.
- **Block** (Station Ink background, bone text, 0 radius, 14px 26px padding): Primary CTA on light (cream) surfaces, such as the form submit. Hover: shifts to Box Red to acknowledge the submission action.
- All buttons: Oswald 600, 13px, 0.14em tracking, uppercase, 0.15s ease transition on background only.

### Inputs and Fields
Underline-only. No box, no background fill, no radius. The form lives on a cream surface; adding box borders would create a nested surface inside a surface.

- **Default**: 1.5px solid `#1a1d22` bottom border only. Source Sans 3 15px. Transparent background.
- **Focus**: Bottom border shifts to Box Red `#c8362c`. No outline, no glow, no shadow.
- **Label**: JetBrains Mono 10.5px, 0.16em tracking, uppercase, `#4a4842`.
- **Textarea**: `resize: vertical` only. Minimum 80px height.
- **Select**: Same underline treatment as input.

### Navigation
- Oswald 500, 13px, 0.14em tracking, uppercase, `#f3eee5` text.
- Hover state: `border-bottom: 2px solid #c8362c`. No background fill, no underline fade, no color change to text.
- Only appears at desktop widths; hidden below 980px breakpoint (mobile gets no nav, just the CTA buttons).

### Section Tag
A recurring structural element: JetBrains Mono 12px, 0.20em tracking, uppercase, Box Red text, preceded by a 28px x 2px Box Red rule. Used to number and label content sections ("Mission · 01", "Receipt · 02", "Roll Call · 03"). Always positioned above the section h2.

### Feature Grid Cell
A full-bordered grid cell, not a card. The grid draws its borders from the grid container's shared borders (`border-top`, `border-left` on the grid; `border-right`, `border-bottom` on each cell). Dark ink background. Mono numbered module code above the title. Hover: `#14171c` background, no transform, no shadow.

- Amber variant: the module number shifts from Box Red to Alert Stripe. Applied to alternating cells (Roster, Apparatus, EMS modules).

### Incident Tag
A compact classification chip for incident type: 9px Oswald, 2px 6px padding, 2px radius. Four variants:

- **Fire**: Box Red tinted background (`rgba(200, 54, 44, 0.14)`), Box Red text
- **EMS**: Alert Stripe tinted background (`rgba(232, 161, 58, 0.18)`), `#946615` text
- **Haz**: Apparatus Steel background, Alert Stripe text
- **Svc**: `#e2dccc` background, `#4a4842` text

### Brand Mark
A pentagon (fire-shield clip path) with "H" in Oswald 700, 24px, on a Duty Log Cream background with Station Ink text. Not a circle, not a square - the shield shape is the brand's single piece of visual identity that departs from pure utility.

## 6. Do's and Don'ts

### Do:
- **Do** use Box Red only for live action: primary CTAs, active states, incident status pips, module identifiers. Its scarcity is its meaning.
- **Do** uppercase all Oswald usage. Headings, buttons, navigation, section tags - always uppercase.
- **Do** use JetBrains Mono for any data that would appear in a dispatch log or CAD screen: incident numbers, timestamps, compliance codes, field labels, roster unit designations.
- **Do** alternate sections between dark (Station Ink) and light (Duty Log Cream) surfaces. Keep entire sections in one world.
- **Do** use tonal steps (Station Ink to Apparatus Steel to Tool Finish) to express depth within dark surfaces.
- **Do** use full borders on the feature grid container so cells share borders rather than each having four independent sides.
- **Do** keep button radius at zero. The sharp edge is the point.

### Don't:
- **Don't** use gradient text (`background-clip: text`). Use a single solid color. Box Red is already alarming enough.
- **Don't** use side-stripe borders wider than 1px as a decorative accent on cards, callouts, or list items. Rewrite with full borders or background tints.
- **Don't** use generic SaaS startup aesthetics: gradient-heavy heroes, blob illustrations, "AI-powered" badge language, rounded pill buttons.
- **Don't** apply glassmorphism or blurred backdrop surfaces anywhere in the system.
- **Don't** add shadows to interactive elements (buttons, cards, inputs) at any state. The flat-by-default rule is absolute.
- **Don't** use Alert Stripe amber in navigation, headings, or layout chrome. It marks the EMS and secondary operational track only.
- **Don't** mix dark and light surfaces within a single content section.
- **Don't** use Oswald in sentence case. If the text can't be uppercase, it uses Source Sans 3 or JetBrains Mono.
- **Don't** add decorative elements that earn nothing: icons for decoration, divider illustrations, abstract patterns. The diagonal rule on `.callout-card::before` is a one-time hazard-stripe device for the comparison section; it does not generalize.
- **Don't** use `#000000` or `#ffffff`. Station Ink (`#0e1013`) and Duty Log Cream (`#f3eee5`) are the terminals.
