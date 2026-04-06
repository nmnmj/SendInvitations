/**
 * Custom Modal System
 * Replaces native alert(), confirm(), and prompt()
 */

export function showModal({
  title,
  message,
  type = "info",
  confirmText = "OK",
  cancelText = "Cancel",
  showCancel = false,
  inputValue = "",
  inputPlaceholder = "",
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay active";
    overlay.style.zIndex = "10001";

    const isPrompt = inputValue !== undefined && inputPlaceholder !== "";

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="flex items-center gap-sm">
            <div class="card-header-icon ${type === "danger" ? "red" : type === "success" ? "green" : "purple"}">
              <i class="fa-solid ${type === "danger" ? "fa-triangle-exclamation" : type === "success" ? "fa-circle-check" : "fa-circle-info"}"></i>
            </div>
            <h2 class="modal-title" style="margin:0; font-size:1.1rem;">${title}</h2>
          </div>
        </div>
        <div class="modal-body mt-md">
          <p class="text-secondary" style="font-size:0.95rem;">${message}</p>
          ${
            isPrompt
              ? `<div class="form-group mt-md">
                  <input type="text" id="modal-prompt-input" class="form-input" value="${inputValue}" placeholder="${inputPlaceholder}" autofocus />
                 </div>`
              : ""
          }
        </div>
        <div class="flex justify-center gap-sm mt-lg">
          ${showCancel ? `<button class="btn btn-secondary" id="modal-cancel-btn">${cancelText}</button>` : ""}
          <button class="btn ${type === "danger" ? "btn-danger" : "btn-primary"}" id="modal-confirm-btn">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector("#modal-prompt-input");
    if (input) {
      input.focus();
      input.setSelectionRange(0, input.value.length);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") confirm();
        if (e.key === "Escape") cancel();
      });
    }

    function confirm() {
      const val = input ? input.value : true;
      cleanup();
      resolve(val);
    }

    function cancel() {
      cleanup();
      resolve(null);
    }

    function cleanup() {
      overlay.classList.remove("active");
      setTimeout(() => overlay.remove(), 300);
    }

    overlay
      .querySelector("#modal-confirm-btn")
      .addEventListener("click", confirm);
    overlay
      .querySelector("#modal-cancel-btn")
      ?.addEventListener("click", cancel);

    // Close on clicking outside the modal content
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cancel();
    });
  });
}

/**
 * Custom confirm() alternative
 */
export async function showConfirm(
  message,
  title = "Confirm Action",
  type = "purple",
) {
  return showModal({
    title,
    message,
    type,
    showCancel: true,
    confirmText: "Yes, Proceed",
    cancelText: "Cancel",
  });
}

/**
 * Custom prompt() alternative
 */
export async function showPrompt(
  message,
  defaultValue = "",
  title = "Input Required",
) {
  return showModal({
    title,
    message,
    inputValue: defaultValue,
    inputPlaceholder: "Type here...",
    showCancel: true,
    confirmText: "Save",
    cancelText: "Cancel",
  });
}

/**
 * Custom alert() alternative
 */
export async function showAlert(message, title = "Notice", type = "info") {
  return showModal({
    title,
    message,
    type,
    showCancel: false,
    confirmText: "Close",
  });
}
