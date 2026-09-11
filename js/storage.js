/*
  storage.js
  ----------
  Everything to do with saving and loading the notebook's data.
  Currently backed by localStorage (works offline, no setup needed).
  Phase 5 of the roadmap upgrades this file to use IndexedDB instead,
  without needing to touch canvas.js, images.js, or pages.js.

  Data shape (one entry per page):
    { ink: <dataURL or null>, images: [ {src,x,y,w,h}, ... ], texts: [ {text,x,y,w,h,fontSize}, ... ] }
*/

const STORAGE_KEY = 'notebook_pages_v3';
const CURRENT_PAGE_KEY = 'notebook_current_page_v3';

function loadPages() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* ignore, fall through */ }
  }
  return [ { ink: null, images: [], texts: [] } ];
}

function loadCurrentPage() {
  const raw = localStorage.getItem(CURRENT_PAGE_KEY);
  const idx = raw ? parseInt(raw, 10) : 0;
  return Number.isNaN(idx) ? 0 : idx;
}

function savePages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}

function saveCurrentPage() {
  localStorage.setItem(CURRENT_PAGE_KEY, String(currentPage));
}

// The notebook's live data, loaded as soon as the app starts.
let pages = loadPages();
let currentPage = loadCurrentPage();
