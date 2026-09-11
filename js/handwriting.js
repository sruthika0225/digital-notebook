/*
 * Handwriting AI
 *
 * Phase 4
 *
 * Conversion is optional and only happens
 * when the user explicitly requests it.
 */

let provider = null;

export function setHandwritingProvider(newProvider) {
  provider = newProvider;
}

export function handwritingStatus() {
  return {
    enabled: typeof provider === "function",
    message:
      typeof provider === "function"
        ? "Handwriting AI is ready."
        : "Handwriting AI provider is not configured yet."
  };
}

export async function convertHandwriting(imageData) {
  if (!imageData) {
    throw new Error("No handwriting was selected.");
  }

  if (typeof provider !== "function") {
    throw new Error("Handwriting AI is not connected yet.");
  }

  try {
    const text = await provider(imageData);

    if (typeof text !== "string") {
      throw new Error("The handwriting provider returned an invalid response.");
    }

    return text.trim();
  } catch (error) {
    console.error("Handwriting conversion failed:", error);
    throw new Error("Could not convert the handwriting. Please try again.");
  }
}
