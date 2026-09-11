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

    // New data structure for typed text.
    if (!Array.isArray(page.texts)) {
      page.texts = [];
    }
  }

  renderPage(page, index) {
    this.ensurePageData(page);

    const wrapper = document.createElement("article");
    wrapper.className = "page-wrapper";
    wrapper.dataset.pageId = page.id;

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
    // CANVAS
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

  renderTextLayer(wrapper, textLayer, page) {
    textLayer.innerHTML = "";

    for (const text of page.texts) {
      this.createTextElement(page, textLayer, text);
    }
  }

  createTextElement(page, textLayer, textData) {
    const textBox = document.createElement("div");

    textBox.className = "typed-text";

    textBox.contentEditable = "true";
    textBox.spellcheck = true;

    textBox.textContent = textData.text || "";

    Object.assign(textBox.style, {
      position: "absolute",
      left: `${textData.x}px`,
      top: `${textData.y}px`,
      minWidth: "120px",
      maxWidth: "650px",
      minHeight: "32px",
      padding: "4px 6px",
      fontSize: `${textData.fontSize || 22}px`,
      lineHeight: "1.35",
      color: textData.color || "#222222",
      background: "transparent",
      border: "1px solid transparent",
      outline: "none",
      zIndex: "20",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    });

    // Show a border while editing.
    textBox.addEventListener("focus", () => {
      textBox.style.border = "1px dashed #aaa";
      textBox.style.background = "rgba(255,255,255,.45)";
    });

    textBox.addEventListener("blur", () => {
      textBox.style.border = "1px solid transparent";
      textBox.style.background = "transparent";

      textData.text = textBox.textContent || "";

      // Remove completely empty boxes.
      if (!textData.text.trim()) {
        page.texts = page.texts.filter((item) => item.id !== textData.id);

        textBox.remove();
      }

      touch(page);
      touch(this.note);
      this.onChange?.();
    });

    textBox.addEventListener("input", () => {
      textData.text = textBox.textContent || "";

      touch(page);
      touch(this.note);

      this.onChange?.(true);
    });

    // Prevent notebook click handler from creating another box.
    textBox.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    // Allow normal typing shortcuts.
    textBox.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        textBox.blur();
      }
    });

    textLayer.appendChild(textBox);

    return textBox;
  }

  createTextBox(page, textLayer, x, y) {
    const textData = {
      id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,

      x: Math.max(10, x),
      y: Math.max(45, y),

      text: "",

      fontSize: 22,

      color: "#222222",
    };

    page.texts.push(textData);

    const textBox = this.createTextElement(page, textLayer, textData);

    touch(page);
    touch(this.note);
    this.onChange?.();

    requestAnimationFrame(() => {
      textBox.focus();

      // Put cursor inside the text box.
      const selection = window.getSelection();
      const range = document.createRange();

      range.selectNodeContents(textBox);
      range.collapse(false);

      selection.removeAllRanges();
      selection.addRange(range);
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
