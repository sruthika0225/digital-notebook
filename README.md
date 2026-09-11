# Digital Notebook

A free, offline-first digital notebook web app — draw, paste images, convert
handwriting to text, and flip through unlimited pages. Built to run well even
on low-budget tablets, not just premium ones. A personal, non-profit learning
project.

## Features (current prototype)
- Drawing canvas (mouse, touch, stylus) with pen + eraser
- Insert images (upload or paste) — movable and resizable
- Unlimited pages — add, navigate, auto-resumes the last page you were on
- Handwriting → Text using Tesseract.js (free, on-device OCR)
- Everything auto-saves locally, works fully offline

## Project structure
```
digital-notebook/
├── index.html          # App shell
├── css/styles.css       # All styling
├── js/
│   ├── storage.js        # Load/save notebook data (localStorage for now)
│   ├── canvas.js          # Drawing (pen/eraser) + mode switching
│   ├── images.js          # Movable/resizable images and text boxes
│   ├── pages.js           # Multi-page navigation and rendering
│   ├── handwriting.js     # Handwriting-to-text (OCR)
│   └── app.js             # Boots the app (load this last)
└── assets/icons/          # (reserved for future icons)
```

## Running it
No build step needed — just open `index.html` in a browser.

## Roadmap
See `roadmap.md` for the full phase-by-phase plan (GitHub setup, code
structure, AI handwriting recognition, offline storage upgrade,
authentication, cloud sync, PDF export, budget-tablet optimization, and
deployment).

## Status
Currently on **Phase 2 — clean project structure**. Core drawing, images,
pages, and handwriting-to-text are working in the browser-only prototype.
