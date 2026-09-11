import { PageCanvas } from "./canvas.js";
import { renderImageLayer, setupImageInput, clipboardToImageRecord } from "./images.js";
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
    this.activePageId = null;
    this.tool = "draw";
    this.size = 3;
    this.color = "#222222";
    this.renderAll();
  }

  setTool(tool) {
    this.tool = tool;
    this.pageControllers.forEach(controller => controller.setTool(tool));
    this.setImageMode(tool === "adjust" ? "adjust" : "write");
  }

  setImageMode(mode) {
    this.container.querySelectorAll(".page-wrapper").forEach(wrapper => {
      wrapper.classList.toggle("adjust-mode", mode === "adjust");
      wrapper.classList.toggle("write-mode", mode !== "adjust");
    });
  }

  setSize(size) {
    this.size = Number(size);
    this.pageControllers.forEach(controller => controller.setSize(this.size));
  }

  setColor(color) {
    this.color = color;
    this.tool = "draw";
    this.pageControllers.forEach(controller => {
      controller.setColor(color);
      controller.setTool("draw");
    });
  }

  renderAll() {
    this.pageControllers.forEach(controller => controller.destroy());
    this.pageControllers.clear();
    this.container.innerHTML = "";

    this.note.pages.forEach((page, index) => this.renderPage(page, index));
    this.restorePosition();
  }

  renderPage(page, index) {
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
    deleteBtn.addEventListener("click", event => {
      event.stopPropagation();
      this.deletePage(page.id);
    });

    pageControls.append(label, deleteBtn);

    const canvas = document.createElement("canvas");
    canvas.className = "page-canvas";
    canvas.width = BASE_WIDTH;
    canvas.height = BASE_HEIGHT;

    wrapper.append(pageControls, canvas);
    this.container.appendChild(wrapper);

    const controller = new PageCanvas(canvas, page, () => {
      touch(page);
      touch(this.note);
      this.onChange?.();
    });

    controller.setTool(this.tool);
    controller.setSize(this.size);
    controller.setColor(this.color);
    this.pageControllers.set(page.id, controller);

    const openFile = setupImageInput({
      wrapper,
      page,
      onChange: () => {
        touch(page);
        touch(this.note);
        this.onChange?.();
      }
    });

    const imageButton = document.createElement("button");
    imageButton.className = "image-insert-btn";
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
      cursor: "pointer"
    });
    imageButton.addEventListener("click", openFile);
    wrapper.appendChild(imageButton);

    renderImageLayer(wrapper, page, () => {
      touch(page);
      touch(this.note);
      this.onChange?.();
    });
    wrapper.classList.toggle("adjust-mode", this.tool === "adjust");
    wrapper.classList.toggle("write-mode", this.tool !== "adjust");

    // Render page index while scrolling.
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
          this.activePageId = page.id;
          this.note.lastPageId = page.id;
          this.onChange?.(false);
        }
      }
    }, { root: this.viewport, threshold: [0.35, 0.6] });

    observer.observe(wrapper);

    wrapper.addEventListener("pointerdown", () => {
      this.activePageId = page.id;
      this.note.lastPageId = page.id;
    });
  }

  addPage({ focus = true } = {}) {
    const page = createPage(this.note.pages.length + 1);
    this.note.pages.push(page);
    this.note.lastPageId = page.id;
    touch(this.note);
    this.renderAll();

    if (focus) {
      requestAnimationFrame(() => {
        this.container.querySelector(`[data-page-id="${page.id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
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

    const index = this.note.pages.findIndex(p => p.id === pageId);
    if (index === -1) return false;

    if (!confirm(`Delete Page ${index + 1}? This cannot be undone.`)) return false;

    this.note.pages.splice(index, 1);
    this.note.pages.forEach((page, i) => page.number = i + 1);
    this.note.lastPageId = this.note.pages[Math.max(0, index - 1)].id;
    touch(this.note);
    this.renderAll();
    this.onChange?.();
    return true;
  }

  undo() {
    const page = this.getActivePage();
    this.pageControllers.get(page?.id)?.undo();
  }

  redo() {
    const page = this.getActivePage();
    this.pageControllers.get(page?.id)?.redo();
  }

  getActivePage() {
    return this.note.pages.find(p => p.id === this.activePageId) || this.note.pages[0];
  }

  savePosition() {
    this.note.scrollTop = this.viewport.scrollTop;
    if (this.activePageId) this.note.lastPageId = this.activePageId;
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
        const page = this.container.querySelector(`[data-page-id="${this.note.lastPageId}"]`);
        page?.scrollIntoView({ block: "start" });
      }
    });
  }

  async pasteImage(event) {
    const image = await clipboardToImageRecord(event.clipboardData?.items || []);
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
      }
    );
    this.onChange?.();
    return true;
  }

  destroy() {
    this.savePosition();
    this.pageControllers.forEach(controller => controller.destroy());
    this.pageControllers.clear();
    this.container.innerHTML = "";
  }
}
