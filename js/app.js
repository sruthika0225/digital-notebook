import {
  loadState,
  saveState,
  loadStateFromIndexedDB,
  createNote,
  createFolder,
  touch,
} from "./storage.js";

import { NotebookEditor } from "./pages.js";

let state = loadState();

const els = {
  home: document.getElementById("notesHome"),
  editor: document.getElementById("editorScreen"),
  notesTree: document.getElementById("notesTree"),
  search: document.getElementById("searchInput"),
  newNote: document.getElementById("newNoteBtn"),
  newFolder: document.getElementById("newFolderBtn"),
  brandHome: document.getElementById("brandHome"),
  back: document.getElementById("backToNotesBtn"),
  status: document.getElementById("syncStatus"),
  editorTitle: document.getElementById("editorTitle"),
  editorFolder: document.getElementById("editorFolder"),
  pages: document.getElementById("notebookPages"),
  viewport: document.getElementById("notebookViewport"),
  addPage: document.getElementById("addPageBtn"),
  continueBtn: document.getElementById("continueBtn"),
  renameNote: document.getElementById("renameNoteBtn"),
  pen: document.getElementById("penBtn"),
  eraser: document.getElementById("eraserBtn"),
  adjust: document.getElementById("adjustImagesBtn"),
  size: document.getElementById("sizeInput"),
  sizeValue: document.getElementById("sizeValue"),
  color: document.getElementById("colorInput"),
  undo: document.getElementById("undoBtn"),
  redo: document.getElementById("redoBtn"),
  modal: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  modalMessage: document.getElementById("modalMessage"),
  modalInput: document.getElementById("modalInput"),
  modalSelectWrap: document.getElementById("modalSelectWrap"),
  modalSelect: document.getElementById("modalSelect"),
  modalCancel: document.getElementById("modalCancel"),
  modalConfirm: document.getElementById("modalConfirm"),
};

let currentNote = null;
let editor = null;
let saveTimer = null;
let modalResolver = null;

// ======================================================
// STATUS / SAVE
// ======================================================

function setStatus(message) {
  els.status.textContent = message;
}

function persist({ silent = false } = {}) {
  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    try {
      saveState(state);

      if (!silent) {
        setStatus("Saved locally");
      }
    } catch (error) {
      console.error(error);

      setStatus("Could not save — storage may be full");

      alert(
        "The notebook could not be saved. Large images can exceed browser localStorage limits. We will move this to IndexedDB in a later phase.",
      );
    }
  }, 180);

  if (!silent) {
    setStatus("Saving…");
  }
}

function persistNow() {
  clearTimeout(saveTimer);

  try {
    saveState(state);
    setStatus("Saved locally");
  } catch (error) {
    console.error(error);
    setStatus("Could not save — storage may be full");
  }
}

// ======================================================
// HOME
// ======================================================

function folderName(folderId) {
  return (
    state.folders.find((folder) => folder.id === folderId)?.name || "Unfiled"
  );
}

function renderHome() {
  const query = els.search.value.trim().toLowerCase();

  els.notesTree.innerHTML = "";

  const folders = [...state.folders];

  if (folders.length === 0) {
    const empty = document.createElement("div");

    empty.className = "empty";

    empty.innerHTML =
      "<strong>No folders yet.</strong><br>Create a folder or a note to get started.";

    els.notesTree.appendChild(empty);
  }

  const visibleNotes = (note) =>
    !query ||
    note.title.toLowerCase().includes(query) ||
    folderName(note.folderId).toLowerCase().includes(query);

  for (const folder of folders) {
    const notes = state.notes.filter(
      (note) => note.folderId === folder.id && visibleNotes(note),
    );

    if (query && !notes.length && !folder.name.toLowerCase().includes(query)) {
      continue;
    }

    const card = document.createElement("section");

    card.className = "folder-card";

    const head = document.createElement("div");

    head.className = "folder-head";

    const title = document.createElement("div");

    title.className = "folder-title";

    title.innerHTML = `
      <span>📁</span>
      <span>${escapeHtml(folder.name)}</span>
    `;

    const folderActions = document.createElement("div");

    folderActions.innerHTML = `
      <button class="more-btn" title="Folder options">⋮</button>
    `;

    folderActions
      .querySelector("button")
      .addEventListener("click", () => folderMenu(folder));

    head.append(title, folderActions);

    const notesWrap = document.createElement("div");

    notesWrap.className = "folder-notes";

    notes.forEach((note) => {
      notesWrap.appendChild(noteCard(note));
    });

    if (!notes.length) {
      const emptyText = document.createElement("p");

      emptyText.className = "muted";
      emptyText.style.padding = "12px";
      emptyText.textContent = "No notes in this folder.";

      notesWrap.appendChild(emptyText);
    }

    card.append(head, notesWrap);

    els.notesTree.appendChild(card);
  }

  const unfiled = state.notes.filter(
    (note) => !note.folderId && visibleNotes(note),
  );

  if (unfiled.length || (!state.notes.length && !state.folders.length)) {
    const card = document.createElement("section");

    card.className = "folder-card";

    const head = document.createElement("div");

    head.className = "folder-head";

    head.innerHTML = `
      <div class="folder-title">
        <span>🗂️</span>
        <span>Unfiled</span>
      </div>
    `;

    const wrap = document.createElement("div");

    wrap.className = "folder-notes";

    unfiled.forEach((note) => {
      wrap.appendChild(noteCard(note));
    });

    card.append(head, wrap);

    els.notesTree.appendChild(card);
  }

  if (!els.notesTree.children.length) {
    const empty = document.createElement("div");

    empty.className = "empty";

    empty.innerHTML = "No notes match your search.";

    els.notesTree.appendChild(empty);
  }
}

function noteCard(note) {
  const row = document.createElement("div");

  row.className = "note-card";

  const open = document.createElement("button");

  open.className = "note-open";

  open.innerHTML = `
    <span class="note-icon">📓</span>

    <span class="note-info">
      <span class="note-name">
        ${escapeHtml(note.title)}
      </span>

      <span class="note-meta">
        ${note.pages.length}
        page${note.pages.length === 1 ? "" : "s"}
        ·
        ${formatDate(note.updatedAt)}
      </span>
    </span>
  `;

  open.addEventListener("click", () => openNote(note.id));

  const more = document.createElement("button");

  more.className = "more-btn";

  more.textContent = "⋮";
  more.title = "Note options";

  more.addEventListener("click", () => noteMenu(note));

  row.append(open, more);

  return row;
}

function formatDate(value) {
  if (!value) {
    return "Not yet saved";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not yet saved";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}

// ======================================================
// OPEN / CLOSE NOTE
// ======================================================

function showHome() {
  if (editor) {
    editor.savePosition();
    editor.destroy();
    editor = null;
  }

  currentNote = null;

  els.editor.classList.add("hidden");
  els.home.classList.remove("hidden");
  els.back.classList.add("hidden");

  renderHome();
  persistNow();
}

function openNote(noteId) {
  const note = state.notes.find((item) => item.id === noteId);

  if (!note) return;

  currentNote = note;

  els.home.classList.add("hidden");
  els.editor.classList.remove("hidden");
  els.back.classList.remove("hidden");

  els.editorTitle.textContent = note.title;

  els.editorFolder.textContent = `📁 ${folderName(note.folderId)}`;

  editor?.destroy();

  editor = new NotebookEditor({
    container: els.pages,
    viewport: els.viewport,
    note,

    onChange: (silent) => persist({ silent }),
  });

  els.viewport.onscroll = () => {
    note.scrollTop = els.viewport.scrollTop;

    persist({
      silent: true,
    });
  };

  requestAnimationFrame(() => {
    editor.restorePosition();
    updateToolButtons();
  });
}

// ======================================================
// NOTE / FOLDER MENUS
// ======================================================

function noteMenu(note) {
  const choice = prompt(
    `Options for "${note.title}"\n\n1 = Rename\n2 = Move to folder\n3 = Delete`,
    "1",
  );

  if (choice === "1") renameNote(note);

  if (choice === "2") moveNote(note);

  if (choice === "3") deleteNote(note);
}

function folderMenu(folder) {
  const choice = prompt(
    `Options for "${folder.name}"\n\n1 = Rename\n2 = Delete`,
    "1",
  );

  if (choice === "1") renameFolder(folder);

  if (choice === "2") deleteFolder(folder);
}

function renameNote(note) {
  const name = prompt("New note name:", note.title);

  if (!name?.trim()) return;

  note.title = name.trim();

  touch(note);

  persistNow();
  renderHome();

  if (currentNote?.id === note.id) {
    els.editorTitle.textContent = note.title;
  }
}

function renameFolder(folder) {
  const name = prompt("New folder name:", folder.name);

  if (!name?.trim()) return;

  folder.name = name.trim();

  persistNow();
  renderHome();

  if (currentNote) {
    els.editorFolder.textContent = `📁 ${folderName(currentNote.folderId)}`;
  }
}

function moveNote(note) {
  const folders = state.folders;

  if (!folders.length) {
    alert("Create a folder first.");

    return;
  }

  const names = folders
    .map((folder, i) => `${i + 1}. ${folder.name}`)
    .join("\n");

  const choice = Number(
    prompt(`Move "${note.title}" to:\n\n${names}\n\nEnter folder number:`),
  );

  const folder = folders[choice - 1];

  if (!folder) return;

  note.folderId = folder.id;

  touch(note);

  persistNow();
  renderHome();
}

function deleteNote(note) {
  if (
    !confirm(`Delete "${note.title}" and all its pages? This cannot be undone.`)
  ) {
    return;
  }

  if (currentNote?.id === note.id) {
    showHome();
  }

  state.notes = state.notes.filter((item) => item.id !== note.id);

  persistNow();
  renderHome();
}

function deleteFolder(folder) {
  const notes = state.notes.filter((note) => note.folderId === folder.id);

  const message = notes.length
    ? `Delete "${folder.name}"? Its ${notes.length} note(s) will become Unfiled.`
    : `Delete "${folder.name}"?`;

  if (!confirm(message)) return;

  notes.forEach((note) => (note.folderId = null));

  state.folders = state.folders.filter((item) => item.id !== folder.id);

  persistNow();
  renderHome();
}

// ======================================================
// MODAL
// ======================================================

function openModal({
  title,
  message = "",
  placeholder = "",
  confirmText = "Create",
  showFolder = false,
  folders = [],
}) {
  els.modalTitle.textContent = title;

  els.modalMessage.textContent = message;

  els.modalInput.value = "";

  els.modalInput.placeholder = placeholder;

  els.modalConfirm.textContent = confirmText;

  els.modalSelectWrap.classList.toggle("hidden", !showFolder);

  els.modalSelect.innerHTML = "";

  if (showFolder) {
    for (const folder of folders) {
      const option = document.createElement("option");

      option.value = folder.id;

      option.textContent = folder.name;

      els.modalSelect.appendChild(option);
    }
  }

  els.modal.classList.remove("hidden");

  setTimeout(() => els.modalInput.focus(), 0);

  return new Promise((resolve) => {
    modalResolver = resolve;
  });
}

function closeModal(value = null) {
  els.modal.classList.add("hidden");

  const resolve = modalResolver;

  modalResolver = null;

  resolve?.(value);
}

els.modalCancel.addEventListener("click", () => closeModal(null));

els.modalConfirm.addEventListener("click", () => {
  const value = {
    name: els.modalInput.value.trim(),

    folderId: els.modalSelect.value || null,
  };

  closeModal(value);
});

els.modalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    els.modalConfirm.click();
  }

  if (event.key === "Escape") {
    closeModal(null);
  }
});

// ======================================================
// CREATE FOLDER / NOTE
// ======================================================

els.newFolder.addEventListener("click", async () => {
  const result = await openModal({
    title: "Create Folder",

    message:
      "Use folders to keep subjects, projects, or personal notes organized.",

    placeholder: "e.g. College",
  });

  if (!result?.name) return;

  state.folders.push(createFolder(result.name));

  persistNow();
  renderHome();
});

els.newNote.addEventListener("click", async () => {
  const result = await openModal({
    title: "Create Note",

    message: "Your note opens directly into the continuous notebook.",

    placeholder: "e.g. DBMS Notes",

    showFolder: state.folders.length > 0,

    folders: state.folders,

    confirmText: "Create Note",
  });

  if (!result?.name) return;

  const folderId = result.folderId || state.folders[0]?.id || null;

  const note = createNote(result.name, folderId);

  state.notes.push(note);

  persistNow();
  renderHome();

  openNote(note.id);
});

// ======================================================
// NAVIGATION
// ======================================================

els.brandHome.addEventListener("click", showHome);

els.brandHome.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    showHome();
  }
});

els.back.addEventListener("click", showHome);

els.search.addEventListener("input", renderHome);

// ======================================================
// PAGES
// ======================================================

els.addPage?.addEventListener("click", () => editor?.addPage());

els.continueBtn.addEventListener("click", () => editor?.addPage());

els.renameNote.addEventListener("click", () => {
  if (currentNote) {
    renameNote(currentNote);
  }
});

// ======================================================
// TYPE BUTTON
// ======================================================

function createTypeButton() {
  if (document.getElementById("typeBtn")) {
    return document.getElementById("typeBtn");
  }

  const button = document.createElement("button");

  button.id = "typeBtn";

  button.type = "button";

  button.textContent = "⌨️ Type";

  button.title = "Type text on the notebook page";

  button.className = "tool-btn";

  // Put it beside the pen button.
  els.pen.parentElement?.insertBefore(button, els.eraser);

  button.addEventListener("click", () => {
    editor?.setTool("type");
    updateToolButtons();
  });

  return button;
}

const typeButton = createTypeButton();

// ======================================================
// TOOL BUTTONS
// ======================================================

function updateToolButtons() {
  els.pen?.classList.toggle("active", editor?.tool === "draw");

  els.eraser?.classList.toggle("active", editor?.tool === "erase");

  els.adjust?.classList.toggle("active", editor?.tool === "adjust");

  typeButton?.classList.toggle("active", editor?.tool === "type");
}

els.pen.addEventListener("click", () => {
  editor?.setTool("draw");
  updateToolButtons();
});

els.eraser.addEventListener("click", () => {
  editor?.setTool("erase");
  updateToolButtons();
});

els.adjust?.addEventListener("click", () => {
  editor?.setTool("adjust");
  updateToolButtons();
});

// ======================================================
// PEN SETTINGS
// ======================================================

els.size.addEventListener("input", () => {
  els.sizeValue.textContent = els.size.value;

  editor?.setSize(els.size.value);
});

els.color.addEventListener("input", () => {
  editor?.setColor(els.color.value);

  updateToolButtons();
});

// ======================================================
// UNDO / REDO
// ======================================================

els.undo.addEventListener("click", () => editor?.undo());

els.redo.addEventListener("click", () => editor?.redo());

// ======================================================
// IMAGE PASTE
// ======================================================

document.addEventListener("paste", async (event) => {
  if (!editor || els.editor.classList.contains("hidden")) {
    return;
  }

  // Don't intercept paste while typing.
  if (
    editor.tool === "type" &&
    document.activeElement?.classList.contains("typed-text")
  ) {
    return;
  }

  const handled = await editor.pasteImage(event);

  if (handled) {
    event.preventDefault();
  }
});

// ======================================================
// SAVE BEFORE LEAVING
// ======================================================

window.addEventListener("beforeunload", () => {
  if (editor && currentNote) {
    editor.savePosition();
  }

  persistNow();
});

// ======================================================
// RESTORE FROM INDEXEDDB
// ======================================================

async function restoreFromIndexedDB() {
  try {
    const indexedDBState = await loadStateFromIndexedDB();

    if (
      !indexedDBState ||
      !Array.isArray(indexedDBState.notes) ||
      !Array.isArray(indexedDBState.folders)
    ) {
      return;
    }

    const localLatestTime = Math.max(
      0,
      ...state.notes.map((note) => new Date(note.updatedAt || 0).getTime()),
    );

    const indexedDBLatestTime = Math.max(
      0,
      ...indexedDBState.notes.map((note) =>
        new Date(note.updatedAt || 0).getTime(),
      ),
    );

    if (indexedDBLatestTime > localLatestTime) {
      state = indexedDBState;

      renderHome();

      setStatus("Restored from IndexedDB");

      console.log("Notebook restored from IndexedDB.");
    }
  } catch (error) {
    console.warn("IndexedDB restore skipped:", error);
  }
}

// ======================================================
// START
// ======================================================

renderHome();
updateToolButtons();

// Restore a newer copy from IndexedDB in the background.
restoreFromIndexedDB();
