# Accessibility

Target: WCAG 2.2 AA and genuine keyboard/screen-reader usability across current and previous major Chrome, Edge, Firefox, and Safari. Pilot-device research may tighten this support policy.

## Implemented foundation

The document declares `en-IN`; pages use semantic landmarks and headings, programmatic labels, native controls, visible focus, reduced-motion handling, responsive grids, horizontally scrollable wide data tables, loading/error/permission states, and a portal skip link whose target is programmatically focusable.

## Definition of done

- One descriptive H1 and sensible heading hierarchy; content belongs to landmarks.
- Every control has a persistent accessible name, keyboard behavior, focus state, error association, and valid autocomplete where relevant.
- Dynamic critical errors use an appropriate alert/live-region pattern without noisy loading announcements.
- Tables have captions and scoped headers; charts expose text summaries or data tables.
- State never relies on colour alone; normal text is at least 4.5:1 and component/large-text contrast at least 3:1.
- At 200% zoom and 320 CSS px width, content and actions remain usable without two-dimensional scrolling except genuine tables/diagrams.
- Motion respects `prefers-reduced-motion`; no content flashes more than three times per second.
- Dialogs/menus manage focus and dismissal correctly. Native elements are preferred to custom ARIA.

## Test matrix

CI smoke tests verify language, main landmark, H1, labelled authentication fields, keyboard focusability, narrow viewport behavior, and browser headers. Before each release, run an automated axe/Lighthouse scan plus manual Tab/Shift+Tab/Enter/Space/Escape operation, 200% and 400% zoom/reflow, forced colours/high contrast, reduced motion, and screen-reader checks: NVDA/Firefox, Narrator/Edge, VoiceOver/Safari, and TalkBack/Chrome where portals are used on mobile.

Automated scores cannot approve a flow. Business-critical sign-in, context switching, attendance marking, marks entry, payment collection, student search, and parent/student result access require manual testing and feedback from disabled users before production.

## Known gaps

The current smoke suite has no axe dependency, contrast automation, or screen-reader automation. Mobile `<details>` navigation is not a modal dialog and requires explicit manual focus/escape/backdrop testing. Wide operational workspaces require complete 200% zoom review. Record findings by page, browser, assistive technology, severity, owner, and retest evidence.
