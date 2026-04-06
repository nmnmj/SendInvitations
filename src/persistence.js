/**
 * persistence.js — LocalStorage save/restore for session continuity
 *
 * Stores: pdfSettings, placeholders, csvData, currentStep
 * Images: stored as base64 data URLs (may be large — warns if quota exceeded)
 *
 * Images lose their original `File` object reference across sessions,
 * so we reconstruct a lightweight proxy from the saved URL + metadata.
 */

const STORAGE_KEY = "invitecraft_session_v1";
const MAX_IMAGES_STORED = 20; // safety cap

/**
 * Serialize state to localStorage.
 * Called on every state change.
 */
export function saveState(state) {
  try {
    const serializable = {
      currentStep: state.currentStep,
      pdfSettings: { ...state.pdfSettings },
      placeholders: state.placeholders.map((p) => ({ ...p })),
      csvData: {
        rows: state.csvData.rows,
        headers: state.csvData.headers,
        blankCount: state.csvData.blankCount,
      },
      // Store images as {id, url, name, width, height} — no File object
      images: state.images.slice(0, MAX_IMAGES_STORED).map((img) => ({
        id: img.id,
        url: img.url,
        name: img.name,
        width: img.width,
        height: img.height,
      })),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (err) {
    if (err.name === "QuotaExceededError") {
      console.warn(
        "[InviteCraft] localStorage quota exceeded — images may be too large. Try fewer/smaller images.",
      );
    } else {
      console.warn("[InviteCraft] Failed to save session:", err);
    }
  }
}

/**
 * Restore state from localStorage.
 * Returns true if session was restored, false if nothing found.
 */
export function loadState(state) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const saved = JSON.parse(raw);

    // Restore simple fields
    if (saved.pdfSettings) {
      Object.assign(state.pdfSettings, saved.pdfSettings);
    }
    if (Array.isArray(saved.placeholders)) {
      state.placeholders = saved.placeholders;
    }
    if (saved.csvData) {
      Object.assign(state.csvData, saved.csvData);
    }
    if (typeof saved.currentStep === "number") {
      state.currentStep = saved.currentStep;
    }

    // Restore images — reconstruct from saved URL/metadata
    if (Array.isArray(saved.images) && saved.images.length > 0) {
      state.images = saved.images.map((img) => ({
        id: img.id,
        file: null, // File object gone, but url is enough for PDF generation
        url: img.url,
        name: img.name,
        width: img.width,
        height: img.height,
      }));
    }

    return true;
  } catch (err) {
    console.warn("[InviteCraft] Failed to restore session:", err);
    return false;
  }
}

/**
 * Clear saved session from localStorage.
 */
export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Return true if there is a saved session available.
 */
export function hasSession() {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}
