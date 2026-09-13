/*
 * handwriting-provider.js
 *
 * Connects handwriting.js to Google Cloud Vision's handwriting
 * recognition. This is the only piece that was missing — canvas.js
 * (selection + exportSelection) and handwriting.js (the provider
 * pattern + error handling) were already built and ready.
 *
 * Setup:
 *   1. Get a free Google Cloud Vision API key (steps below).
 *   2. Paste it into GOOGLE_VISION_API_KEY.
 *   3. Import this file once, near your other imports in app.js:
 *        import "./handwriting-provider.js";
 *      That's it — handwriting.js will automatically use it.
 */

import { setHandwritingProvider } from "./handwriting.js";
import { GOOGLE_VISION_API_KEY } from "./config.js";

async function googleVisionProvider(imageData) {
  if (
    !GOOGLE_VISION_API_KEY ||
    GOOGLE_VISION_API_KEY === "PASTE_YOUR_OWN_API_KEY_HERE"
  ) {
    throw new Error(
      "Google Vision API key not set yet — copy config.example.js to config.js and add your key.",
    );
  }

  // imageData comes in as "data:image/png;base64,AAAA..." — Vision
  // wants just the base64 part, without the prefix.
  const base64 = imageData.split(",")[1];

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            // DOCUMENT_TEXT_DETECTION is Vision's mode tuned for
            // dense/handwritten text, as opposed to TEXT_DETECTION
            // which is tuned for short signage-style text.
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    },
  );

  // Google returns a JSON body even on error responses (400, 403, etc.)
  // with the real reason inside — read it either way instead of only
  // checking response.ok, so we don't lose that detail.
  const data = await response.json().catch(() => null);

  const topLevelError = data?.error;
  const perResponseError = data?.responses?.[0]?.error;

  if (!response.ok || topLevelError || perResponseError) {
    const message =
      perResponseError?.message ||
      topLevelError?.message ||
      `Google Vision API error (status ${response.status}).`;

    throw new Error(message);
  }

  const text = data?.responses?.[0]?.fullTextAnnotation?.text;

  if (!text || !text.trim()) {
    throw new Error("No handwriting was recognized in that selection.");
  }

  return text;
}

setHandwritingProvider(googleVisionProvider);
