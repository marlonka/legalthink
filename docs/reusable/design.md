# Web interface design system

A reusable specification for the visual language, interaction behavior, motion, and writing of a restrained, monochrome web interface. Applies to workspaces, dashboards, editors, catalogs, settings, checkout flows, documentation, and public websites.

## 1. How to use this file

Copy this file into a project's root as `design.md`. Read it before changing the interface. It is self-contained; no reference screenshots, component library, framework, or original application are required.

**Rules are requirements. Baselines are starting values. Patterns apply only when the product needs them.** Preserve the rules across projects; adapt content structure, density, and dimensions to the task. Record deliberate deviations in the receiving project's design guide.

For an existing product, retain working flows, meaningful content, keyboard behavior, and data semantics. For a new product, choose the simplest structure that supports the actual task. A sidebar, composer, dashboard, or inspector is never required merely to reproduce this style.

This specification captures the implemented visual and motion language of LegalThink. Product names, legal workflows, model settings, and application-specific limits are excluded. Accessibility and adaptation guidance extend that foundation to other interfaces. The values below specify this system; they make no claim about another product's source code.

**Reference:** [Layout](#3-page-structure-spacing-and-responsive-behavior) · [Tokens](#4-color-and-surface-tokens) · [Typography](#5-typography-icons-and-imagery) · [Components](#6-component-patterns) · [States](#7-interaction-state-and-continuity) · [Motion](#8-motion-system) · [Writing](#9-product-writing) · [Accessibility](#10-accessibility-requirements) · [Verification](#11-engineering-and-verification)

## 2. Design character and fixed rules

The interface uses nearly black or off-white page surfaces, small differences between neutral layers, moderate type sizes, generous spacing between groups, and compact spacing inside them. Rounded containers organize substantial units of work. Plain rows carry navigation and repeated data. Brightness, placement, and typography establish emphasis.

The resulting visual hierarchy should be legible before reading the labels: navigation is quiet, the current task is prominent, secondary information recedes, and available actions remain identifiable.

1. **Content determines structure.** Start with the user's object, input, question, or decision. Do not add a dashboard, introductory hero, or card grid to fill the screen.
2. **Use neutral chrome.** Default actions are monochrome. Reserve color for meaningful states, data series, source content, and an explicitly chosen brand requirement.
3. **Keep controls still.** Pressing, selecting, focusing, and loading must not move or resize a control or its label. Never use button scaling, hover lift, or a moving selection pill.
4. **Reveal complexity where needed.** Keep frequent actions visible. Place advanced controls and explanations next to their relevant decision, behind disclosure when appropriate.
5. **Preserve work and orientation.** Keep input, selection, scroll position, and object identity through ordinary state changes. Make destructive consequences explicit.
6. **Write only useful text.** Each visible text element must name an action, identity, concrete fact, data point, relevant state, or decision. Remove text that changes none of these.
7. **Make states truthful.** Missing, loading, empty, failed, pending, and complete are different. Do not invent data, progress, certainty, activity, or success.
8. **Treat accessibility as behavior.** Keyboard, touch, focus, zoom, and reduced motion belong in the component design.
9. **Centralize the system.** Themes share semantic tokens. Motion uses a small set of presets. Components share state and spacing rules.

### What can change between projects

| Preserve                             | Adapt to the product                                         |
| ------------------------------------ | ------------------------------------------------------------ |
| Neutral surfaces and clear hierarchy | Navigation type and number of regions                        |
| Stable control geometry              | Content widths and responsive thresholds                     |
| Functional, specific copy            | Domain vocabulary and language                               |
| Short, interruptible motion          | Whether a detail pane or direct manipulation exists          |
| Shared semantics across both themes  | Initial theme preference                                     |
| Restrained type and consistent icons | Font with appropriate language coverage and licensing        |
| Color with an explicit meaning       | Data visualization palette, media, and required brand assets |

Do not introduce gradients, glass panels, luminous borders, background blobs, ambient particles, oversized decorative headlines, or nested cards as a default interpretation of quality. Distinctiveness comes from composition, proportion, content, and precise behavior.

## 3. Page structure, spacing, and responsive behavior

### Choose the structure from the task

| Product surface                | Suitable structure                                                         | Preserve this behavior                                                  |
| ------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Form, setup, checkout          | Focused column; related fields grouped; concrete final action              | Keep values on failure; show totals and consequences before commitment  |
| Editor or creation tool        | Main work surface; nearby tools; optional inspector                        | Preserve selection and work; keep primary tools reachable               |
| Collection or administration   | Page title; search and filters; rows or table                              | Keep sort, filter, selection, and return position                       |
| Dashboard                      | Controls for scope and period; decision-relevant metrics; charts or tables | Show units, period, freshness, and missing data                         |
| Record or detail view          | Object identity; content; related metadata and actions                     | Keep object context visible when opening supporting detail              |
| Catalog or media browser       | Images or previews with comparable metadata                                | Keep content colors; make filtering and item inspection direct          |
| Article or documentation       | Reading column; optional table of contents and local navigation            | Maintain readable line length and stable anchor targets                 |
| Public product or service page | Concrete offering, relevant facts or examples, action                      | Use real content; make pricing, requirements, and availability findable |

Use a persistent sidebar when people repeatedly move among several work areas. Use a compact header or local navigation when there are fewer destinations. Add a second navigation level only when it represents a real hierarchy. Never manufacture profiles, projects, history, or activity to complete a layout.

### Layout baselines

| Property                    | Baseline                           | Application                                           |
| --------------------------- | ---------------------------------- | ----------------------------------------------------- |
| Spacing unit                | 4 px                               | Shared scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px |
| Icon to label               | 8 px                               | Tightly related content                               |
| Elements within a group     | 8–12 px                            | Fields, toolbar controls, metadata                    |
| Surface padding             | 16–24 px                           | Cards, dialogs, substantial input regions             |
| Separation between groups   | 24–32 px                           | A visible change of topic or task                     |
| Desktop page inset          | 32 px; adapt within 24–48 px       | Shared by related routes                              |
| Desktop page top / bottom   | 38 / 48 px                         | Starting baseline, shared across the application      |
| Mobile page inset           | 16 px; 12 px at constrained widths | Protect usable content width                          |
| Persistent navigation       | 288 px                             | Optional; size for actual labels                      |
| Focused content width       | 768 px maximum                     | Forms, settings, creation tasks                       |
| Wide work area              | Up to 1440 px                      | Tables, comparison, multi-pane work                   |
| Reading measure             | About 60–85 characters             | Long paragraphs; verify with the chosen font          |
| Control height              | 40 px                              | Standard desktop buttons and fields                   |
| Compact rows / icon buttons | 36 px                              | Desktop navigation and secondary controls             |
| Primary touch targets       | At least 44 × 44 px                | Grow the target without enlarging every icon          |
| Ordinary divider            | 1 px                               | Separate meaningful regions                           |

These are CSS pixel baselines, not fixed device pixels. Use relative units where users need text and controls to grow. Align recurring headings, fields, and footers to the same edges. A wider viewport should create comfortable margins or useful work area; it should not stretch prose indefinitely.

Use space to distinguish groups before introducing borders. Use a border before introducing another surface. A card must represent an object, a bounded task, or a group that benefits from separation. Do not put a card around every label, statistic, or row.

### Shape and elevation

| Element                     | Radius                                              |
| --------------------------- | --------------------------------------------------- |
| Inline code or small inset  | 4–6 px                                              |
| Row, field, standard button | 8–10 px; default 10 px                              |
| Menu or popover             | 16 px                                               |
| Substantial card or dialog  | 24 px                                               |
| Large composing surface     | 26 px                                               |
| Compact filter chip         | Pill only when its shape helps identify the control |

Use one radius family. Small controls must not resemble miniature cards. In nested surfaces, reduce the inner radius to reflect the inset. Ordinary cards have no shadow. Menus and dialogs may use shadow to show that they float above content.

Expose the shared defaults as `--radius-control: 10px`, `--radius-popover: 16px`, `--radius-card: 24px`, and `--radius-composer: 26px`. Use the card radius for dialogs. Keep page insets and content widths in shared tokens too; do not repeat these constants in individual components.

### Responsive rules

- Design the narrow layout as a complete workflow. Keep action order and content meaning consistent with desktop.
- Collapse columns when they can no longer hold readable content and usable controls. Around 700 px is a useful starting point for replacing a sidebar with mobile navigation; it is not a universal device boundary.
- Wrap toolbars at the width of their container. An inspector can make a desktop work area as narrow as a mobile one. Prefer container queries for these local changes.
- Support 320 CSS px without horizontal page scrolling. Truly two-dimensional content, such as a large data table, map, or document, may scroll inside a labeled region. See [WCAG reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Use `min-width: 0` for flexible text columns and `minmax(0, 1fr)` for grids. Wrap meaningful names; truncate compact navigation only when the full name is available elsewhere without relying solely on hover.
- Keep DOM order consistent with reading and keyboard order. Do not use visual reordering to conceal an incoherent mobile flow.
- Mobile navigation appears at its final position with a fade. A header provides page identity and a navigation control; no duplicate branding strip is necessary.
- Constrain overlays to the viewport. Use dynamic viewport height and safe-area insets where needed. With the software keyboard open, fields, errors, cancel, and submit must remain reachable.
- Give each scroll region a purpose. Independent scrolling is appropriate for navigation, an editor, or an inspector; arbitrary nested scroll boxes are not.
- Use `scrollbar-gutter: stable` where classic scrollbars would shift content. Locking the page for a modal must not change its horizontal position. Avoid double scrollbar compensation.
- Sticky controls reserve enough space that the final content and focused element remain visible.

## 4. Color and surface tokens

Use these paired semantic tokens as the starting palette. A component consumes a role, never a theme-specific hex value. Keep theme values in one place.

### Neutral palette

| Token                    | Dark      | Light     | Role                                       |
| ------------------------ | --------- | --------- | ------------------------------------------ |
| `--surface-page`         | `#0E0E0E` | `#FCFCFC` | Main canvas                                |
| `--surface-sidebar`      | `#0E0E0E` | `#FCFCFC` | Persistent navigation                      |
| `--surface-raised`       | `#1E1E1E` | `#FFFFFF` | Bounded content surface                    |
| `--surface-composer`     | `#212121` | `#FFFFFF` | Substantial input workspace                |
| `--surface-input`        | `#212121` | `#FFFFFF` | Field interior                             |
| `--surface-popover`      | `#303030` | `#FFFFFF` | Floating menu or popover                   |
| `--surface-hover`        | `#262626` | `#EFEFEF` | Hovered row or quiet action                |
| `--surface-selected`     | `#303030` | `#EAEAEA` | Persistent selection                       |
| `--surface-code`         | `#262626` | `#EFEFEF` | Code and small technical insets            |
| `--surface-viewer`       | `#171717` | `#EEEEEE` | Surroundings of documents or media         |
| `--text-primary`         | `#EDEDED` | `#0D0D0D` | Main content and labels                    |
| `--text-secondary`       | `#B4B4B4` | `#535353` | Supporting information                     |
| `--text-muted`           | `#A0A0A0` | `#686868` | Tertiary metadata and placeholders         |
| `--border-subtle`        | `#323232` | `#E2E2E2` | Nonessential dividers                      |
| `--border-strong`        | `#404040` | `#D0D0D0` | More distinct surface separation           |
| `--border-selected`      | `#858585` | `#8D8D8D` | Outlined selection                         |
| `--border-control`       | `#858585` | `#8D8D8D` | Boundary when needed to identify a control |
| `--action-background`    | `#FFFFFF` | `#0D0D0D` | Primary action                             |
| `--action-hover`         | `#DDDDDD` | `#333333` | Primary action hover                       |
| `--action-foreground`    | `#0D0D0D` | `#FFFFFF` | Primary action label                       |
| `--focus-ring`           | `#B4B4B4` | `#535353` | Keyboard focus                             |
| `--selection-background` | `#494949` | `#D8D8D8` | Selected text                              |
| `--selection-foreground` | `#FFFFFF` | `#0D0D0D` | Selected text foreground                   |
| `--scrollbar`            | `#424242` | `#C6C6C6` | Secondary scroll affordance                |

The dark theme separates layers through small luminance changes. The light theme uses white surfaces against an off-white page, with fine dividers. Light mode is designed independently; do not obtain it by inverting the dark page.

`--border-strong` describes relative visual emphasis, not a contrast guarantee. Use `--border-control` when a field boundary or state indicator is necessary to identify the component, and verify its actual adjacent colors. Decorative dividers may remain subtle. Required visual cues need at least 3:1 contrast under [WCAG non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

### State palette

| Token                   | Dark      | Light     |
| ----------------------- | --------- | --------- |
| `--danger-text`         | `#F4AAA5` | `#9C322A` |
| `--danger-background`   | `#31201F` | `#FFF2F0` |
| `--danger-border`       | `#68413C` | `#EDC5BF` |
| `--danger-action`       | `#AE3B32` | `#A7382E` |
| `--danger-action-hover` | `#C0463C` | `#892D26` |
| `--danger-action-text`  | `#FFFFFF` | `#FFFFFF` |
| `--warning-text`        | `#E5C68C` | `#735523` |
| `--warning-background`  | `#2B261D` | `#FAF5E9` |
| `--warning-border`      | `#62543A` | `#DDCDA8` |
| `--positive-text`       | `#BED3C2` | `#3A5739` |
| `--positive-background` | `#202923` | `#F0F5EF` |
| `--info-text`           | `#A8BBD1` | `#4C6881` |

Use state color locally: a label, small marker, field message, or bounded notice. Pair it with explicit text or another recognizable cue. A red dot is not an error explanation. The positive palette is for a confirmed positive state, never implied accuracy, permission, or approval.

State borders are subtle companions to their text. They must not be the only indicator of an error or warning. Use a stronger boundary when that boundary carries essential information.

Charts may use additional colors when multiple series require them. Keep mappings consistent, provide labels or patterns, and verify contrast in both themes. Preserve the original colors of photos, videos, maps, product images, and source documents. The surrounding UI follows the theme; source pixels do not receive a global grayscale or inversion filter.

### Overlays

| Token              | Dark                           | Light                          |
| ------------------ | ------------------------------ | ------------------------------ |
| `--backdrop`       | `rgb(0 0 0 / 64%)`             | `rgb(0 0 0 / 35%)`             |
| `--shadow-popover` | `0 8px 30px rgb(0 0 0 / 26%)`  | `0 8px 28px rgb(0 0 0 / 12%)`  |
| `--shadow-modal`   | `0 24px 80px rgb(0 0 0 / 42%)` | `0 24px 80px rgb(0 0 0 / 20%)` |

No translucent glass is needed. Floating surfaces remain opaque and readable above busy content.

### Theme behavior

Offer Light, Dark, and System when the application has appearance settings. Dark is the reference baseline; System is a valid project default when the audience or context favors it. An explicit saved choice takes precedence.

Apply the resolved theme before the first paint, including the page background and `color-scheme`. System mode follows operating-system changes during the session. If storage is unavailable, changing the appearance still works for the current session. Do not animate the entire palette through intermediate colors.

Both themes use identical component structure, dimensions, and state semantics. Do not let theme-specific overrides become a second component system.

## 5. Typography, icons, and imagery

Use a neutral sans-serif with open forms and good small-size legibility. Inter is the reference choice; a well-matched system stack is acceptable. Prefer locally served fonts where available, with a fallback that limits layout shift. Load only the weights and language coverage the product needs.

| Role                               | Size     | Weight  | Line height    |
| ---------------------------------- | -------- | ------- | -------------- |
| Page title                         | 24–28 px | 500     | 1.2–1.3        |
| Section title                      | 16–18 px | 500     | 1.35–1.5       |
| Reading text                       | 15–16 px | 400     | 1.5–1.65       |
| Text input                         | 16 px    | 400     | 1.5–1.6        |
| Navigation, controls, field labels | 14 px    | 400–500 | At least 20 px |
| Supporting metadata                | 12–13 px | 400     | 1.4–1.5        |

- Use 400, 500, and 600 for normal hierarchy. Emphasize selected words, not entire paragraphs. Do not change font weight on selection if it changes layout.
- With Inter, page titles may use slightly tight tracking, around `-0.02em` to `-0.025em`. Keep body and control tracking normal. Verify another font before transferring that adjustment.
- Left-align ordinary content. Center only content whose function benefits from it, such as a compact value above a slider.
- A public page may use a larger factual title when its hierarchy needs it. Do not import large promotional typography into work surfaces or introduce decorative eyebrow text.
- Use tabular numerals for changing counts, aligned numeric columns, timers, and comparable values. Keep units and precision consistent.
- Essential information stays at readable body or control size. Muted text is lower priority, not lower legibility.
- Use one icon family: simple line icons, typically 18–20 px, stroke 1.5–1.75. Use fixed icon slots so substitution or rotation cannot move labels.
- Give icon-only controls accessible names. Add a tooltip when the meaning needs discovery; essential actions and explanations remain available on touch and keyboard.
- Brand marks identify the product. They occupy a reserved space and remain legible at small sizes. Do not copy another product's name or monogram.
- Images must show relevant objects, examples, people, products, evidence, or instructions. Do not add abstract illustrations merely because the page has room.
- Image text follows the same writing rules as UI text. Prefer real HTML text for editable, selectable, translatable interface content. Supply appropriate alt text; decorative images receive empty alt text.

## 6. Component patterns

### Navigation and page headers

Use full-width navigation rows with restrained icons and a quiet selected background. Unselected rows sit directly on the navigation surface. Keep hover, current page, and keyboard focus distinguishable. Use links for navigation and `aria-current="page"` for the current destination.

Headers identify the current object or task. Put its main action nearby. Show breadcrumbs only when they support actual hierarchy or return navigation. Keep metadata below the title or on a stable secondary line. Do not repeat the title as an eyebrow, card heading, and toolbar label.

Navigation, compact labels, and optional status indicators reserve enough room for supported states. A background status check must not briefly display an error or setup action before its result is known.

### Buttons and controls

- **Primary:** high-contrast neutral fill. Use for the principal next action in the current task region.
- **Secondary:** transparent or quiet surface with a border when useful. Use for alternatives of lower priority.
- **Tertiary:** text or icon action with a hover surface. Use for local utilities.
- **Destructive:** explicit verb and object. Use danger color for the committing action, not for an entire page.

Keep the same box, border width, and text metrics across idle, hover, press, focus, selected, disabled, and busy states. Reserve icon and label space. Use a transparent border in the base state if another state needs a visible border. Focus outlines sit outside the box without changing its size.

Use one obvious primary action per task region. Separate competing actions by priority and placement. Do not disable an action without an understandable reason near the relevant field or control. Tooltips alone cannot explain a disabled button to every user.

### Forms and composing surfaces

Group input by meaning. Labels remain visible; placeholders contain examples, never the only label or the user's actual data. Explain a constraint near the field before it causes a failure.

A composing surface is a rounded group for substantial input and its tools. It can contain attachments, text, configuration, and a final action, but it is not a mandatory chat interface. Keep the core input and toolbar in consistent positions across modes. Put mode-specific secondary controls after them or reserve a genuinely shared slot.

Use a stable initial textarea height appropriate to the content. Scroll longer text inside it and allow intentional resizing where useful. Typing must not repeatedly push the toolbar away. Adding an attachment or explicitly revealing a section may change the layout once.

Keep advanced options behind a named disclosure. Show their current values where those values affect the next decision. Do not duplicate values in a closed summary and a permanently visible second location without a reason.

Preserve exact input when validation fails or limits are exceeded. Never silently truncate, overwrite, or replace an intentional blank. Applying a template requires a clear action; append or explicitly confirm replacement when user work already exists.

### Lists, tables, and cards

Use rows for repeated objects and tables when people compare the same fields across objects. Use cards when each object has a substantial preview, mixed content, or a separate bounded task. Do not turn every table row into a large rounded box.

Keep labels and values aligned. Put counts in the controls where they inform filtering or selection. A second decorative summary of the same counts adds noise. Keep bulk actions visible in a reserved toolbar or a stable overlay so selection does not shift rows.

Sorting, filtering, and selection have separate semantics. Keep object identity stable across updates. Secondary actions may appear on hover and focus, but must remain reachable on touch. Avoid nested buttons inside a clickable row; provide distinct semantic controls.

### Tabs, filters, and disclosure

Tabs change a view of the same context. Filters change which items appear. Navigation changes location. Use the appropriate semantics and keyboard model for each.

Selection appears in place using a fill, border, or short underline. Do not move a shared highlight between controls. Reserve count width and keep font metrics stable. If only one meaningful view exists, use a section heading instead of a one-item tab bar.

Disclosures commit their expanded height immediately; the new content may fade in. Keep the trigger still. Expanding one item should not automatically collapse another item above it unless an exclusive accordion is a deliberate product requirement. Detail-pane selection must not unexpectedly change disclosure state.

### Menus, pickers, and sliders

Menus use full-width rows, readable labels, and a quieter secondary line when needed. Separate destructive actions from ordinary commands. Align to the trigger; reposition to stay inside the viewport. Internal scrolling keeps a long menu usable.

Choose a native select, listbox, combobox, or command menu based on behavior. Do not apply `role="menu"` to an arbitrary collection of controls. Keyboard behavior must match the chosen pattern. Escape dismisses and returns focus. A picker starts from the current selection; arrow keys and Home/End work where appropriate.

Prefer a native range input for sliders. Keep the track, thumb, and label in fixed geometry. Input updates the value immediately. For named levels, provide `aria-valuetext` and map only valid steps. A custom visual track must not replace native semantics or intercept the thumb's input.

### Dialogs and notices

Use a dialog for a bounded decision or task that needs temporary focus. Provide a specific title, content, and clear completion or cancellation. Size to the task, cap the height to the viewport, and keep important actions reachable without trapping the footer off-screen.

Open at the final size and position with an opacity transition. The backdrop may fade with it; do not also animate an inner copy of the dialog content. Avoid nested modals where a disclosure or next step would suffice.

Place field errors next to fields, task errors near the action, and persistent service problems in the affected region. Use a toast for brief, nonessential confirmation. Never make a disappearing toast the only place containing a failure, required action, or recovery instruction.

### Inspectors, previews, and supporting detail

Use a side pane when users need to compare supporting content with the main work. Dock only when both panes remain usable. A starting arrangement is a main pane of at least 420 px and a detail pane no wider than half the viewport; wider content may need larger minimums. Derive the breakpoint from both panes, navigation, and gutters. Around 1400 px is a reference starting point, not a fixed rule.

At narrower widths, use a full-screen detail view with an explicit close or back action. Preserve the main page's selection and return position. Keep the pane's title, toolbar, and scroll container stable while switching records, images, or sources.

Opening reserves the final pane width immediately. Only its inner surface may enter from the right using the panel spring defined below. Closing releases the space once. Switching the selected item does not replay the entrance or animate the split.

When the pane is docked and nonmodal, the main work remains interactive. A full-screen modal variant traps focus and makes the background inert. Returning restores focus to the invoking control without a scroll jump, or to a logical fallback if that control no longer exists.

### Data, media, and source views

Show units, labels, timeframe, and source context where they change interpretation. Unknown data is not zero. A loading region is not an empty dataset. Charts need readable labels and access to precise values without pointer-only hover.

Use a quiet viewer canvas and a stable toolbar. Reserve media dimensions before loading. Keep original source content distinct from commentary, transformed views, and generated suggestions. A visual match or successful fetch does not imply validation of the underlying claim.

When offering alternate rendering or color modes, name the mode and preserve access to the original. Do not alter source pixels to match the interface theme by default.

## 7. Interaction, state, and continuity

### State contract

| State              | Required behavior                                                     |
| ------------------ | --------------------------------------------------------------------- |
| Idle               | Clear label and recognizable affordance                               |
| Hover              | Local color, background, or border change; no geometry change         |
| Focus              | Visible outline distinct from selection and hover                     |
| Pressed            | Immediate tonal feedback; same position and dimensions                |
| Selected / current | Persistent local indication with matching semantic state              |
| Disabled           | Remains identifiable; reason available when not self-evident          |
| Busy               | Name the operation; reserve dimensions; prevent duplicate submission  |
| Empty              | Name the missing content; do not repeat an already visible action     |
| Error              | Explain the actual problem and a known recovery action; preserve work |
| Complete           | Reflect confirmed completion and expose the result where useful       |

Keep active controls responsive while unrelated work runs. Offer cancellation when the operation supports it. Do not simulate a working cancel action when the underlying operation continues unchanged.

Use real progress only when it can be measured. Otherwise show an indeterminate indicator and an accurate activity label. Avoid artificial minimum delays, fake percentage completion, or a full-page loading state for a small local update. During refresh, retain useful existing data when appropriate and identify stale content if that affects the decision.

Skeletons, when needed, match the final structure and reserve its space. Static placeholders are the default. Avoid shimmer, pulsing text, and repeated attention-seeking animation.

### Layout stability

Reserve the width of changing labels, counters, icons, and expected states. Prefer content-based sizing that accounts for supported translations. Do not hardcode one English label's width and assume every language fits.

For a button whose label changes, an invisible sizing label can share a grid cell with the current label:

```html
<button type="button">
  <span class="stable-label">
    <span class="stable-label__reserve" aria-hidden="true">Saving changes…</span>
    <span>Save changes</span>
  </span>
</button>
```

```css
.stable-label {
  display: inline-grid;
  min-width: 0;
}

.stable-label > span {
  grid-area: 1 / 1;
}

.stable-label__reserve {
  visibility: hidden;
  pointer-events: none;
}
```

The reserve represents the widest supported label, or multiple reserved variants if needed. Only the current label belongs to the accessible name. Reserve any busy icon separately. Do not use `display: none` for sizing content.

Route changes use the same page origin. Scrollbar appearance, late fonts, image loading, validation, and status updates must not create incidental jumps. Scope scroll anchoring deliberately in dynamic regions; do not disable it globally as a substitute for fixing layout.

Requested structural changes are allowed: opening a disclosure, adding an item, resizing a pane, or changing orientation. Apply the change coherently once. Do not spring the height or width of the entire surrounding page.

### Preserve user work

- Keep independent drafts when users switch tasks or modes that can reasonably be resumed. Make persistence limits clear when they affect loss of work.
- Preserve list filters and the return position after inspecting an item.
- Do not silently change an option because a background request completed. If an option becomes invalid, explain the replacement or require a new choice.
- Show saved state only after the relevant operation succeeds. Keep pending and unsaved states distinct.
- Prefer undo for actions that can be reliably reversed. Use confirmation for a consequential irreversible action; name the object and actual effect.
- Keep copied, downloaded, original, edited, and generated content distinguishable when their identity matters.

## 8. Motion system

Motion communicates a state change or the arrival of supporting content. Most of the interface stays still. A small number of responsive, consistent transitions creates the feel; adding motion to more elements does not improve it.

### Shared timing presets

| Preset    | Duration | Easing                       | Use                                         |
| --------- | -------- | ---------------------------- | ------------------------------------------- |
| `press`   | 60 ms    | `easeOut`                    | Press feedback through tone or opacity      |
| `release` | 140 ms   | `easeOut`                    | Return to the resting appearance            |
| `fade`    | 120 ms   | `easeOut`                    | Small local opacity changes                 |
| `enter`   | 160 ms   | `cubic-bezier(0.2, 0, 0, 1)` | Menus, dialog surface, mobile navigation    |
| `exit`    | 100 ms   | `cubic-bezier(0.4, 0, 1, 1)` | Removal of floating surfaces                |
| `page`    | 180 ms   | `cubic-bezier(0.2, 0, 0, 1)` | New page content at its final position      |
| `color`   | 140 ms   | `cubic-bezier(0.2, 0, 0, 1)` | Background, border, and text-color feedback |

For CSS implementations, map `easeOut` to `ease-out`. Durations are milliseconds here; libraries may accept seconds. Centralize the conversion.

The reference press treatment uses opacity `0.88`, returning to `1` on release. Apply it only when text and state indicators retain sufficient contrast; otherwise use a background-color change within the same fixed box.

### Spring presets

| Preset    | Stiffness | Damping | Mass | Allowed use                                        |
| --------- | --------- | ------- | ---- | -------------------------------------------------- |
| `control` | 500       | 38      | 0.8  | Rotation of a small state icon inside a fixed slot |
| `panel`   | 400       | 38      | 0.9  | Right-side detail surface on opening               |

These presets settle firmly, with no conspicuous bounce. They are physics parameters in Motion's convention; another engine may require translation. Do not substitute an elastic easing or a long overshoot. A timed fade does not need a spring. See [Motion's transition reference](https://motion.dev/docs/react-transitions).

```js
// Example configuration; the system does not require this library.
export const motionPresets = {
  control: { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 },
  panel: { type: 'spring', stiffness: 400, damping: 38, mass: 0.9 },
  fade: { duration: 0.12, ease: 'easeOut' },
  enter: { duration: 0.16, ease: [0.2, 0, 0, 1] },
  exit: { duration: 0.1, ease: [0.4, 0, 1, 1] },
  page: { duration: 0.18, ease: [0.2, 0, 0, 1] },
  press: { duration: 0.06, ease: 'easeOut' },
  release: { duration: 0.14, ease: 'easeOut' },
  color: { duration: 0.14, ease: [0.2, 0, 0, 1] },
};
```

### Motion by interaction

| Interaction                       | Animate                                                       | Keep fixed                                       |
| --------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Hover or press                    | Background, border, text color; optional small opacity change | Button, hit target, label, icon slot             |
| Select a tab, row, or mode        | Indicator fades in at its own position                        | Control metrics; no traveling highlight          |
| Open a menu or dialog             | Opacity                                                       | Final position, size, and inner content layout   |
| Open mobile navigation            | Opacity at the final position                                 | Drawer geometry                                  |
| Change route                      | Optional fade of arriving content                             | Page grid and main heading origin                |
| Expand a section                  | Optional content fade after layout is committed               | Trigger position; no animated height             |
| Rotate a chevron                  | Child icon rotation using `control`                           | Surrounding slot and text                        |
| Open detail pane                  | Inner surface from `x: 100%` to `x: 0` using `panel`          | Final split width, outer frame, main-page anchor |
| Switch detail item                | Update within the mounted pane                                | Split, outer frame, toolbar, and controls        |
| Close detail pane                 | Immediate removal and one layout update                       | Return focus and reading position                |
| Drag, scrub, resize, pan, or zoom | Direct response to user input where the task requires it      | Unrelated controls and layout                    |

The detail pane is the intentional spatial entrance exception. It is not a general license to slide pages, navigation, dialogs, toasts, or buttons. Direct manipulation is functional movement and follows the pointer or keyboard value without a delayed spring.

### Interruption and lifecycle

- Commit state immediately. Never wait for an animation before accepting the next action or starting useful work.
- Allow rapid open, close, and reopen. Retarget an in-flight transition from its current state; do not queue old intentions.
- Animate only one entrance layer per content surface. Avoid parent-and-child fade multiplication and staggered appearance of ordinary controls.
- An exiting overlay becomes noninteractive immediately. Move focus out before marking it `inert` and `aria-hidden`; disable pointer interaction during the visual tail. Do not leave hidden tab stops or duplicate accessible content mounted.
- Release a closed modal's focus trap immediately and restore the invoking control with `preventScroll` when available. If the trigger was removed, choose the next logical focus target.
- Remove closed content in normal document flow immediately. Holding it for an exit animation must not leave a blank gap.
- Do not animate `height`, `width`, padding, or layout projection as routine selection or click feedback. Avoid `transition: all`.
- Use `transform` only for the permitted local movement and `opacity` for fades. Do not keep permanent `will-change` on the interface.
- Scroll to selected content only when the user requests it and it is outside the visible area. Do not move the page on incidental updates.

### Reduced motion

Observe `prefers-reduced-motion` on initial load and when it changes during the session. Under reduced motion, apply this system's UI transitions immediately, omit the detail-pane slide, stop decorative loops and spinners, and make scrolling instantaneous. Keep final icon orientation, progress meaning, and status text correct.

An animation library's accessibility mode is an additional safeguard. It may disable transforms while retaining fades, so it does not replace the explicit instant-transition policy above. See [Motion accessibility behavior](https://motion.dev/docs/react-accessibility). Do not rely on an animation-completion event to finish essential application logic.

### Optional motion inside a control

A deliberately commissioned expressive accent can live inside a bounded control, such as particles flowing within a slider's filled track. This is an optional pattern, not a default decoration.

The native control owns input and focus. Decoration stays behind it, is `aria-hidden`, ignores pointer events, and never moves the thumb, label, or neighboring controls. Animate only while visible; stop when closed or off-screen. Changes in intensity preserve the current phase rather than restarting with a flash. Reduced motion uses a static result. The numeric or named value must communicate everything needed without the effect.

## 9. Product writing

Before adding text, ask: **Does this change what the user can identify, understand, decide, or do?** If not, remove it. Empty space does not create a copy requirement.

Use concrete nouns, active verbs, and consistent terms. Name the operation, object, state, and actual consequence. Match the user's language and the product's level of formality. Keep titles and actions compact; allow error messages enough words to be useful.

| Purpose             | Suitable text, when true                      |
| ------------------- | --------------------------------------------- |
| Start work          | “New project”                                 |
| Commit a change     | “Save changes”                                |
| Empty collection    | “No invoices yet”                             |
| No filtered results | “No results for these filters”                |
| Ongoing work        | “Uploading 2 of 5 files…”                     |
| Input constraint    | “Choose a file smaller than 12 MB.”           |
| Recoverable failure | “Upload failed. Your file is still selected.” |
| Irreversible action | “Delete ‘Draft 4’? This cannot be undone.”    |
| Missing source      | “The source file is no longer available.”     |

These illustrate form, not content to add. Use the actual limits and consequences. If the action is already visible, an empty state need not repeat its instruction. If a failure's cause is unknown, say what failed rather than inventing a diagnosis.

Exclude slogans, brand poetry, motivational lines, abstract benefit claims, artificial three-part formulas, decorative headings, fictional testimonials, fake metrics, and repeated reassurance. Public pages can explain an offering with specific facts, real examples, and relevant evidence. They do not need invented marketing language.

Put a warning where its consequence matters: price before purchase, permissions before granting access, irreversible loss before deletion. Keep details expandable when they are not needed for the immediate decision. Do not repeat a general disclaimer under every surface.

Do not call something saved, verified, secure, compliant, accurate, or complete without the corresponding evidence. Describe the actual operation or limitation precisely. Distinguish a generated suggestion from original material and a match from validation.

## 10. Accessibility requirements

- Use semantic HTML first: links for navigation, buttons for actions, labels for inputs, and tables for tabular relationships. Decorative icons are hidden from assistive technology.
- Maintain a coherent heading outline and meaningful landmarks. Provide a skip link for repeated navigation. A visual change of page must also provide a sensible title and focus destination.
- Every interaction works with keyboard and touch. Hover never contains the only available action, full value, or required explanation.
- Use a visible focus outline, typically 2 px with a 4 px offset. Check it on selected rows, dark surfaces, white primary buttons, and clipped containers. Focus must remain visible under sticky headers and overlays.
- Normal text needs at least 4.5:1 contrast. Large text needs at least 3:1: 24 CSS px regular or approximately 18.67 CSS px bold qualifies; a 500-weight 18 px heading does not. Measure resolved foreground and background colors, including alpha compositing. See [WCAG text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Use 44 × 44 CSS px as the design target for primary touch controls. Small secondary targets must meet the 24 × 24 CSS px minimum or an applicable spacing exception; inline text links have separate exceptions. See [WCAG target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Associate help and error text with its field. Use `aria-invalid` when invalidity is established. Announce important status changes without repeatedly interrupting typing; reserve alerts for information requiring immediate attention.
- A modal has an accessible name, appropriate initial focus, contained keyboard focus, a reachable close or cancel action, and an inert background. Escape closes the top applicable layer. On close, restore a logical focus target. Initial focus depends on the task; destructive confirmation should not default to its destructive action. See the [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Menus, tabs, listboxes, comboboxes, and sliders use the keyboard and focus model belonging to their semantics. A styled native control is preferable to an incomplete custom widget.
- At 200% text size and narrow or zoomed layouts, content remains readable and controls remain reachable. Respect user text spacing. Do not clip validation text or translated labels into fixed-height boxes.
- Check forced colors where supported. Focus, selection, and essential control boundaries must survive removal of backgrounds and shadows.
- Reduced motion changes animation, never the available function. Disabled animation cannot prevent submission, closure, navigation, or status completion.

This is a design and implementation checklist, not a claim that a product is conformant solely because it uses these tokens.

## 11. Engineering and verification

### Implementation boundaries

Keep one theme token layer, one shared spacing and sizing vocabulary, and one motion preset module. Components describe their semantic state. Avoid per-page copies of buttons, dialogs, and fields that drift in geometry or behavior.

Use native layout and controls before adding JavaScript. Introduce an animation dependency only for behavior it materially improves, such as an interruptible spring. Load expensive editors, viewers, and media processing when needed. Pause work that has no visible or functional purpose.

Reserve image and font geometry. Keep local feedback independent from request latency. Expensive rendering must not block typing, scrolling, or closing a pane. Preserve stateful content while changing its presentation when practical; do not remount an editor simply to dock its inspector.

Use real or clearly identified synthetic content for review. Include long names, populated screens, empty data, and a meaningful failure. Avoid perfect placeholder content that hides overflow and recovery problems. Visual review must not require paid operations or live customer data.

### Review sequence

1. **Structure:** Identify the primary task, necessary regions, and action hierarchy. Remove containers and text without a function.
2. **Visual system:** Review a representative populated screen in both themes. Check hierarchy, alignment, line length, neutral layers, and consistent radii.
3. **Narrow layout:** Inspect at 320–390 px and at the width where a toolbar or multi-pane layout changes. Verify navigation, long labels, overlays, and software-keyboard behavior where relevant.
4. **Interaction:** Complete the affected task with pointer, keyboard, and touch as applicable. Verify error recovery, retained input, Escape, and return focus.
5. **Motion:** Test rapid open–close–reopen, changing selection during a transition, and changing the reduced-motion preference while the page is open.
6. **Stability:** Measure affected controls through several animation frames; inspect scrollbar and content-loading changes. A final screenshot alone does not verify stability.
7. **Delivery:** Run the existing build or smoke checks appropriate to the change. Add durable tests for meaningful risks such as data loss, access, transaction correctness, source integrity, or paid requests. Do not create a large variant matrix for a small styling or copy change.

### Layout-stability acceptance

For an interaction that should preserve geometry, record `getBoundingClientRect()` for the target, its label, and nearby unchanged controls immediately before input and on successive `requestAnimationFrame` callbacks through completion. Changes in `x`, `y`, `width`, or `height` should stay within **0.5 CSS px**, excluding intentional scrolling or resizing.

Keep this measurement separate from screenshots taken after transitions settle. Check the actual interaction rather than a mock of its animation settings. For an intentional structural change, verify the single new layout and stable subsequent frames. When opening a detail pane, measure the surrounding controls and reserved split, not the inner surface that is intentionally sliding.

### Final acceptance

- The primary task is evident without an explanatory introduction.
- The page contains only relevant content, actions, and truthful states.
- Both themes use shared semantic roles; source media retains its intended appearance.
- Controls remain in place through press, selection, focus, and loading.
- Labels, counts, fonts, and scrollbars do not cause incidental layout shifts.
- Overlays stay inside the viewport, close correctly, and restore focus.
- Narrow layouts preserve the workflow and all required information.
- Reduced motion is usable, static, and functionally complete.
- Input and context survive recoverable errors and ordinary navigation.
- The implementation and this guide agree on any deliberately changed values.

## 12. Starting another project

Use this brief with the copied file:

> Build the requested interface using `design.md`. Apply its neutral palette, typography, spacing, component states, stable geometry, functional writing, and motion presets. Choose the layout from the actual task. Implement complete responsive and accessible workflows. Record any deliberate deviation with its reason.

Before implementation, identify the primary task, content objects, required states, navigation depth, narrow-screen behavior, and any real brand constraints. Choose the relevant patterns from this guide. Keep the rest out of the interface.
