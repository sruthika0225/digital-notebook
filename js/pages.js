/*
  pages.js
  --------
  Multi-page notebook behavior: rendering the current page (ink +
  images + text), saving a snapshot after every stroke, and
  navigating between pages while always remembering the last one.
*/

const pageLabel = document.getElementById('pageLabel');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const addBtn = document.getElementById('addBtn');

function persistCurrentPage() {
  pages[currentPage].ink = inkCanvas.toDataURL('image/png');
  savePages();
}

function renderPage(index) {
  ctx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
  imagesLayer.innerHTML = '';

  const page = pages[index];
  if (page.ink) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = page.ink;
  }
  page.images.forEach(data => renderImageElement(data));
  page.texts.forEach(data => renderTextElement(data));

  pageLabel.textContent = `Page ${index + 1} of ${pages.length}`;
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === pages.length - 1;
}

function goToPage(index) {
  currentPage = index;
  saveCurrentPage();
  renderPage(currentPage);
}

prevBtn.addEventListener('click', () => { if (currentPage > 0) goToPage(currentPage - 1); });
nextBtn.addEventListener('click', () => { if (currentPage < pages.length - 1) goToPage(currentPage + 1); });
addBtn.addEventListener('click', () => {
  pages.push({ ink: null, images: [], texts: [] });
  savePages();
  goToPage(pages.length - 1);
});
