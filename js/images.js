import { createId } from "./storage.js";

const BASE_WIDTH = 794;
const BASE_HEIGHT = 1123;

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getNaturalSize(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

export async function fileToImageRecord(file) {
  const src = await readAsDataURL(file);
  const natural = await getNaturalSize(src);
  const maxWidth = 360;
  const scale = Math.min(1, maxWidth / Math.max(1, natural.width));

  return {
    id: createId("img"),
    src,
    originalWidth: natural.width,
    originalHeight: natural.height,
    x: 55,
    y: 80,
    width: Math.max(80, natural.width * scale),
    height: Math.max(60, natural.height * scale),
    rotation: 0,
  };
}

export async function clipboardToImageRecord(clipboardItems) {
  for (const item of clipboardItems) {
    if (!item.type?.startsWith("image/")) continue;
    const file = item.getAsFile?.();
    if (file) return fileToImageRecord(file);
  }
  return null;
}

function positionElement(el, image) {
  el.style.left = `${(image.x / BASE_WIDTH) * 100}%`;
  el.style.top = `${(image.y / BASE_HEIGHT) * 100}%`;
  el.style.width = `${(image.width / BASE_WIDTH) * 100}%`;
  el.style.height = `${(image.height / BASE_HEIGHT) * 100}%`;
  el.style.transform = `rotate(${image.rotation || 0}deg)`;
}

export function renderImageLayer(wrapper, page, onChange) {
  wrapper.querySelector(".image-layer")?.remove();

  const layer = document.createElement("div");
  layer.className = "image-layer";
  Object.assign(layer.style, {
    position: "absolute",
    inset: "0",
    zIndex: "10",
    pointerEvents: "auto",
  });

  for (const image of page.images || []) {
    if (!image.originalWidth) {
      image.originalWidth = image.width;
    }

    if (!image.originalHeight) {
      image.originalHeight = image.height;
    }
    const item = document.createElement("div");
    item.className = "image-item";
    item.dataset.imageId = image.id;
    Object.assign(item.style, {
      position: "absolute",
      left: `${(image.x / BASE_WIDTH) * 100}%`,
      top: `${(image.y / BASE_HEIGHT) * 100}%`,
      width: `${(image.width / BASE_WIDTH) * 100}%`,
      height: `${(image.height / BASE_HEIGHT) * 100}%`,
      pointerEvents: "auto",
    });

    const img = document.createElement("img");
    img.className = "page-image";
    img.src = image.src;
    img.alt = "Inserted image";
    img.draggable = false;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.display = "block";
    img.style.transform = `rotate(${image.rotation || 0}deg)`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "image-delete";
    deleteBtn.textContent = "×";
    deleteBtn.title = "Delete image";
    deleteBtn.hidden = true;

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "image-resize";
    resizeHandle.hidden = true;

    const info = document.createElement("div");
    info.className = "image-tools";
    info.textContent = "Drag • resize";
    info.hidden = true;

    let selected = false;
    let drag = null;
    let resize = null;
    const aspect = Math.max(0.1, image.height / Math.max(1, image.width));

    const select = (value) => {
      selected = value;
      item.classList.toggle("selected", value);
      deleteBtn.hidden = !value;
      resizeHandle.hidden = !value;
      info.hidden = !value;
    };

    img.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      select(true);
      const rect = wrapper.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: image.x,
        y: image.y,
        scaleX: BASE_WIDTH / rect.width,
        scaleY: BASE_HEIGHT / rect.height,
      };
      img.setPointerCapture(event.pointerId);
    });

    img.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      image.x = Math.max(
        0,
        drag.x + (event.clientX - drag.startX) * drag.scaleX,
      );
      image.y = Math.max(
        0,
        drag.y + (event.clientY - drag.startY) * drag.scaleY,
      );
      positionElement(item, image);
    });

    img.addEventListener("pointerup", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag = null;
      onChange?.();
    });

    resizeHandle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = wrapper.getBoundingClientRect();
      resize = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: image.width,
        startHeight: image.height,
        scaleX: BASE_WIDTH / rect.width,
      };
      resizeHandle.setPointerCapture(event.pointerId);
    });

    resizeHandle.addEventListener("pointermove", (event) => {
      if (!resize || event.pointerId !== resize.pointerId) return;
      // Dragging the bottom-right handle right/down enlarges the image;
      // dragging left/up shrinks it.
      const deltaX = (event.clientX - resize.startX) * resize.scaleX;
      const newWidth = Math.max(70, resize.startWidth + deltaX);
      image.width = newWidth;
      image.height = newWidth * aspect;
      positionElement(item, image);
    });

    resizeHandle.addEventListener("pointerup", (event) => {
      if (!resize || event.pointerId !== resize.pointerId) return;
      resize = null;
      onChange?.();
    });

    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      page.images = page.images.filter((x) => x.id !== image.id);
      onChange?.();
      renderImageLayer(wrapper, page, onChange);
    });

    item.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      select(true);
    });

    item.append(img, deleteBtn, resizeHandle, info);
    layer.appendChild(item);
  }

  wrapper.appendChild(layer);

  wrapper.addEventListener(
    "pointerdown",
    (event) => {
      if (
        event.target === wrapper ||
        event.target.classList.contains("page-canvas")
      ) {
        layer.querySelectorAll(".image-item.selected").forEach((el) => {
          el.classList.remove("selected");
          el.querySelector(".image-delete").hidden = true;
          el.querySelector(".image-resize").hidden = true;
          el.querySelector(".image-tools").hidden = true;
        });
      }
    },
    { once: true },
  );
}

export function setupImageInput({ wrapper, page, onChange }) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.hidden = true;

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const image = await fileToImageRecord(file);
      page.images.push(image);
      onChange?.();
      renderImageLayer(wrapper, page, onChange);
    } catch (error) {
      console.error(error);
      alert("Could not insert the image.");
    }
    input.value = "";
  });

  wrapper.appendChild(input);
  return () => input.click();
}
