const STORAGE_KEY = "digitalNotebook.v1";

const DB_NAME = "digitalNotebookDB";
const DB_VERSION = 1;
const DB_STORE = "appState";

const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;

const now = () => new Date().toISOString();

// =====================================================
// DATA FACTORIES
// =====================================================

function makePage(number = 1) {
  return {
    id: uid("page"),
    number,
    strokes: [],
    images: [],
    texts: [],
    createdAt: now(),
    updatedAt: now(),
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
    updatedAt: now(),
  };
}

function makeFolder(name = "New Folder") {
  return {
    id: uid("folder"),
    name,
    createdAt: now(),
    updatedAt: now(),
  };
}

const defaultState = () => {
  const general = makeFolder("General");
  const welcome = makeNote("Welcome to Digital Notebook", general.id);

  welcome.pages[0].strokes = [];

  return {
    version: 1,
    folders: [general],
    notes: [welcome],
  };
};

// =====================================================
// DATA NORMALIZATION
// =====================================================

function normalizeState(state) {
  if (!state || !Array.isArray(state.notes) || !Array.isArray(state.folders)) {
    throw new Error("Invalid notebook data");
  }

  state.version = state.version || 1;

  state.notes.forEach((note) => {
    if (!Array.isArray(note.pages)) {
      note.pages = [];
    }

    note.pages.forEach((page, index) => {
      if (!Array.isArray(page.strokes)) {
        page.strokes = [];
      }

      if (!Array.isArray(page.images)) {
        page.images = [];
      }

      if (!Array.isArray(page.texts)) {
        page.texts = [];
      }

      if (!page.number) {
        page.number = index + 1;
      }

      if (!page.createdAt) {
        page.createdAt = now();
      }

      if (!page.updatedAt) {
        page.updatedAt = now();
      }
    });

    if (!Number.isFinite(note.scrollTop)) {
      note.scrollTop = 0;
    }

    if (!note.createdAt) {
      note.createdAt = now();
    }

    if (!note.updatedAt) {
      note.updatedAt = now();
    }
  });

  return state;
}

// =====================================================
// INDEXEDDB SUPPORT
// =====================================================

let databasePromise = null;

function indexedDBAvailable() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase() {
  if (!indexedDBAvailable()) {
    return Promise.resolve(null);
  }

  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(DB_STORE)) {
        database.createObjectStore(DB_STORE);
      }
    };

    request.onsuccess = () => {
      const database = request.result;

      database.onerror = () => {
        console.warn("IndexedDB database error occurred.");
      };

      resolve(database);
    };

    request.onerror = () => {
      console.warn("Could not open IndexedDB:", request.error);

      databasePromise = null;
      resolve(null);
    };

    request.onblocked = () => {
      console.warn("IndexedDB opening is blocked by another tab.");
    };
  });

  return databasePromise;
}

async function saveToIndexedDB(state) {
  try {
    const database = await openDatabase();

    if (!database) {
      return false;
    }

    return await new Promise((resolve) => {
      const transaction = database.transaction(DB_STORE, "readwrite");

      const store = transaction.objectStore(DB_STORE);

      store.put(state, STORAGE_KEY);

      transaction.oncomplete = () => {
        resolve(true);
      };

      transaction.onerror = () => {
        console.warn(
          "Could not save notebook to IndexedDB:",
          transaction.error,
        );

        resolve(false);
      };

      transaction.onabort = () => {
        resolve(false);
      };
    });
  } catch (error) {
    console.warn("IndexedDB save failed:", error);

    return false;
  }
}

async function loadFromIndexedDB() {
  try {
    const database = await openDatabase();

    if (!database) {
      return null;
    }

    return await new Promise((resolve) => {
      const transaction = database.transaction(DB_STORE, "readonly");

      const store = transaction.objectStore(DB_STORE);
      const request = store.get(STORAGE_KEY);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.warn("Could not load notebook from IndexedDB:", request.error);

        resolve(null);
      };
    });
  } catch (error) {
    console.warn("IndexedDB load failed:", error);

    return null;
  }
}

// =====================================================
// LOCAL STORAGE
// =====================================================

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.error("Could not load notebook from localStorage:", error);

    return null;
  }
}

function saveToLocalStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    return true;
  } catch (error) {
    console.error("Could not save notebook to localStorage:", error);

    return false;
  }
}

// =====================================================
// PUBLIC STORAGE API
// =====================================================

export function loadState() {
  // Keep this function synchronous because app.js
  // currently expects the state immediately.

  const localState = loadFromLocalStorage();

  if (localState) {
    // Return Local Storage immediately.
    // app.js will compare it with IndexedDB before saving anything.
    return localState;
  }

  // If localStorage has no data, create the first state.
  const initial = defaultState();

  saveState(initial);

  // Also attempt to save the initial state to IndexedDB.
  saveToIndexedDB(initial).catch((error) => {
    console.warn("Initial IndexedDB save failed:", error);
  });

  return initial;
}

export function saveState(state) {
  const normalizedState = normalizeState(state);

  // Keep localStorage working as the immediate fallback.
  saveToLocalStorage(normalizedState);

  // Save the same state to IndexedDB in the background.
  saveToIndexedDB(normalizedState).catch((error) => {
    console.warn("Background IndexedDB save failed:", error);
  });
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
// ======================================================
// LOAD FROM INDEXEDDB
// ======================================================

export function loadStateFromIndexedDB() {
  return new Promise((resolve) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn("Could not open IndexedDB.");
      resolve(null);
    };

    request.onsuccess = () => {
      const database = request.result;

      const transaction = database.transaction(DB_STORE, "readonly");
      const store = transaction.objectStore(DB_STORE);

      const getRequest = store.get("digitalNotebook.v1");

      getRequest.onerror = () => {
        resolve(null);
      };

      getRequest.onsuccess = () => {
        const result = getRequest.result;

        if (!result) {
          resolve(null);
          return;
        }

        resolve(normalizeState(result));
      };
    };
  });
}
