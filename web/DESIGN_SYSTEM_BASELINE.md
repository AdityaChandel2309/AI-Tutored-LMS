# Design System Baseline

This file tracks the current Phase 1 UI baseline for `web/`.

## Tokens

- Colors live in `src/app/globals.css`
- Radius token: `--radius`
- Surface, border, muted, and primary tokens are shared across cards, buttons, inputs, and badges

## Shared Primitives

- `Button`
- `Card`
- `Input`
- `Select`
- `Table`
- `Badge`
- `Field`
- `Notice`
- `SectionHeading`
- `Stat`

## Usage Rules

- Prefer shared primitives in dashboard/admin/profile flows before adding one-off classes
- Keep labels and helper text inside `Field` when forms need consistent spacing
- Use `Badge` for short semantic state labels like `active` and `inactive`
- Use `Notice` for inline success, warning, and error messaging instead of ad hoc colored paragraphs
- Use `SectionHeading` for repeatable card/page header structure with optional actions
- Use `Stat` for compact summary metrics or identity facts in dashboards and admin panels
- Prefer `Select` over one-off styled native `<select>` elements

## Known Gaps

- No dialog, toast, tabs, or navigation primitives yet
- No formal page-shell component yet
- Visual language is stronger now, but still not a full product design system
