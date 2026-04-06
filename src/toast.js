/**
 * Toast notification system
 */
let toastContainer = null;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
}

const ICONS = {
  success: "fa-circle-check",
  error: "fa-circle-xmark",
  warning: "fa-triangle-exclamation",
  info: "fa-circle-info",
};

export function showToast(message, type = "info", duration = 4000) {
  ensureContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${ICONS[type]} toast-icon"></i>
    <span>${message}</span>
    <button class="toast-dismiss" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = "slideInRight 0.3s ease reverse forwards";
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}
