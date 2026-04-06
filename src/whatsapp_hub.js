import { state } from "./state.js";
import { showConfirm } from "./modal.js";

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
        <i class="fa-brands fa-whatsapp"></i> <span>WhatsApp Online</span>
      </div>
    `;
  } else if (s === "qr" || s === "initializing" || s === "authenticated") {
    badgeHTML = `
      <div class="whatsapp-badge loading" id="wa-hub-open">
        <i class="fa-solid fa-spinner"></i> <span>Connecting...</span>
      </div>
    `;
  } else {
    badgeHTML = `
      <div class="whatsapp-badge offline" id="wa-hub-open">
        <i class="fa-brands fa-whatsapp"></i> <span>Connect WhatsApp</span>
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
            : s === "qr" || s === "initializing"
              ? `
          <div class="wa-qr-container">
            ${
              qr
                ? `<img src="${qr}" alt="WhatsApp QR Code" />`
                : `
              <div class="wa-qr-loading">
                <i class="fa-solid fa-spinner animate-spin" style="font-size:2.5rem; color:#25D366;"></i>
                <span style="font-weight:600; margin-top:1rem;">Starting Engine...</span>
              </div>`
            }
          </div>
          
          <div id="wa-pairing-section">
             ${
               state.whatsappPairingCode
                 ? `
               <div style="padding: 1.5rem; background: var(--bg-highlight); border: 2px dashed #25D366; border-radius: 12px; margin: 1rem 0;">
                  <p style="font-size: 0.8rem; margin-bottom: 0.5rem; font-weight: 600; color: #25D366;">YOUR PAIRING CODE:</p>
                  <div style="font-size: 2.2rem; font-family: monospace; letter-spacing: 4px; font-weight: 800; color: var(--text-primary);">${state.whatsappPairingCode}</div>
                  <p style="font-size: 0.75rem; margin-top: 1rem; color: var(--text-muted);">Open WhatsApp -> Linked Devices -> Link with Phone Number and enter this code.</p>
               </div>
               <button class="btn btn-sm btn-outline mt-sm" onclick="this.parentElement.innerHTML = document.getElementById('pairing-input-tpl').innerHTML">Back to QR</button>
             `
                 : `
               <div id="pairing-input-tpl" style="display:none;">
                   <h3 style="margin-top: 1.2rem; margin-bottom:0.6rem; font-weight:700; font-size:1.1rem; color:var(--text-primary);">Link with Phone Number</h3>
                   <p class="text-muted" style="font-size:0.85rem; line-height:1.4; margin-bottom:1rem;">If scanning isn't possible, use your number to receive a pairing code.</p>
                   
                   <div style="border-top: 1px solid rgba(108, 99, 255, 0.15); margin: 1.5rem 0; position: relative;">
                     <span style="position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: var(--bg-card); padding: 2px 12px; font-size: 0.65rem; color: var(--accent-primary-light); font-weight: 800; letter-spacing:1.5px; white-space:nowrap; border: 1px solid rgba(108,99,255,0.2); border-radius:10px;">OR USE PHONE LINK</span>
                   </div>

                   <div class="flex gap-sm" style="margin-top:0.5rem; display:flex; gap:8px;">
                     <input type="text" id="wa-phone-input" placeholder="e.g. 917012345678" class="form-input" style="flex:1; background:var(--bg-primary); border-color:rgba(108,99,255,0.3); font-weight:600; color:var(--text-primary); border-radius:10px; padding: 12px;">
                     <button class="btn" id="wa-get-pairing-btn" style="background:#25D366; color:white; border:none; padding: 0 20px; border-radius:10px; font-weight:700; white-space:nowrap; box-shadow:0 4px 12px rgba(37,211,102,0.3); cursor:pointer;">Get Code</button>
                   </div>
                   <p class="text-muted mt-sm" style="font-size:0.75rem; opacity:0.8; margin-top:10px;">Include country code but NO plus sign (+) or spaces.</p>
               </div>
               <div id="pairing-input-container"></div>
             `
             }
          </div>
        `
              : `
          <div class="wa-qr-container">
            <div class="wa-qr-loading">
              <i class="fa-solid fa-spinner animate-spin" style="font-size:2.5rem; color:#25D366;"></i>
              <span style="font-weight:600; margin-top:1rem;">Connecting...</span>
            </div>
          </div>
          <p class="text-muted">Wait a moment while we update the session status...</p>
        `
        }
      </div>
    </div>
  `;

  // Attach dynamic logic for pairing code input container if it exists
  const pairingContainer = document.getElementById("pairing-input-container");
  if (pairingContainer && !pairingContainer.innerHTML.trim()) {
    pairingContainer.innerHTML =
      document.getElementById("pairing-input-tpl").innerHTML;

    const phoneInput = document.getElementById("wa-phone-input");
    if (phoneInput) {
      phoneInput.addEventListener("input", (e) => {
        state.whatsappPhone = e.target.value;
      });
      // Ensure the value is set correctly from state
      phoneInput.value = state.whatsappPhone || "";
    }

    document
      .getElementById("wa-get-pairing-btn")
      ?.addEventListener("click", handleGetPairingCode);
  }

  document
    .getElementById("wa-modal-close")
    ?.addEventListener("click", closeModal);
  document
    .getElementById("wa-logout-btn")
    ?.addEventListener("click", handleLogout);
}

async function handleGetPairingCode() {
  const phone = state.whatsappPhone;
  if (!phone || phone.length < 10) {
    import("./toast.js").then(({ showToast }) =>
      showToast(
        "Enter a valid phone number (including country code, eg 91XXXXXXXXXX)",
        "warning",
      ),
    );
    return;
  }

  const btn = document.getElementById("wa-get-pairing-btn");
  const originalText = btn.innerText;
  btn.innerText = "...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/whatsapp/pairing-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, phone }),
    });
    const data = await res.json();
    if (data.success) {
      state.whatsappPairingCode = data.code;
      renderModalContent();
    } else {
      throw new Error(data.error || "Failed to get code");
    }
  } catch (err) {
    import("./toast.js").then(({ showToast }) =>
      showToast(err.message, "error"),
    );
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

async function handleLogout() {
  const confirmed = await showConfirm(
    "Disconnect your WhatsApp session? You'll need to re-scan the QR code to use automation features.",
    "Disconnect WhatsApp",
    "danger",
  );
  if (!confirmed) return;

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
        data.qr !== state.whatsappQR ||
        data.pairingCode !== state.whatsappPairingCode
      ) {
        state.whatsappStatus = data.status;
        state.whatsappQR = data.qr;
        state.whatsappPairingCode = data.pairingCode || null;
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
