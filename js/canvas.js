/*
  canvas.js
  ---------
  The ink layer: drawing with pen/eraser, and the mode switch
  (pen / eraser / move) that decides whether taps go to the ink
  canvas or to the images/text layer above it.
*/

const inkCanvas = document.getElementById('inkCanvas');
const ctx = inkCanvas.getContext('2d');
const imagesLayer = document.getElementById('imagesLayer');

// ---------- Mode: pen / eraser / move ----------
let mode = 'pen';
let penColor = document.getElementById('colorPicker').value;
let penSize = parseInt(document.getElementById('sizeSlider').value, 10);

const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const moveBtn = document.getElementById('moveBtn');

function setMode(newMode) {
  mode = newMode;
  [penBtn, eraserBtn, moveBtn].forEach(b => b.classList.remove('active'));
  if (mode === 'pen') penBtn.classList.add('active');
  if (mode === 'eraser') eraserBtn.classList.add('active');
  if (mode === 'move') moveBtn.classList.add('active');

  // In Move mode, hand control over to the images/text layer.
  // In Pen/Eraser mode, hand control back to the ink canvas.
  if (mode === 'move') {
    imagesLayer.style.pointerEvents = 'auto';
    inkCanvas.style.pointerEvents = 'none';
  } else {
    imagesLayer.style.pointerEvents = 'none';
    inkCanvas.style.pointerEvents = 'auto';
    deselectAllImages();
  }
}

penBtn.addEventListener('click', () => setMode('pen'));
eraserBtn.addEventListener('click', () => setMode('eraser'));
moveBtn.addEventListener('click', () => setMode('move'));

document.getElementById('colorPicker').addEventListener('input', e => penColor = e.target.value);
document.getElementById('sizeSlider').addEventListener('input', e => penSize = parseInt(e.target.value, 10));

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Clear this page (ink and images)? This cannot be undone.')) {
    ctx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
    pages[currentPage].images = [];
    pages[currentPage].texts = [];
    imagesLayer.innerHTML = '';
    persistCurrentPage();
  }
});

// ---------- Drawing ----------
let drawing = false;
let lastX = 0, lastY = 0;

function getPos(e) {
  const rect = inkCanvas.getBoundingClientRect();
  const scaleX = inkCanvas.width / rect.width;
  const scaleY = inkCanvas.height / rect.height;
  const point = e.touches ? e.touches[0] : e;
  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY
  };
}

function startDraw(e) {
  if (mode === 'move') return;
  e.preventDefault();
  drawing = true;
  const pos = getPos(e);
  lastX = pos.x; lastY = pos.y;
}

function draw(e) {
  if (!drawing || mode === 'move') return;
  e.preventDefault();
  const pos = getPos(e);
  ctx.strokeStyle = mode === 'eraser' ? '#FAF6EC' : penColor;
  ctx.lineWidth = mode === 'eraser' ? penSize * 4 : penSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  lastX = pos.x; lastY = pos.y;
}

function endDraw() {
  if (!drawing) return;
  drawing = false;
  persistCurrentPage(); // defined in pages.js
}

inkCanvas.addEventListener('pointerdown', startDraw);
inkCanvas.addEventListener('pointermove', draw);
inkCanvas.addEventListener('pointerup', endDraw);
inkCanvas.addEventListener('pointerleave', endDraw);
