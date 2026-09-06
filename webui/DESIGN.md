---
name: "DST Command Portal"
description: "The opt-in Command Deck workspace skin, inheriting the selected app theme."
colors:
  portal-selection: "var(--color-accent)"
  house-accent: "var(--color-accent)"
  portal-rule: "color-mix(in srgb,var(--color-accent) 55%,var(--color-border))"
  base: "var(--color-base)"
  surface: "var(--color-surface)"
  surface-2: "var(--color-surface-2)"
  surface-3: "var(--color-surface-3)"
  border: "var(--color-border)"
  border-bright: "var(--color-border-bright)"
  text: "var(--color-text)"
  text-muted: "var(--color-text-muted)"
typography:
  headline:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "22px"
    fontWeight: 550
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  subject:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "20px"
    fontWeight: 550
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 550
  task:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 550
  body:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "12px"
  label:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "11px"
  button:
    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
rounded:
  square: "0px"
  rail: "1px"
  control: "2px"
spacing:
  compact: "4px"
  related: "8px"
  inset: "12px"
  gutter: "16px"
  group: "24px"
  mobile-gutter: "10px"
components:
  button-primary:
    backgroundColor: "color-mix(in srgb,var(--portal-selection) 24%,var(--color-surface))"
    textColor: "var(--color-text)"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-secondary:
    backgroundColor: "var(--color-surface-2)"
    textColor: "var(--color-text)"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "var(--color-text-muted)"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-danger:
    backgroundColor: "color-mix(in oklab,var(--color-danger) 15%,transparent)"
    textColor: "var(--color-danger)"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  search-input:
    backgroundColor: "var(--color-base)"
    textColor: "var(--color-text)"
    rounded: "{rounded.control}"
    padding: "0px 9px"
    height: "36px"
  section-navigation:
    textColor: "var(--color-text-muted)"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "7px 10px"
  status-chip:
    backgroundColor: "color-mix(in oklab,var(--color-success) 10%,transparent)"
    textColor: "var(--color-success)"
    padding: "2px 10px"
  surface-panel:
    backgroundColor: "var(--color-surface)"
    textColor: "var(--color-text)"
    rounded: "{rounded.control}"
    padding: "{spacing.inset}"
  task-row:
    textColor: "var(--color-text)"
    typography: "{typography.task}"
    rounded: "{rounded.square}"
    padding: "7px 10px"
---

# Design System: DST Command Portal

## Overview

**Creative North Star: "Subject Beside Task"**

The Command Portal is a compact, software-like administration workspace using the selected theme's planes, text, and accent states. Density comes from aligning the subject, context, task selection, and editor instead of repeating large headers and decorative card shells. This records the completed implementation, not a new concept or a global redesign mandate.

**Scope:** the browser-local preference `dst.experience.command-deck.v1` enables Command Deck when its value is `1`; absent or unreadable storage initially falls back to Classic. `SpatialFrame` inherits the complete selected theme, including custom overrides, across globe, dashboard, and tool routes. The square dock styling is shared by all these frames. Compact tool typography and layout remain scoped to non-home workspaces; globe geometry and material colors remain unchanged. Default/Classic is separate and unchanged.

The visual reference is the **Dune: Awakening game**, specifically its inventory, skills, and crafting screens inspected in the [Game UI Database reference](https://www.gameuidatabase.com/gameData.php?id=2167). Its information hierarchy and selection grammar are inspiration, not a template. DST uses original admin compositions, without copied game assets or bundled reference screenshots. No authorship of the game's UI is attributed to Territory Studio. Film/book aesthetics, no-computer rules, and tactile-cockpit requirements do not govern this skin.

**Key Characteristics:**
- Adjacent subject context and task editor, with restrained headings.
- Selected theme colors throughout, with accent-based selection.
- Flat angular working surfaces, separated by fine rules.
- Reserved navigation space and a single main content scrollport.
- Explicit execution, visible requirements, and recoverable navigation.

**Evidence:** product constraints come from `..\PRODUCT.md`; direction is recorded in `index.html` (the THESIS/OWN-WORLD/STORY/FIRST VIEWPORT/FORM comment). Implemented visual sources are `src\layout\portalWorkspace.css`, `src\pages\gameplay\players\playersDesk.css`, and `src\components\platform\actionWorkbench.css`. Font inheritance comes from `src\pages\workspaces\spatial.css`; shared primitives and theme inheritance come from `src\index.css` and `src\theme\ThemeContext.tsx`. Source wins if this record drifts.

## Colors

The selected app theme supplies every working plane, text color, accent, and semantic state; there is no separate portal palette.

### Primary
- **Theme selection:** `portal-selection` aliases the selected theme's accent to identify the current destination, subject, section, or task. An inset lower rule accompanies a restrained tinted fill; selected subject/task rows also carry a small corner diamond.
- Primary execution buttons use the same selection family with a stronger tint. This is visual emphasis, not proof that an action is safe.

### Secondary
- **Inherited house accent:** `house-accent` remains bound to the chosen theme. Its character may be warm or house-specific; it is not a fixed amber brand requirement.
- **House rule:** `portal-rule` mixes that inherited accent with the theme border. Use it for the command strip, workspace divisions, and task-group headings.
- Success, warning, danger, and informational states retain the existing semantic theme variables and their text labels. They are not replaced by selection colors or frozen to one preset here.

### Neutral
- **Theme planes:** `base` supports the frame and task rail; `surface` supports working panels. The numbered surfaces supply adjacent planes and hover feedback.
- **Rules and ink:** borders, main text, and muted text inherit the resolved theme, including light themes and custom overrides.

**The Shared Theme Rule.** Never redefine `--color-*` tokens on workspace frames. The app root supplies the selected theme to pages, globe surroundings, dock, and tool finder.

**The Selection Is Not Safety Rule.** Accent marks the current choice or primary affordance; requirements, warnings, danger labels, and existing confirmation guards determine whether execution is permitted.

The frontmatter records source-backed primitives, not every incidental color. Sidecar tonal strips are illustrative display aids, not runtime CSS tokens.

## Typography

**Workspace font:** Segoe UI Variable, Segoe UI, sans-serif. The spatial frame sets this system-font stack; the root Inter-first stack is not the effective default inside the portal. Existing explicitly monospaced identifiers retain the root mono stack; it is not the general workspace voice.

**Character:** compact, direct, and readable. Headings use modest weight and close tracking rather than cinematic display typography. There is no portal hero/display tier.

### Hierarchy
- **Headline:** domain or workspace heading.
- **Subject:** selected player identity, kept beside status and secondary identifiers.
- **Title:** compact panel headings in the dossier.
- **Task:** action titles in the workbench rail.
- **Body:** explanations, navigation labels, and concise guidance.
- **Label:** secondary counts, categories, and requirements; not a replacement for readable form labels.
- **Button:** shared button typography retained beneath the portal skin.

The role values are in frontmatter; this is an observed compact ramp, not a mathematical scale. Some incumbent editors keep their own type treatment. Numeric balances and identifiers use tabular numerals where the source already does so. Long identity text wraps rather than widening the workspace.

**The Task Before Display Rule.** Keep headings subordinate to the working content; do not turn compact domain or identity rows into promotional banners.

## Layout

The viewport frame has a command strip above a flexible work area. That work area gives the main content scrollport and bottom navigation **separate grid rows**. The dock is static in its reserved sibling row, including safe-area padding, rather than floating over the editor. The content scrollport owns page scrolling and resets on navigation; bounded directories and task rails may scroll independently. "Single scrollport" does not prohibit these local lists.

Spacing uses the small related-control gaps, panel insets, gutters, and group separations recorded in frontmatter. The desktop outer gutter narrows on mobile. Dividers and alignment do more work than nested containers.

**The Reserved Dock Rule.** Navigation must consume layout space outside the main content scrollport; it must not cover the last field, confirmation, or Save action.

**The Shared Dock Rule.** Globe, dashboard, and tool pages use the same square-cornered dock, control spacing, theme colors, and selected state. Positioning may differ to preserve each frame's content clearance.

**The Subject Continuity Rule.** Filters and opening the mobile directory do not clear the selected subject or remount its editor; choosing another subject or task remains an explicit change.

### Implemented workspace patterns
- **Players:** a directory sits beside the dossier; identity/status, section navigation, and selected section align within that dossier. Task-capable sections place a task rail beside its editor. At the intermediate breakpoint (maximum width 1100px), both rails narrow rather than creating extra header rows.
- **Generic modules:** choosing a registered section focuses it while keeping its containing structure. **All sections** restores the overview; navigation is not an action execution path.
- **Configuration:** related fields can share columns; guidance and Save remain discoverable without consuming multiple introductory panels.
- **Commands:** purpose-based category pages show several related controls together: Battlegroup, VM & Power, Configuration, Network & Access, Database, Logs & Files, and Terminals & Tools. Search spans all categories; each operation keeps its explicit Run button, requirements, and safety checks. A native category picker replaces category navigation on mobile. **Custom layout** retains the saved editable three-section view without changing the purpose-based grouping.

### Narrow screens
At the mobile breakpoint (maximum width 767px), the layout becomes one working column. A native task picker replaces the desktop task rail. **Change player** reveals the directory while hiding, not unmounting, the selected dossier; returning to that same player preserves its mounted draft. Filters leave the selected task render intact even when it is outside the result set; the picker retains a current-task option and empty results offer **Clear filters**.

Mobile buttons and the affected pickers/fields expand to touch-oriented targets (minimum height 44px), while desktop controls retain compact sizing. Section tabs remain horizontally reachable, multi-column item editors stack, and the Game Config save bar joins normal flow on mobile. Do not claim every inherited control has a universal size.

## Elevation & Depth

The working surface is flat by default. Base/surface differences, fine borders, and alignment establish hierarchy; the portal removes ordinary card and dock shadows, and selected action editors shed their redundant outer card chrome. Inset selection rules express state rather than elevation.

**The Working Plane Rule.** Use tonal separation and borders for ordinary workspace hierarchy; do not rebuild the task editor as a stack of floating decorative cards.

This is not a global no-shadow or no-overlay ban. Existing identifier disclosures and modal/confirmation layers retain their own local depth behavior. Their isolated shadow values are not a reusable portal elevation scale.

Section navigation respects reduced motion when scrolling and moving focus. Portal reduced-motion styling also disables smooth CSS scrolling. No new decorative animation grammar is established by this density work.

## Shapes

The repeated working geometry is angular: square section/task rows, nearly square rail details, and lightly eased controls/panels. The frontmatter radius vocabulary corresponds to the implemented zero-to-two-pixel corners. Fine borders and short inset selection lines give structure without heavy frames.

**The Angular Work Surface Rule.** Apply the compact corner language to portal controls and working panels, not indiscriminately to every status or overlay primitive.

Existing semantic pills remain rounded, icons retain their natural silhouettes, and selected directory/task rows retain their small diamond marker. These are compatible exceptions, not a reason to normalize the whole app to one radius.

## Components

### Buttons
Compact, explicit actions. Primary buttons combine a violet-mixed surface with an inset selection line; secondary and ghost variants keep the inherited neutral hover treatments. Danger buttons retain their semantic danger color and are excluded from the primary recoloring. Disabled controls stay disabled and visually subdued.

Visible keyboard focus uses a violet outline. The frame generally offsets it outward; directory and task controls can offset it inward to remain visible inside clipped lists. Keep the actual component focus behavior rather than replacing every outline with one global recipe.

### Chips
Inherited semantic pills communicate state using a label, border, and light semantic tint. They are not task selectors and are not recolored as selected navigation. Their rounded silhouette remains an exception to the angular working planes.

### Cards / Containers
Flat local surfaces with fine borders and eased corners. Category panels reuse compact insets; the action editor removes its redundant card border/background. A panel groups related work, not each individual fact.

### Inputs / Fields
Native search, select, and text controls follow the local palette and angular geometry. Action search and category filters alter the available list only. Native labels, keyboard access, disabled states, and visible focus remain intact.

### Navigation
The dock identifies the current route; domain/section navigation narrows context; directory/task rows select a subject or editor. These are distinct layers, not one interchangeable action menu. Selected states use visible rules as well as color and semantic `aria-current` or `aria-pressed` state.

### Subject and task workbench
`PlayersTab` retains a selected dossier independently of its filtered directory. `ActionWorkbench` derives the selected action from all actions, not just the filtered subset. It renders that action's existing form and requirements beside the desktop rail or beneath the mobile picker. Selecting and filtering do not invoke the operation; permissions, live/offline requirements, busy handling, and confirmation handlers remain authoritative.

### Game Config guidance and Save
A concise safety summary remains visible before editing, including the distinction between writing live INIs and applying/restarting where required. Native disclosure exposes the full backup, risk, and player-config guidance; compact presentation does not remove it. Changes remain explicit, and **Save** is separate from **Apply INIs & restart**. The save bar must remain reachable above the reserved dock or in mobile document flow.

The sidecar contains self-contained visual specimens of these existing primitives, not runnable administration controls. Component-local portal values are resolved within each specimen; inherited root theme variables remain live-bound with source defaults as fallbacks.

## Do's and Don'ts

### Do:
- **Do** share Command Deck page colors across the globe and tools, while keeping tool density scoped to non-home workspaces and preserving Classic and globe geometry.
- **Do** align subject context, task selection, and editor before adding another header or container.
- **Do** keep the dock in its reserved row and the final action reachable.
- **Do** preserve mounted selection while filtering or opening the mobile player directory.
- **Do** retain visible requirements, recoverable navigation, full safety guidance, and explicit execution.
- **Do** use the game's hierarchy as inspiration for original DST admin compositions.

### Don't:
- **Don't** promote this skin into the default/global app theme or overwrite the approved spatial dashboard.
- **Don't** confuse selection, search, or filtering with permission or action execution.
- **Don't** hide a warning or remove a confirmation to achieve density.
- **Don't** replace system text with cinematic display type or impose film/book no-computer and cockpit rules.
- **Don't** copy game assets, bundle reference screenshots, or claim unverified game-UI authorship.
- **Don't** turn isolated dimensions, legacy branding details, or inline guard styles into reusable portal tokens.
