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
  }

  setTool(tool) {
    this.tool = tool;

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

    // Make older text objects compatible with resizing.
    page.texts.forEach((text) => {
      if (!Number.isFinite(text.width)) {
        text.width = 260;
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

  createTextBox(page, textLayer, x, y) {
    this.ensurePageData(page);

    const textData = {
      id: `text_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      x: Math.max(10, Math.min(BASE_WIDTH - 160, x)),
      y: Math.max(45, Math.min(BASE_HEIGHT - 60, y)),
      text: "",
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

    textBox.addEventListener("focus", () => {
      textBox.style.border = "1px dashed #aaa";
      textBox.style.background = "rgba(255,255,255,.45)";
    });

    // --------------------------------------------------
    // BLUR / SAVE TEXT
    // --------------------------------------------------

    textBox.addEventListener("blur", () => {
      textBox.style.border = "1px solid transparent";

      textBox.style.background = "transparent";

      textData.text = textBox.textContent || "";

      // Remove completely empty boxes.
      if (!textData.text.trim()) {
        page.texts = page.texts.filter((item) => item.id !== textData.id);

        textBox.remove();

        resizeHandle.remove();
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

      event.preventDefault();
      event.stopPropagation();

      const wrapper = textBox.closest(".page-wrapper");

      if (!wrapper) return;

      const wrapperRect = wrapper.getBoundingClientRect();

      const startX = event.clientX;
      const startY = event.clientY;

      const startLeft = textData.x;
      const startTop = textData.y;

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;

        const dy = moveEvent.clientY - startY;

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

        // Keep resize handle attached.
        resizeHandle.style.left = `${textData.x + textData.width - 6}px`;

        resizeHandle.style.top = `${textData.y + textBox.offsetHeight - 6}px`;
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
    // SHOW HANDLE WHEN TEXT IS SELECTED
    // --------------------------------------------------

    textBox.addEventListener("focus", () => {
      resizeHandle.style.display = "block";

      positionResizeHandle();
    });

    textBox.addEventListener("blur", () => {
      resizeHandle.style.display = "none";
    });

    function positionResizeHandle() {
      resizeHandle.style.left = `${textData.x + textData.width - 6}px`;

      resizeHandle.style.top = `${textData.y + textBox.offsetHeight - 6}px`;
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
