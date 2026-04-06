import { state } from "./state.js";

let pollTimer = null;

/**
 * Initializes the WhatsApp Connection Center
 */
export function initWhatsAppHub() {
  renderHub();
  startPolling();

  // If we already have a session, trigger init on server just in case it's dormant
  fetch("/api/whatsapp/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: state.sessionId }),
  }).catch(() => {});
}

/**
 * Renders the status pill in the header
 */
export function renderHub() {
  const container = document.getElementById("whatsapp-hub-container");
  if (!container) return;

  const s = state.whatsappStatus;

  let badgeHTML = "";
  if (s === "ready") {
    badgeHTML = `
      <div class="whatsapp-badge online" id="wa-hub-open">
        <i class="fa-brands fa-whatsapp"></i> WhatsApp Online
      </div>
    `;
  } else if (s === "qr" || s === "initializing" || s === "authenticated") {
    badgeHTML = `
      <div class="whatsapp-badge loading" id="wa-hub-open">
        <i class="fa-solid fa-spinner"></i> Connecting...
      </div>
    `;
  } else {
    badgeHTML = `
      <div class="whatsapp-badge offline" id="wa-hub-open">
        <i class="fa-brands fa-whatsapp"></i> Connect WhatsApp
      </div>
    `;
  }

  container.innerHTML = badgeHTML;
  document.getElementById("wa-hub-open")?.addEventListener("click", openModal);

  // Update contextual status if on Step 3 or Step 4
  const inlineStatus = document.getElementById("wa-batch-status-inline");
  if (inlineStatus) {
    if (s === "ready") {
      inlineStatus.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#25D366;"></i> WhatsApp Ready`;
    } else if (s === "qr" || s === "initializing") {
      inlineStatus.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Engine Starting...`;
    } else {
      inlineStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);"></i> WhatsApp Disconnected`;
    }
  }
}

/**
 * Opens the QR Code / Connection Modal
 */
function openModal() {
  let modal = document.getElementById("wa-modal-overlay");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "wa-modal-overlay";
    modal.className = "wa-modal-overlay";
    document.body.appendChild(modal);
  }

  renderModalContent();
  modal.classList.add("active");

  // Ensure server starts the engine for this session
  fetch("/api/whatsapp/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: state.sessionId }),
  }).catch(() => {});
}

function closeModal() {
  document.getElementById("wa-modal-overlay")?.classList.remove("active");
}

/**
 * Renders the modal interior based on live status
 */
function renderModalContent() {
  const modal = document.getElementById("wa-modal-overlay");
  if (!modal) return;

  const s = state.whatsappStatus;
  const qr = state.whatsappQR;

  modal.innerHTML = `
    <div class="wa-modal">
      <div class="wa-modal-header">
        <div class="flex items-center gap-md">
          <i class="fa-brands fa-whatsapp" style="font-size:1.5rem; color:#25D366;"></i>
          <h2 style="font-size:1.1rem; margin:0;">WhatsApp Automation Center</h2>
        </div>
        <button class="btn btn-sm btn-secondary" id="wa-modal-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="wa-modal-body">
        ${
          s === "ready"
            ? `
          <div style="color:#25D366; font-size:3rem; margin-bottom:1rem;"><i class="fa-solid fa-circle-check"></i></div>
          <h3 style="margin-bottom:0.5rem;">Device Linked!</h3>
          <p class="text-muted">Your private WhatsApp bridge is active. You can now send invitations automatically from the guest list.</p>
          <button class="btn btn-danger btn-sm mt-lg" id="wa-logout-btn">Disconnect Device</button>
        `
            : s === "qr"
              ? `
          <div class="wa-qr-container">
            <img src="${qr}" alt="WhatsApp QR Code" />
          </div>
          <h3 style="margin-bottom:0.5rem;">Scan to Connect</h3>
          <p class="text-muted" style="font-size:0.9rem;">Open WhatsApp on your phone and scan this code to link your device.</p>
          <p class="text-accent mt-sm" style="font-size:0.8rem;"><i class="fa-solid fa-shield-halved"></i> Only you have access to your session data.</p>
        `
              : `
          <div class="wa-qr-container">
            <div class="wa-qr-loading">
              <i class="fa-solid fa-spinner animate-spin" style="font-size:2.5rem; color:#25D366;"></i>
              <span style="font-weight:600; margin-top:1rem;">Starting Engine...</span>
            </div>
          </div>
          <p class="text-muted">Preparing a secure sandbox for your device. This takes about 10-20 seconds...</p>
        `
        }
      </div>
    </div>
  `;

  document
    .getElementById("wa-modal-close")
    ?.addEventListener("click", closeModal);
  document
    .getElementById("wa-logout-btn")
    ?.addEventListener("click", handleLogout);
}

async function handleLogout() {
  if (!confirm("Disconnect your WhatsApp session?")) return;

  state.whatsappStatus = "not_started";
  state.whatsappQR = null;
  renderHub();
  renderModalContent();

  await fetch("/api/whatsapp/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: state.sessionId }),
  });
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const resp = await fetch(
        `/api/whatsapp/status?sessionId=${state.sessionId}`,
      );
      if (!resp.ok) return;

      const data = await resp.json();

      if (
        data.status !== state.whatsappStatus ||
        data.qr !== state.whatsappQR
      ) {
        state.whatsappStatus = data.status;
        state.whatsappQR = data.qr;
        renderHub();
        // If modal is active, re-render its content
        if (
          document
            .getElementById("wa-modal-overlay")
            ?.classList.contains("active")
        ) {
          renderModalContent();
        }
      }
    } catch (e) {
      // Bridge is likely down
      if (state.whatsappStatus !== "not_started") {
        state.whatsappStatus = "not_started";
        renderHub();
      }
    }
  }, 2500);
}
