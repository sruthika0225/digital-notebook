/*
  images.js
  ---------
  Everything about objects that sit on top of the paper but below
  the ink: pasted/uploaded images, and typed/OCR-converted text boxes.
  Both are draggable and resizable using the same shared logic
  (makeDraggable / makeResizable), and both live inside #imagesLayer.
*/

const imageBtn = document.getElementById('imageBtn');
const imageLoader = document.getElementById('imageLoader');
const deleteImgBtn = document.getElementById('deleteImgBtn');
let selectedEl = null;
let selectedKind = null; // 'images' or 'texts'

imageBtn.addEventListener('click', () => imageLoader.click());

imageLoader.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => addImageToPage(evt.target.result);
  reader.readAsDataURL(file);
  imageLoader.value = '';
});

// Paste an image straight from the clipboard (Ctrl+V)
document.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (evt) => addImageToPage(evt.target.result);
      reader.readAsDataURL(blob);
    }
  }
});

function addImageToPage(src, obj) {
  // If obj is provided, we're restoring a saved image. Otherwise it's brand new.
  const isNew = !obj;
  const img = new Image();
  img.onload = () => {
    let data = obj;
    if (isNew) {
      const maxW = 400;
      const scale = Math.min(maxW / img.naturalWidth, 1);
      data = {
        src,
        x: (inkCanvas.width - img.naturalWidth * scale) / 2,
        y: 60,
        w: img.naturalWidth * scale,
        h: img.naturalHeight * scale
      };
      pages[currentPage].images.push(data);
      savePages();
      setMode('move'); // jump straight to move mode so it's obvious it can be repositioned
    }
    renderImageElement(data);
  };
  img.src = src;
}

function renderImageElement(data) {
  const el = document.createElement('div');
  el.className = 'img-obj';
  el.style.left = data.x + 'px';
  el.style.top = data.y + 'px';
  el.style.width = data.w + 'px';
  el.style.height = data.h + 'px';

  const imgTag = document.createElement('img');
  imgTag.src = data.src;
  el.appendChild(imgTag);

  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  el.appendChild(handle);

  imagesLayer.appendChild(el);
  makeDraggable(el, data);
  makeResizable(el, handle, data);

  el.addEventListener('pointerdown', () => selectObject(el, 'images'));
}

function selectObject(el, kind) {
  deselectAllImages();
  el.classList.add('selected');
  selectedEl = el;
  selectedKind = kind;
}

function deselectAllImages() {
  imagesLayer.querySelectorAll('.img-obj, .txt-obj').forEach(el => el.classList.remove('selected'));
  selectedEl = null;
  selectedKind = null;
}

function makeDraggable(el, data) {
  let sx = 0, sy = 0, startLeft = 0, startTop = 0, dragging = false;

  el.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    startLeft = data.x; startTop = data.y;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = inkCanvas.getBoundingClientRect();
    const scaleX = inkCanvas.width / rect.width;
    const scaleY = inkCanvas.height / rect.height;
    data.x = startLeft + (e.clientX - sx) * scaleX;
    data.y = startTop + (e.clientY - sy) * scaleY;
    el.style.left = data.x + 'px';
    el.style.top = data.y + 'px';
  });
  el.addEventListener('pointerup', () => {
    if (dragging) { dragging = false; savePages(); }
  });
}

function makeResizable(el, handle, data) {
  let sx = 0, sy = 0, startW = 0, startH = 0, resizing = false;

  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    resizing = true;
    sx = e.clientX; sy = e.clientY;
    startW = data.w; startH = data.h;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!resizing) return;
    const rect = inkCanvas.getBoundingClientRect();
    const scaleX = inkCanvas.width / rect.width;
    const scaleY = inkCanvas.height / rect.height;
    data.w = Math.max(30, startW + (e.clientX - sx) * scaleX);
    data.h = Math.max(30, startH + (e.clientY - sy) * scaleY);
    el.style.width = data.w + 'px';
    el.style.height = data.h + 'px';
  });
  handle.addEventListener('pointerup', () => {
    if (resizing) { resizing = false; savePages(); }
  });
}

deleteImgBtn.addEventListener('click', () => {
  if (!selectedEl) { alert('Switch to Move mode and tap an image or text box to select it first.'); return; }
  const list = pages[currentPage][selectedKind];
  const idx = Array.from(imagesLayer.querySelectorAll(selectedKind === 'images' ? '.img-obj' : '.txt-obj')).indexOf(selectedEl);
  list.splice(idx, 1);
  selectedEl.remove();
  selectedEl = null;
  selectedKind = null;
  savePages();
});

// ---------- Text objects (typed, or inserted from OCR) ----------
function addTextToPage(text, obj) {
  const isNew = !obj;
  const data = obj || {
    text,
    x: 60,
    y: 60,
    w: 260,
    h: 60,
    fontSize: 18
  };
  if (isNew) {
    pages[currentPage].texts.push(data);
    savePages();
    setMode('move');
  }
  renderTextElement(data);
}

function renderTextElement(data) {
  const el = document.createElement('div');
  el.className = 'txt-obj';
  el.style.left = data.x + 'px';
  el.style.top = data.y + 'px';
  el.style.width = data.w + 'px';
  el.style.height = data.h + 'px';
  el.style.fontSize = (data.fontSize || 18) + 'px';
  el.textContent = data.text;

  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  el.appendChild(handle);

  imagesLayer.appendChild(el);
  makeDraggable(el, data);
  makeResizable(el, handle, data);

  el.addEventListener('pointerdown', (e) => {
    if (e.target === handle) return;
    selectObject(el, 'texts');
  });

  // Double-click / double-tap to edit the text in place
  el.addEventListener('dblclick', () => {
    el.contentEditable = 'true';
    el.focus();
  });
  el.addEventListener('blur', () => {
    el.contentEditable = 'false';
    data.text = el.childNodes[0] ? el.childNodes[0].textContent : el.textContent;
    el.textContent = data.text;
    el.appendChild(handle);
    savePages();
  });
}

document.getElementById('addTextBtn').addEventListener('click', () => {
  addTextToPage('Type here…');
});
