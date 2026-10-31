# Accessibility

The target is WCAG 2.2 AA. **Not yet audited with tooling or assistive
technology.** The items below are implemented, not certified.

## Implemented
- Skip link, landmarks (`header`, `main`, `footer`), one `h1` per page.
- Search follows the ARIA combobox pattern: `listbox`, `aria-activedescendant`,
  arrow keys, Enter and Escape, and a live region announcing the result count.
- Tables have captions, header scopes, and `abbr` for column abbreviations.
- Visible focus ring on every focusable element.
- `prefers-reduced-motion` disables animation.
- Missing values show "—" with a text alternative ("Not available"), not colour alone.
- The comparison colours (blue and orange) are a colour-blind-safe pair and
  will always be paired with labels.

## To do (Phase 2)
- axe checks in CI; keyboard and VoiceOver passes on each new page.
- Contrast check of `--faint` text on `--surface` (designed for 4.5:1; verify).
- Accessible chart alternatives (data tables) for ECharts visuals.
