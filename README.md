# 📓 Digital Notebook

A lightweight, beginner-friendly digital notebook web app built with vanilla HTML, CSS and JavaScript.

## Current Phase 3 features

- Drawing with mouse, touch and stylus/pointer input
- Pen size and color controls
- Eraser
- Multiple notebook pages
- Continuous vertical page scrolling
- New page / Continue section
- Resume last page and scroll position
- Paste and upload images
- Move, resize and delete inserted images
- Local autosave
- My Notes home screen
- Folders
- Create, rename, move and delete notes
- Create, rename and delete folders
- Search notes
- Git-friendly modular file structure

## Parked for Phase 4

Handwriting-to-text using Tesseract.js is intentionally not included in the active editor. Recognition quality was not good enough for messy handwriting. A better handwriting-capable AI provider will be evaluated in Phase 4.

## Current storage

This Phase 3 implementation uses `localStorage` to keep the setup simple. Large image-heavy notebooks can exceed browser storage limits. IndexedDB is planned for the next storage phase.

## Run locally

Open `index.html` in a modern browser. For best module behavior, use a local server such as VS Code Live Server.

No build step is required.
