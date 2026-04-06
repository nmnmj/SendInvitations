/**
 * App — Main orchestrator with stepper navigation + session persistence
 */
import { state, restoreSession } from "./state.js";
import { clearState } from "./persistence.js";
import { showToast } from "./toast.js";
import { renderStep1, initStep1 } from "./step1.js";
import { renderStep2, initStep2 } from "./step2.js";
import { renderStep3, initStep3 } from "./step3.js";
import { renderStep4, initStep4 } from "./step4.js";

const STEPS = [
  {
    label: "Upload Images",
    icon: "fa-images",
    render: renderStep1,
    init: initStep1,
  },
  {
    label: "Personalize",
    icon: "fa-wand-magic-sparkles",
    render: renderStep2,
    init: initStep2,
  },
  {
    label: "Guest List",
    icon: "fa-address-book",
    render: renderStep3,
    init: initStep3,
  },
  {
    label: "Generate",
    icon: "fa-download",
    render: renderStep4,
    init: initStep4,
  },
];

import { initWhatsAppHub, renderHub } from "./whatsapp_hub.js";

export class App {
  constructor() {
    this.container = document.getElementById("app");
    this.sessionRestored = false;
  }

  init() {
    // Try to restore previous session before first render
    const restored = restoreSession();
    this.sessionRestored = restored;
    this.render();

    // Start WhatsApp multi-user polling
    initWhatsAppHub();

    if (restored) {
      showToast(
        `Session restored — ${state.images.length} images, ${state.csvData.rows.length} rows loaded`,
        "info",
        3000,
      );
    }
  }

  render() {
    const step = state.currentStep;

    this.container.innerHTML = `
      <!-- Header -->
      <header class="app-header">
        <div class="header-inner">
          <div class="logo">
            <div class="logo-icon"><i class="fa-solid fa-envelope-open-text"></i></div>
            <span class="logo-text">InviteCraft</span>
            <span class="logo-badge">Pro</span>
          </div>
          <div class="flex items-center gap-md">
            <div id="whatsapp-hub-container"></div>
            <div class="session-badge" id="session-badge" title="Session auto-saved to browser storage">
              <i class="fa-solid fa-cloud-arrow-up"></i> Auto-saved
            </div>
            <button class="btn btn-danger btn-sm" id="clear-session-btn" title="Clear all data and start fresh">
              <i class="fa-solid fa-rotate-left"></i> Reset
            </button>
          </div>
        </div>
      </header>

      <!-- Stepper -->
      <nav class="stepper" id="stepper">
        ${STEPS.map(
          (s, i) => `
          ${i > 0 ? `<div class="step-connector ${i <= step ? "completed" : ""}"></div>` : ""}
          <div class="step-item ${i === step ? "active" : ""} ${i < step ? "completed" : ""}" data-step="${i}">
            <div class="step-number">
              ${i < step ? '<i class="fa-solid fa-check" style="font-size:0.7rem;"></i>' : i + 1}
            </div>
            <span class="step-label">${s.label}</span>
          </div>
        `,
        ).join("")}
      </nav>

      <!-- Content -->
      <main class="main-content" id="step-content">
        ${STEPS[step].render()}

        <!-- Navigation -->
        <div class="nav-buttons">
          ${
            step > 0
              ? `<button class="btn btn-secondary" id="prev-btn"><i class="fa-solid fa-arrow-left"></i> Back</button>`
              : "<div></div>"
          }
          ${
            step < STEPS.length - 1
              ? `<button class="btn btn-primary" id="next-btn">Next <i class="fa-solid fa-arrow-right"></i></button>`
              : "<div></div>"
          }
        </div>
      </main>
    `;

    // Initialize current step
    STEPS[step].init();

    // Stepper click navigation
    this.container.querySelectorAll(".step-item").forEach((el) => {
      el.addEventListener("click", () => {
        const target = parseInt(el.dataset.step);
        if (target <= step || target === step + 1) {
          state.currentStep = target;
          this.render();
        }
      });
    });

    // Prev / Next buttons
    document.getElementById("prev-btn")?.addEventListener("click", () => {
      if (state.currentStep > 0) {
        state.currentStep--;
        this.render();
      }
    });
    document.getElementById("next-btn")?.addEventListener("click", () => {
      if (state.currentStep < STEPS.length - 1) {
        state.currentStep++;
        this.render();
      }
    });

    // Reset / Clear session button
    document
      .getElementById("clear-session-btn")
      ?.addEventListener("click", () => {
        if (
          !confirm(
            "Reset all data? This will clear images, placeholders, guest list and step progress.",
          )
        )
          return;
        clearState();
        // Reset state in-place
        state.currentStep = 0;
        state.images = [];
        state.placeholders = [];
        state.pdfSettings = {
          pageSize: "A4",
          customWidth: 210,
          customHeight: 297,
          orientation: "auto",
          scaling: "fit",
        };
        state.csvData = { rows: [], headers: [], blankCount: 0 };
        this.render();
        showToast("Session cleared — starting fresh", "info");
      });

    // Ensure WhatsApp hub is rendered
    renderHub();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
