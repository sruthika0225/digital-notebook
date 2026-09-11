// Handwriting recognition is intentionally parked for now.
// Tesseract.js did not meet the quality target for messy handwriting.
// Phase 4 will replace this with a better handwriting-capable AI provider.
//
// Keeping this file means app.js can stay stable when the AI feature returns.

export function handwritingStatus() {
  return {
    enabled: false,
    message: "Handwriting-to-text is parked for Phase 4."
  };
}
