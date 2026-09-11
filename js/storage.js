const STORAGE_KEY = "digitalNotebook.v1";

const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

const now = () => new Date().toISOString();

function makePage(number = 1) {
  return {
    id: uid("page"),
    number,
    strokes: [],
    images: [],
    createdAt: now(),
    updatedAt: now()
  };
}

function makeNote(title = "Untitled Note", folderId = null) {
  const page = makePage(1);
  return {
    id: uid("note"),
    title,
    folderId,
    pages: [page],
    lastPageId: page.id,
    scrollTop: 0,
    createdAt: now(),
    updatedAt: now()
  };
}

function makeFolder(name = "New Folder") {
  return {
    id: uid("folder"),
    name,
    createdAt: now()
  };
}

const defaultState = () => {
  const general = makeFolder("General");
  const welcome = makeNote("Welcome to Digital Notebook", general.id);
  welcome.pages[0].strokes = [];
  return {
    version: 1,
    folders: [general],
    notes: [welcome]
  };
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = defaultState();
      saveState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.notes) || !Array.isArray(parsed.folders)) {
      throw new Error("Invalid notebook data");
    }
    return parsed;
  } catch (error) {
    console.error("Could not load notebook data:", error);
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createNote(title, folderId = null) {
  return makeNote(title, folderId);
}

export function createFolder(name) {
  return makeFolder(name);
}

export function createPage(number) {
  return makePage(number);
}

export function createId(prefix) {
  return uid(prefix);
}

export function touch(item) {
  item.updatedAt = now();
}
