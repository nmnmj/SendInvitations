/**
 * Shared application state + auto-persistence via localStorage
 */
import { saveState, loadState } from "./persistence.js";

export const state = {
  // Unique device/browser ID for WhatsApp multi-session
  sessionId:
    localStorage.getItem("invitex_session_id") ||
    Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15),
  whatsappStatus: "not_started", // not_started, initializing, qr, ready, failed
  whatsappQR: null,
  currentStep: 0,
  images: [], // { id, file, url, name, width, height }
  pdfSettings: {
    pageSize: "A4",
    customWidth: 210,
    customHeight: 297,
    orientation: "auto", // auto, portrait, landscape
    scaling: "fit", // fit, fill, stretch
  },
  placeholders: [], // { id, key, fontFamily, fontSize, color, alignment, pages, x, y }
  csvData: {
    rows: [], // array of objects keyed by column header
    headers: [], // column header strings
    phoneHeader: null, // explicit phone number column name
    whatsappMessageTemplate: "Hello {{Name}}, here is your invitation!", // Customizable message
    blankCount: 0,
    hindiMode: false,
  },
  whatsappPairingCode: null,
  whatsappPhone: "",
  guidanceEnabled:
    localStorage.getItem("invitecraft_guidance_enabled") !== "false",
};

// Ensure session ID is preserved
localStorage.setItem("invitex_session_id", state.sessionId);

export function getPageDimensions() {
  const s = state.pdfSettings;
  const sizes = {
    A4: { w: 595.28, h: 841.89 },
    Letter: { w: 612, h: 792 },
    Custom: { w: s.customWidth * 2.835, h: s.customHeight * 2.835 },
  };
  return sizes[s.pageSize] || sizes.A4;
}

/**
 * Attempt to restore previous session from localStorage.
 * Returns true if data was found and loaded.
 */
export function restoreSession() {
  return loadState(state);
}

let listeners = [];
export function onChange(fn) {
  listeners.push(fn);
}

/**
 * Notify all listeners and auto-save state to localStorage.
 */
export function notify() {
  listeners.forEach((fn) => fn());
  clearTimeout(notify._saveTimer);
  notify._saveTimer = setTimeout(() => saveState(state), 400);
}
notify._saveTimer = null;
