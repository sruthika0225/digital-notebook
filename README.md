# Digital Notebook — Phase 4

This package adds the first part of optional handwriting-to-text support.

## Included

- Handwriting selection mode
- Drag-to-select area on a notebook page
- Selection preview
- Conversion modal
- Provider abstraction in `js/handwriting.js`

## Important

The actual handwriting AI provider is intentionally NOT connected yet.

When the user clicks Convert before a provider is configured, the app will say:

"Handwriting AI is not connected yet."

Normal notebook writing, erasing, images, pages, scrolling and autosave remain unchanged.

## Installation

Replace these existing files:

- `js/canvas.js`
- `js/pages.js`
- `js/handwriting.js`

Add the CSS from:

- `css/phase4-handwriting.css`

Then add the HTML block from:

- `phase4-index-additions.html`

Your existing `app.js` still needs the event wiring for the new button/modal. Because `app.js` is project-specific, the safest next step is to provide the current `app.js` and I can return a complete replacement rather than asking you to find individual lines.
