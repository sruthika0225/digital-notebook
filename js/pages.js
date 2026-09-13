import { PageCanvas } from "./canvas.js";
import {
  renderImageLayer,
  setupImageInput,
  clipboardToImageRecord,
} from "./images.js";
import { createPage, touch } from "./storage.js";

const BASE_WIDTH = 794;
const BASE_HEIGHT = 1123;

export class NotebookEditor {
  constructor({ container, viewport, note, onChange }) {
    this.container = container;
    this.viewport = viewport;
    this.note = note;
    this.onChange = onChange;

    this.pageControllers = new Map();
    this.pageObservers = new Map();

    this.activePageId = null;

    // draw | erase | adjust | type
    this.tool = "draw";

    this.size = 3;
    this.color = "#222222";

    this.renderAll();
    this.bindGlobalKeyboard();
  }

  setTool(tool) {
    this.tool = tool;

    if (tool !== "type") {
      this.deselectAllText();
    }

    this.pageControllers.forEach((controller) => {
      controller.setTool(tool === "type" ? "draw" : tool);
    });

    this.setImageMode(tool === "adjust" ? "adjust" : "write");
    this.updateTypeMode();
  }

  setImageMode(mode) {
    this.container.querySelectorAll(".page-wrapper").forEach((wrapper) => {
      wrapper.classList.toggle("adjust-mode", mode === "adjust");
      wrapper.classList.toggle("write-mode", mode !== "adjust");
    });
  }

  setSize(size) {
    this.size = Number(size);

    this.pageControllers.forEach((controller) => {
      controller.setSize(this.size);
    });
  }

  setColor(color) {
    this.color = color;
    this.tool = "draw";

    this.deselectAllText();

    this.pageControllers.forEach((controller) => {
      controller.setColor(color);
      controller.setTool("draw");
    });

    this.setImageMode("write");
    this.updateTypeMode();
  }

  renderAll() {
    this.pageObservers.forEach((observer) => observer.disconnect());
    this.pageObservers.clear();

    this.pageControllers.forEach((controller) => controller.destroy());
    this.pageControllers.clear();

    this.container.innerHTML = "";

    this.note.pages.forEach((page, index) => {
      this.ensurePageData(page);
      this.renderPage(page, index);
    });

    this.updateTypeMode();
    this.restorePosition();
  }

  ensurePageData(page) {
    if (!Array.isArray(page.strokes)) {
      page.strokes = [];
    }

    if (!Array.isArray(page.images)) {
      page.images = [];
    }

    // Typed text layer
    if (!Array.isArray(page.texts)) {
      page.texts = [];
    }

    // Make older text objects compatible with resizing, formatting,
    // and display — anything missing gets a safe default instead of
    // silently breaking on reload.
    page.texts.forEach((text) => {
      if (!Number.isFinite(text.width)) {
        text.width = 260;
      }

      if (!Number.isFinite(text.fontSize)) {
        text.fontSize = 22;
      }

      if (typeof text.color !== "string") {
        text.color = "#222222";
      }

      if (typeof text.text !== "string") {
        text.text = "";
      }
    });
  }

  renderPage(page, index) {
    this.ensurePageData(page);

    const wrapper = document.createElement("article");
    wrapper.className = "page-wrapper";
    wrapper.dataset.pageId = page.id;

    // --------------------------------------------------
    // PAGE CONTROLS
    // --------------------------------------------------

    const pageControls = document.createElement("div");
    pageControls.className = "page-controls";

    const label = document.createElement("span");
    label.className = "page-label";
    label.textContent = `Page ${index + 1}`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "page-delete-btn";
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete page";
    deleteBtn.title = "Delete this page";

    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      this.deletePage(page.id);
    });

    pageControls.append(label, deleteBtn);

    // --------------------------------------------------
    // CANVAS
    // --------------------------------------------------

    const canvas = document.createElement("canvas");
    canvas.className = "page-canvas";
    canvas.width = BASE_WIDTH;
    canvas.height = BASE_HEIGHT;

    wrapper.append(pageControls, canvas);

    // --------------------------------------------------
    // TEXT LAYER
    // --------------------------------------------------

    const textLayer = document.createElement("div");
    textLayer.className = "page-text-layer";

    Object.assign(textLayer.style, {
      position: "absolute",
      inset: "0",
      zIndex: "15",
      pointerEvents: "none",
    });

    wrapper.appendChild(textLayer);

    // --------------------------------------------------
    // IMAGE BUTTON
    // --------------------------------------------------

    const imageButton = document.createElement("button");
    imageButton.className = "image-insert-btn";
    imageButton.type = "button";
    imageButton.textContent = "＋ Image";
    imageButton.title = "Insert an image";

    Object.assign(imageButton.style, {
      position: "absolute",
      left: "12px",
      top: "12px",
      zIndex: "30",
      border: "1px solid #ded7c9",
      borderRadius: "8px",
      background: "rgba(255,253,248,.92)",
      padding: "7px 10px",
      cursor: "pointer",
    });

    wrapper.appendChild(imageButton);

    this.container.appendChild(wrapper);

    // --------------------------------------------------
    // CANVAS CONTROLLER
    // --------------------------------------------------

    const controller = new PageCanvas(canvas, page, () => {
      touch(page);
      touch(this.note);
      this.onChange?.();
    });

    controller.setTool(this.tool === "type" ? "draw" : this.tool);
    controller.setSize(this.size);
    controller.setColor(this.color);

    // Let app.js know when a handwriting selection is made/cleared on
    // this page, so it can show/hide the "Convert to Text" button.
    controller.onSelectionChange = (selection) => {
      this.onSelectionChange?.(page.id, selection);
    };

    this.pageControllers.set(page.id, controller);

    // --------------------------------------------------
    // IMAGE HANDLING
    // --------------------------------------------------

    const openFile = setupImageInput({
      wrapper,
      page,
      onChange: () => {
        touch(page);
        touch(this.note);
        this.onChange?.();
      },
    });

    imageButton.addEventListener("click", openFile);

    renderImageLayer(wrapper, page, () => {
      touch(page);
      touch(this.note);
      this.onChange?.();
    });

    // --------------------------------------------------
    // TYPED TEXT
    // --------------------------------------------------

    this.renderTextLayer(wrapper, textLayer, page);

    textLayer.style.pointerEvents = this.tool === "type" ? "auto" : "none";

    wrapper.classList.toggle("adjust-mode", this.tool === "adjust");
    wrapper.classList.toggle("write-mode", this.tool !== "adjust");

    // --------------------------------------------------
    // ACTIVE PAGE TRACKING
    // --------------------------------------------------

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
            this.activePageId = page.id;
            this.note.lastPageId = page.id;
            this.onChange?.(false);
          }
        }
      },
      {
        root: this.viewport,
        threshold: [0.35, 0.6],
      },
    );

    observer.observe(wrapper);
    this.pageObservers.set(page.id, observer);

    wrapper.addEventListener("pointerdown", (event) => {
      // Don't change active page when clicking a text box.
      if (event.target.closest(".typed-text")) return;

      this.activePageId = page.id;
      this.note.lastPageId = page.id;
    });

    // --------------------------------------------------
    // TYPE MODE CLICK
    // --------------------------------------------------

    wrapper.addEventListener("click", (event) => {
      if (this.tool !== "type") return;

      if (
        event.target.closest(".typed-text") ||
        event.target.closest("button") ||
        event.target.closest(".page-controls")
      ) {
        return;
      }

      const rect = wrapper.getBoundingClientRect();

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.createTextBox(page, textLayer, x, y);
    });
  }

  // ====================================================
  // TEXT LAYER
  // ====================================================

  createTextBox(page, textLayer, x, y, initialText = "") {
    this.ensurePageData(page);

    const textData = {
      id: `text_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      x: Math.max(10, Math.min(BASE_WIDTH - 160, x)),
      y: Math.max(45, Math.min(BASE_HEIGHT - 60, y)),
      text: initialText,
      width: 260,
      fontSize: 22,
      color: this.color || "#222222",
    };

    page.texts.push(textData);

    const textBox = this.createTextElement(page, textLayer, textData);

    touch(page);
    touch(this.note);

    if (this.onChange) {
      this.onChange();
    }

    requestAnimationFrame(() => {
      this.selectTextBox(textBox);
      textBox.focus();

      const selection = window.getSelection();
      const range = document.createRange();

      range.selectNodeContents(textBox);
      range.collapse(false);

      selection.removeAllRanges();
      selection.addRange(range);
    });

    return textBox;
  }

  renderTextLayer(wrapper, textLayer, page) {
    textLayer.innerHTML = "";

    for (const text of page.texts) {
      this.createTextElement(page, textLayer, text);
    }
  }

  createTextElement(page, textLayer, textData) {
    // --------------------------------------------------
    // TEXT BOX WRAPPER
    // --------------------------------------------------

    const textBox = document.createElement("div");

    textBox.className = "typed-text";
    textBox.dataset.textId = textData.id;

    // IMPORTANT:
    // Only the actual text box is editable.
    textBox.contentEditable = "true";
    textBox.spellcheck = true;

    textBox.textContent = textData.text || "";

    // Older text objects may not have width.
    if (!Number.isFinite(textData.width)) {
      textData.width = 260;
    }

    Object.assign(textBox.style, {
      position: "absolute",

      left: `${textData.x}px`,
      top: `${textData.y}px`,

      width: `${textData.width}px`,

      minWidth: "120px",
      maxWidth: "650px",

      minHeight: "32px",

      padding: "4px 6px",

      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: `${textData.fontSize || 22}px`,
      lineHeight: "1.35",

      color: textData.color || "#222222",

      background: "transparent",

      border: "1px solid transparent",

      outline: "none",

      zIndex: "20",

      boxSizing: "border-box",

      // IMPORTANT TEXT LAYOUT FIX
      display: "block",
      whiteSpace: "pre-wrap",
      wordBreak: "normal",
      overflowWrap: "break-word",
      overflow: "visible",

      textAlign: "left",

      writingMode: "horizontal-tb",

      direction: "ltr",
    });

    // --------------------------------------------------
    // FOCUS
    // --------------------------------------------------
    // Selection (the .selected class) is what controls the visible
    // border/handle now — see selectTextBox()/deselectAllText().
    // Focus only matters for actually typing; it no longer drives
    // the visual state on its own, so clicking a toolbar button
    // (which blurs the text box) doesn't make it look deselected.

    // --------------------------------------------------
    // BLUR / SAVE TEXT
    // --------------------------------------------------

    textBox.addEventListener("blur", () => {
      textData.text = textBox.textContent || "";

      // Remove completely empty boxes.
      if (!textData.text.trim()) {
        page.texts = page.texts.filter((item) => item.id !== textData.id);

        textBox.remove();

        resizeHandle.remove();
        deleteBtn.remove();
      }

      touch(page);
      touch(this.note);

      this.onChange?.();
    });

    // --------------------------------------------------
    // TEXT INPUT
    // --------------------------------------------------

    textBox.addEventListener("input", () => {
      textData.text = textBox.textContent || "";

      touch(page);
      touch(this.note);

      this.onChange?.(true);
    });

    // --------------------------------------------------
    // CLICK
    // --------------------------------------------------

    textBox.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    // --------------------------------------------------
    // KEYBOARD
    // --------------------------------------------------

    textBox.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        textBox.blur();
      }
    });

    // --------------------------------------------------
    // MOVE TEXT BOX
    // --------------------------------------------------

    textBox.addEventListener("pointerdown", (event) => {
      if (this.tool !== "type") return;

      // Don't move while editing.
      if (document.activeElement === textBox) {
        return;
      }

      // Select it right away — this is what shows the border/handle/
      // delete button, independent of whether this turns into a tap
      // (focus for editing) or a drag (move).
      this.selectTextBox(textBox);

      event.preventDefault();
      event.stopPropagation();

      const wrapper = textBox.closest(".page-wrapper");

      if (!wrapper) return;

      const wrapperRect = wrapper.getBoundingClientRect();

      const startX = event.clientX;
      const startY = event.clientY;

      const startLeft = textData.x;
      const startTop = textData.y;

      // Track whether this turns into a real drag. A plain tap (no
      // movement) should focus the box for editing instead — since
      // preventDefault() above blocks the browser's normal
      // click-to-focus behavior, we have to do that focus manually.
      let moved = false;
      const DRAG_THRESHOLD = 4;

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;

        const dy = moveEvent.clientY - startY;

        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          moved = true;
        }

        const scaleX = BASE_WIDTH / wrapperRect.width;

        const scaleY = BASE_HEIGHT / wrapperRect.height;

        const newX = startLeft + dx * scaleX;

        const newY = startTop + dy * scaleY;

        textData.x = Math.max(
          10,
          Math.min(BASE_WIDTH - textData.width - 10, newX),
        );

        textData.y = Math.max(45, Math.min(BASE_HEIGHT - 40, newY));

        textBox.style.left = `${textData.x}px`;

        textBox.style.top = `${textData.y}px`;

        // Keep resize handle and delete button attached.
        resizeHandle.style.left = `${textData.x + textData.width - 6}px`;

        resizeHandle.style.top = `${textData.y + textBox.offsetHeight - 6}px`;

        deleteBtn.style.left = `${textData.x + textData.width - 8}px`;

        deleteBtn.style.top = `${textData.y - 10}px`;
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);

        window.removeEventListener("pointerup", onUp);

        if (!moved) {
          // It was just a tap, not a drag — focus it so it can be edited.
          textBox.focus();
          return;
        }

        touch(page);
        touch(this.note);

        this.onChange?.();
      };

      window.addEventListener("pointermove", onMove);

      window.addEventListener("pointerup", onUp);
    });

    // --------------------------------------------------
    // RESIZE HANDLE
    // --------------------------------------------------

    const resizeHandle = document.createElement("div");

    resizeHandle.className = "typed-text-resize";

    resizeHandle.title = "Resize text box";

    Object.assign(resizeHandle.style, {
      position: "absolute",

      width: "12px",
      height: "12px",

      background: "white",

      border: "1px solid #777",

      borderRadius: "2px",

      cursor: "nwse-resize",

      zIndex: "25",

      display: "none",
    });

    // Add BOTH elements to the text layer.
    textLayer.appendChild(textBox);
    textLayer.appendChild(resizeHandle);

    // --------------------------------------------------
    // DELETE BUTTON
    // --------------------------------------------------

    const deleteBtn = document.createElement("button");

    deleteBtn.type = "button";
    deleteBtn.className = "typed-text-delete";
    deleteBtn.title = "Delete text box";
    deleteBtn.textContent = "×";

    Object.assign(deleteBtn.style, {
      position: "absolute",
      width: "20px",
      height: "20px",
      lineHeight: "18px",
      textAlign: "center",
      padding: "0",
      border: "1px solid #d8d0c3",
      borderRadius: "50%",
      background: "#fff",
      color: "#b24a3d",
      cursor: "pointer",
      zIndex: "26",
      display: "none",
    });

    // Prevent this button from starting a drag on the text box
    // underneath it, and don't let its click bubble up to the
    // wrapper (which would otherwise create a brand-new text box
    // at this spot in type mode).
    deleteBtn.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      this.deleteTextBox(textBox);
    });

    textLayer.appendChild(deleteBtn);

    // Attach references so selectTextBox()/deselectAllText() can
    // find and toggle these without fragile DOM sibling lookups.
    textBox._resizeHandle = resizeHandle;
    textBox._deleteBtn = deleteBtn;
    textBox._textData = textData;
    textBox._page = page;

    // --------------------------------------------------
    // SELECTION (independent of edit focus)
    // --------------------------------------------------

    function positionOverlayControls() {
      positionResizeHandle();
    }

    textBox.addEventListener("blur", () => {
      // No-op here on purpose: staying selected through blur is the
      // whole point (item 7) — only deselectAllText() hides these.
    });

    function positionResizeHandle() {
      resizeHandle.style.left = `${textData.x + textData.width - 6}px`;

      resizeHandle.style.top = `${textData.y + textBox.offsetHeight - 6}px`;

      deleteBtn.style.left = `${textData.x + textData.width - 8}px`;

      deleteBtn.style.top = `${textData.y - 10}px`;
    }

    // --------------------------------------------------
    // RESIZE
    // --------------------------------------------------

    resizeHandle.addEventListener("pointerdown", (event) => {
      if (this.tool !== "type") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const wrapper = textBox.closest(".page-wrapper");

      if (!wrapper) return;

      const wrapperRect = wrapper.getBoundingClientRect();

      const startX = event.clientX;

      const startWidth = textData.width;

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;

        const scaleX = BASE_WIDTH / wrapperRect.width;

        const newWidth = startWidth + dx * scaleX;

        textData.width = Math.max(120, Math.min(650, newWidth));

        textBox.style.width = `${textData.width}px`;

        positionResizeHandle();
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);

        window.removeEventListener("pointerup", onUp);

        touch(page);
        touch(this.note);

        this.onChange?.();
      };

      window.addEventListener("pointermove", onMove);

      window.addEventListener("pointerup", onUp);
    });

    return textBox;
  }

  updateTypeMode() {
    this.container.querySelectorAll(".page-wrapper").forEach((wrapper) => {
      wrapper.classList.toggle("typing-mode", this.tool === "type");

      // Keep the text layer's pointer-events in sync with the tool.
      // Without this, pages that were already rendered before you
      // switched to "type" stay stuck at pointer-events: none forever,
      // which blocks editing, resizing, and moving existing text boxes.
      const textLayer = wrapper.querySelector(".page-text-layer");
      if (textLayer) {
        textLayer.style.pointerEvents = this.tool === "type" ? "auto" : "none";
      }
    });
  }

  // ====================================================
  // TEXT BOX SELECTION (item 7 — independent of edit focus,
  // so it survives clicking a toolbar button)
  // ====================================================

  selectTextBox(textBox) {
    this.deselectAllText(textBox);

    textBox.classList.add("selected");

    textBox._resizeHandle.style.display = "block";
    textBox._deleteBtn.style.display = "block";
  }

  deselectAllText(except = null) {
    this.container.querySelectorAll(".typed-text.selected").forEach((el) => {
      if (el === except) return;

      el.classList.remove("selected");

      if (document.activeElement === el) {
        el.blur();
      }

      if (el._resizeHandle) el._resizeHandle.style.display = "none";
      if (el._deleteBtn) el._deleteBtn.style.display = "none";
    });
  }

  deleteTextBox(textBox) {
    const page = textBox._page;
    const textData = textBox._textData;

    if (page && textData) {
      page.texts = page.texts.filter((item) => item.id !== textData.id);

      touch(page);
      touch(this.note);

      this.onChange?.();
    }

    textBox._resizeHandle?.remove();
    textBox._deleteBtn?.remove();
    textBox.remove();
  }

  bindGlobalKeyboard() {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;

      const selected = this.container.querySelector(".typed-text.selected");

      if (!selected) return;

      // If the box itself is the thing receiving keystrokes (actively
      // being edited), let Backspace/Delete behave normally — only
      // intercept when it's selected but not currently focused, i.e.
      // the user pressed Delete as a "remove this object" command.
      if (document.activeElement === selected) return;

      event.preventDefault();
      this.deleteTextBox(selected);
    });
  }

  // ====================================================
  // PAGE MANAGEMENT
  // ====================================================

  addPage({ focus = true } = {}) {
    const page = createPage(this.note.pages.length + 1);

    this.ensurePageData(page);

    this.note.pages.push(page);

    this.note.lastPageId = page.id;

    touch(this.note);

    this.renderAll();

    if (focus) {
      requestAnimationFrame(() => {
        this.container
          .querySelector(`[data-page-id="${page.id}"]`)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      });
    }

    this.onChange?.();

    return page;
  }

  deletePage(pageId) {
    if (this.note.pages.length <= 1) {
      alert("A notebook needs at least one page.");
      return false;
    }

    const index = this.note.pages.findIndex((page) => page.id === pageId);

    if (index === -1) return false;

    if (!confirm(`Delete Page ${index + 1}? This cannot be undone.`)) {
      return false;
    }

    const observer = this.pageObservers.get(pageId);

    observer?.disconnect();

    this.pageObservers.delete(pageId);

    this.pageControllers.get(pageId)?.destroy();

    this.pageControllers.delete(pageId);

    this.note.pages.splice(index, 1);

    this.note.pages.forEach((page, i) => {
      page.number = i + 1;
    });

    this.note.lastPageId = this.note.pages[Math.max(0, index - 1)].id;

    touch(this.note);

    this.renderAll();

    this.onChange?.();

    return true;
  }

  // ====================================================
  // HANDWRITING SELECTION (for Convert to Text)
  // ====================================================

  getSelectionState() {
    for (const [pageId, controller] of this.pageControllers) {
      if (controller.hasSelection()) {
        return { pageId, controller };
      }
    }

    return null;
  }

  exportCurrentSelection() {
    return this.getSelectionState()?.controller.exportSelection() || null;
  }

  clearCurrentSelection() {
    this.getSelectionState()?.controller.clearSelection();
  }

  insertConvertedText(text) {
    const state = this.getSelectionState();

    if (!state) return null;

    const { pageId, controller } = state;

    const page = this.note.pages.find((item) => item.id === pageId);

    if (!page) return null;

    const selection = controller.getSelection();

    const wrapper = this.container.querySelector(`[data-page-id="${pageId}"]`);

    const textLayer = wrapper?.querySelector(".page-text-layer");

    if (!textLayer) return null;

    // Place the new text box right where the handwriting was selected.
    const x = selection ? selection.x : 60;
    const y = selection ? selection.y : 60;

    return this.createTextBox(page, textLayer, x, y, text);
  }

  // ====================================================
  // UNDO / REDO
  // ====================================================

  undo() {
    const page = this.getActivePage();

    this.pageControllers.get(page?.id)?.undo();
  }

  redo() {
    const page = this.getActivePage();

    this.pageControllers.get(page?.id)?.redo();
  }

  getActivePage() {
    return (
      this.note.pages.find((page) => page.id === this.activePageId) ||
      this.note.pages[0]
    );
  }

  // ====================================================
  // POSITION
  // ====================================================

  savePosition() {
    this.note.scrollTop = this.viewport.scrollTop;

    if (this.activePageId) {
      this.note.lastPageId = this.activePageId;
    }

    touch(this.note);

    this.onChange?.(false);
  }

  restorePosition() {
    requestAnimationFrame(() => {
      if (Number.isFinite(this.note.scrollTop) && this.note.scrollTop > 0) {
        this.viewport.scrollTop = this.note.scrollTop;

        return;
      }

      if (this.note.lastPageId) {
        const page = this.container.querySelector(
          `[data-page-id="${this.note.lastPageId}"]`,
        );

        page?.scrollIntoView({
          block: "start",
        });
      }
    });
  }

  // ====================================================
  // IMAGE PASTE
  // ====================================================

  async pasteImage(event) {
    const image = await clipboardToImageRecord(
      event.clipboardData?.items || [],
    );

    if (!image) return false;

    const page = this.getActivePage();

    page.images.push(image);

    touch(page);
    touch(this.note);

    renderImageLayer(
      this.container.querySelector(`[data-page-id="${page.id}"]`),
      page,
      () => {
        touch(page);
        touch(this.note);
        this.onChange?.();
      },
    );

    this.onChange?.();

    return true;
  }

  // ====================================================
  // DESTROY
  // ====================================================

  destroy() {
    this.savePosition();

    this.pageObservers.forEach((observer) => observer.disconnect());

    this.pageObservers.clear();

    this.pageControllers.forEach((controller) => controller.destroy());

    this.pageControllers.clear();

    this.container.innerHTML = "";
  }
}
