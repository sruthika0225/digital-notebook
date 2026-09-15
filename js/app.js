import {
  loadState,
  saveState,
  loadStateFromIndexedDB,
  createNote,
  createFolder,
  touch,
} from "./storage.js";
import { auth } from "./firebase.js";

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import "./handwriting-provider.js";
import { convertHandwriting } from "./handwriting.js";
import { NotebookEditor } from "./pages.js";

let state = loadState();

const els = {
  authScreen: document.getElementById("authScreen"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  showLoginBtn: document.getElementById("showLoginBtn"),
  showRegisterBtn: document.getElementById("showRegisterBtn"),
  authMessage: document.getElementById("authMessage"),
  logoutBtn: document.getElementById("logoutBtn"),
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

function setStatus(message, type = "normal") {
  els.status.textContent = message;

  els.status.classList.remove(
    "status-saving",
    "status-saved",
    "status-error",
    "status-restored",
  );

  if (type === "saving") {
    els.status.classList.add("status-saving");
  }

  if (type === "saved") {
    els.status.classList.add("status-saved");
  }

  if (type === "error") {
    els.status.classList.add("status-error");
  }

  if (type === "restored") {
    els.status.classList.add("status-restored");
  }
}

function persist({ silent = false } = {}) {
  clearTimeout(saveTimer);

  if (!silent) {
    setStatus("Saving…", "saving");
  }

  saveTimer = setTimeout(() => {
    try {
      saveState(state);

      if (!silent) {
        setStatus("Saved locally", "saved");
      }
    } catch (error) {
      console.error("Save failed:", error);

      setStatus("Save failed", "error");

      alert(
        "The notebook could not be saved. Please check available browser storage.",
      );
    }
  }, 180);
}

function persistNow() {
  clearTimeout(saveTimer);

  try {
    saveState(state);
    setStatus("Saved locally", "saved");
  } catch (error) {
    console.error("Save failed:", error);
    setStatus("Save failed", "error");
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

  editor.onSelectionChange = (pageId, selection) => {
    updateConvertButtonVisibility(!!selection);
  };

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

function createActionModal({
  title,
  message = "",
  options = [],
  inputLabel = "",
  inputValue = "",
  confirmText = "Confirm",
  danger = false,
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "action-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "action-modal";

    const heading = document.createElement("h3");
    heading.textContent = title;

    const description = document.createElement("p");
    description.className = "action-modal-message";
    description.textContent = message;

    modal.append(heading);

    if (message) {
      modal.append(description);
    }

    let input = null;

    if (inputLabel) {
      const label = document.createElement("label");
      label.className = "action-modal-label";
      label.textContent = inputLabel;

      input = document.createElement("input");
      input.className = "action-modal-input";
      input.type = "text";
      input.value = inputValue;
      input.required = true;

      modal.append(label, input);
    }

    const actions = document.createElement("div");
    actions.className = "action-modal-actions";

    function close(value) {
      overlay.remove();
      resolve(value);
    }

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "modal-btn modal-cancel";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => close(null));

    actions.append(cancelButton);

    if (options.length > 0) {
      options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "modal-btn";

        if (option.danger) {
          button.classList.add("modal-danger");
        }

        button.textContent = option.label;

        button.addEventListener("click", () => {
          close(option.value);
        });

        actions.append(button);
      });
    } else {
      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "modal-btn";

      if (danger) {
        confirmButton.classList.add("modal-danger");
      }

      confirmButton.textContent = confirmText;

      confirmButton.addEventListener("click", () => {
        if (input && !input.value.trim()) {
          input.focus();
          return;
        }

        close(input ? input.value.trim() : true);
      });

      actions.append(confirmButton);
    }

    modal.append(actions);
    overlay.append(modal);
    document.body.append(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });

    if (input) {
      input.focus();

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          close(input.value.trim());
        }

        if (event.key === "Escape") {
          close(null);
        }
      });
    }
  });
}

async function noteMenu(note) {
  const choice = await createActionModal({
    title: note.title,
    message: "Choose an action for this note.",
    options: [
      {
        label: "Rename",
        value: "rename",
      },
      {
        label: "Move to folder",
        value: "move",
      },
      {
        label: "Delete",
        value: "delete",
        danger: true,
      },
    ],
  });

  if (choice === "rename") {
    renameNote(note);
  }

  if (choice === "move") {
    moveNote(note);
  }

  if (choice === "delete") {
    deleteNote(note);
  }
}

async function folderMenu(folder) {
  const choice = await createActionModal({
    title: folder.name,
    message: "Choose an action for this folder.",
    options: [
      {
        label: "Rename",
        value: "rename",
      },
      {
        label: "Delete",
        value: "delete",
        danger: true,
      },
    ],
  });

  if (choice === "rename") {
    renameFolder(folder);
  }

  if (choice === "delete") {
    deleteFolder(folder);
  }
}

async function renameNote(note) {
  const name = await createActionModal({
    title: "Rename note",
    inputLabel: "Note name",
    inputValue: note.title,
    confirmText: "Save name",
  });

  if (!name) return;

  note.title = name;

  touch(note);

  persistNow();
  renderHome();

  if (currentNote?.id === note.id) {
    els.editorTitle.textContent = note.title;
  }
}

async function renameFolder(folder) {
  const name = await createActionModal({
    title: "Rename folder",
    inputLabel: "Folder name",
    inputValue: folder.name,
    confirmText: "Save name",
  });

  if (!name) return;

  folder.name = name;

  persistNow();
  renderHome();

  if (currentNote) {
    els.editorFolder.textContent = `📁 ${folderName(currentNote.folderId)}`;
  }
}

async function moveNote(note) {
  const folders = state.folders;

  if (!folders.length) {
    await createActionModal({
      title: "No folders available",
      message: "Create a folder first before moving this note.",
      options: [
        {
          label: "Okay",
          value: true,
        },
      ],
    });

    return;
  }

  const choice = await createActionModal({
    title: "Move note",
    message: `Choose a folder for "${note.title}".`,
    options: folders.map((folder) => ({
      label: folder.name,
      value: folder.id,
    })),
  });

  if (!choice) return;

  const folder = folders.find((item) => item.id === choice);

  if (!folder) return;

  note.folderId = folder.id;

  touch(note);

  persistNow();
  renderHome();
}

async function deleteNote(note) {
  const confirmed = await createActionModal({
    title: "Delete note?",
    message: `Delete "${note.title}" and all its pages? This cannot be undone.`,
    confirmText: "Delete note",
    danger: true,
  });

  if (!confirmed) return;

  if (currentNote?.id === note.id) {
    showHome();
  }

  state.notes = state.notes.filter((item) => item.id !== note.id);

  persistNow();
  renderHome();
}

async function deleteFolder(folder) {
  const notes = state.notes.filter((note) => note.folderId === folder.id);

  const message = notes.length
    ? `Delete "${folder.name}"? Its ${notes.length} note(s) will become Unfiled.`
    : `Delete "${folder.name}"?`;

  const confirmed = await createActionModal({
    title: "Delete folder?",
    message,
    confirmText: "Delete folder",
    danger: true,
  });

  if (!confirmed) return;

  notes.forEach((note) => {
    note.folderId = null;
  });

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

  button.textContent = "T";
  button.setAttribute("aria-label", "Type text");

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
// SELECT + CONVERT TO TEXT (uses the real HTML toolbar
// button and the handwritingModal already in index.html)
// ======================================================

const selectButton = document.getElementById("selectBtn");
const convertTextBtn = document.getElementById("convertTextBtn");

const hw = {
  modal: document.getElementById("handwritingModal"),
  message: document.getElementById("handwritingModalMessage"),
  preview: document.getElementById("handwritingPreview"),
  result: document.getElementById("handwritingResult"),
  loading: document.getElementById("handwritingLoading"),
  cancelBtn: document.getElementById("cancelHandwritingBtn"),
  convertBtn: document.getElementById("convertSelectedBtn"),
  insertBtn: document.getElementById("insertHandwritingTextBtn"),
  closeBtn: document.getElementById("closeHandwritingModal"),
};

let pendingSelectionImage = null;

selectButton?.addEventListener("click", () => {
  editor?.setTool("select");
  updateToolButtons();
  updateConvertButtonVisibility(!!editor?.getSelectionState());
});

function showConvertTextButton(show) {
  if (!els.convertTextBtn) return;

  els.convertTextBtn.classList.toggle("hidden", !show);
  els.convertTextBtn.disabled = !show;
}

function updateConvertButtonVisibility(hasSelection) {
  if (convertTextBtn) convertTextBtn.disabled = !hasSelection;
}

function resetHandwritingModal() {
  hw.message.textContent = "Ready to convert your selected handwriting.";
  hw.result.classList.add("hidden");
  hw.result.value = "";
  hw.loading.classList.add("hidden");
  hw.insertBtn.classList.add("hidden");
  hw.convertBtn.classList.remove("hidden");
  hw.convertBtn.disabled = false;
}

function openHandwritingModal() {
  pendingSelectionImage = editor?.exportCurrentSelection();

  if (!pendingSelectionImage) {
    alert(
      "Select some handwriting first — use the Select tool, then drag a box around it.",
    );
    return;
  }

  hw.preview.innerHTML = "";

  const img = document.createElement("img");
  img.src = pendingSelectionImage;
  img.style.maxWidth = "100%";
  img.style.borderRadius = "6px";
  hw.preview.appendChild(img);

  resetHandwritingModal();
  hw.modal.classList.remove("hidden");
}

function closeHandwritingModal() {
  hw.modal.classList.add("hidden");
}

convertTextBtn?.addEventListener("click", openHandwritingModal);

hw.convertBtn.addEventListener("click", async () => {
  if (!pendingSelectionImage) return;

  hw.convertBtn.disabled = true;
  hw.loading.classList.remove("hidden");
  hw.message.textContent = "Reading your handwriting…";

  try {
    const text = await convertHandwriting(pendingSelectionImage);

    hw.loading.classList.add("hidden");
    hw.convertBtn.classList.add("hidden");
    hw.result.classList.remove("hidden");
    hw.result.value = text;
    hw.insertBtn.classList.remove("hidden");
    hw.message.textContent =
      "Edit anything that came out wrong, then insert it. Your original handwriting is untouched.";
  } catch (error) {
    console.error("Handwriting conversion failed:", error);

    hw.loading.classList.add("hidden");
    hw.convertBtn.disabled = false;
    hw.message.textContent =
      error.message || "Could not convert the handwriting. Please try again.";
  }
});

hw.insertBtn.addEventListener("click", () => {
  const text = hw.result.value.trim();

  if (text) {
    editor.insertConvertedText(text);
  }

  editor.clearCurrentSelection();
  updateConvertButtonVisibility(false);

  editor.setTool("draw");
  updateToolButtons();

  closeHandwritingModal();
});

hw.cancelBtn.addEventListener("click", closeHandwritingModal);
hw.closeBtn.addEventListener("click", closeHandwritingModal);

// ======================================================
// TOOL BUTTONS
// ======================================================

function updateToolButtons() {
  els.pen?.classList.toggle("active", editor?.tool === "draw");

  els.eraser?.classList.toggle("active", editor?.tool === "erase");

  els.adjust?.classList.toggle("active", editor?.tool === "adjust");

  typeButton?.classList.toggle("active", editor?.tool === "type");

  selectButton?.classList.toggle("active", editor?.tool === "select");
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

/// ======================================================
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
      console.log("No IndexedDB backup found.");
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

    const indexedDBHasMoreNotes =
      indexedDBState.notes.length > state.notes.length;

    const indexedDBIsNewer = indexedDBLatestTime > localLatestTime;

    if (indexedDBHasMoreNotes || indexedDBIsNewer) {
      state = indexedDBState;

      saveState(state);
      renderHome();

      setStatus("Restored from IndexedDB", "restored");

      console.log("Notebook restored from IndexedDB.");
    } else {
      saveState(state);

      console.log("Local notebook data is current.");
    }
  } catch (error) {
    console.warn("IndexedDB restore skipped:", error);
  }
}
// ======================================================
// FIREBASE AUTHENTICATION
// ======================================================

function showAuthMessage(message, isError = true) {
  els.authMessage.textContent = message;
  els.authMessage.style.color = isError ? "#b04435" : "#2f855a";
}

function showLoginForm() {
  els.loginForm.classList.remove("hidden");
  els.registerForm.classList.add("hidden");

  els.showLoginBtn.classList.add("active");
  els.showRegisterBtn.classList.remove("active");

  showAuthMessage("");
}

function showRegisterForm() {
  els.loginForm.classList.add("hidden");
  els.registerForm.classList.remove("hidden");

  els.showLoginBtn.classList.remove("active");
  els.showRegisterBtn.classList.add("active");

  showAuthMessage("");
}

els.showLoginBtn.addEventListener("click", showLoginForm);

els.showRegisterBtn.addEventListener("click", showRegisterForm);

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    showAuthMessage("Signing in...", false);

    await signInWithEmailAndPassword(auth, email, password);

    showAuthMessage("Signed in successfully.", false);
  } catch (error) {
    console.error("Login failed:", error);

    showAuthMessage(error.message);
  }
});

els.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;

  try {
    showAuthMessage("Creating account...", false);

    await createUserWithEmailAndPassword(auth, email, password);

    showAuthMessage("Account created successfully.", false);
  } catch (error) {
    console.error("Registration failed:", error);

    showAuthMessage(error.message);
  }
});

els.logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.body.classList.remove("auth-locked");

    els.authScreen.classList.add("hidden");
    els.logoutBtn.classList.remove("hidden");

    els.home.classList.remove("hidden");

    console.log("Signed in as:", user.email);
  } else {
    document.body.classList.add("auth-locked");

    els.authScreen.classList.remove("hidden");
    els.logoutBtn.classList.add("hidden");

    els.home.classList.add("hidden");
    els.editor.classList.add("hidden");
  }
});
// ======================================================
// START
// ======================================================

renderHome();
updateToolButtons();

restoreFromIndexedDB();
