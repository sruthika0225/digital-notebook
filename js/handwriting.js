/*
  handwriting.js
  --------------
  Handwriting-to-text using Tesseract.js (free, runs entirely in the
  browser, no API key or backend needed). Only the ink layer is
  scanned — pasted images are deliberately ignored, since we only
  want to recognize actual handwriting.

  Later (Phase 4 upgrade), this file is where a cloud AI vision
  provider could be swapped in for better accuracy on messy
  handwriting, without touching any other file.
*/

const ocrBtn = document.getElementById('ocrBtn');
const ocrProgress = document.getElementById('ocrProgress');
const ocrProgressLabel = document.getElementById('ocrProgressLabel');
const ocrModal = document.getElementById('ocrModal');
const ocrResultText = document.getElementById('ocrResultText');

ocrBtn.addEventListener('click', async () => {
  ocrProgress.classList.remove('hidden');
  ocrProgressLabel.textContent = 'Reading your handwriting…';
  try {
    const inkImage = inkCanvas.toDataURL('image/png');

    const { data } = await Tesseract.recognize(inkImage, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          ocrProgressLabel.textContent = `Reading your handwriting… ${Math.round(m.progress * 100)}%`;
        }
      }
    });

    ocrProgress.classList.add('hidden');
    ocrResultText.value = (data.text || '').trim() || '(No text recognized — try writing a bit larger or clearer.)';
    ocrModal.classList.remove('hidden');
  } catch (err) {
    ocrProgress.classList.add('hidden');
    alert('Something went wrong reading the handwriting. Try again.');
    console.error(err);
  }
});

document.getElementById('ocrCancelBtn').addEventListener('click', () => {
  ocrModal.classList.add('hidden');
});

document.getElementById('ocrCopyBtn').addEventListener('click', () => {
  ocrResultText.select();
  document.execCommand('copy');
});

document.getElementById('ocrInsertBtn').addEventListener('click', () => {
  const text = ocrResultText.value.trim();
  if (text) addTextToPage(text);
  ocrModal.classList.add('hidden');
});
