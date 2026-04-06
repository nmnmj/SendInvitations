/**
 * App — Main orchestrator with stepper navigation + session persistence
 */
import { state, restoreSession, notify } from "./state.js";
import { clearState } from "./persistence.js";
import { showToast } from "./toast.js";
import { renderStep1, initStep1 } from "./step1.js";
import { renderStep2, initStep2 } from "./step2.js";
import { renderStep3, initStep3 } from "./step3.js";
import { renderStep4, initStep4 } from "./step4.js";
import { initOnboarding, showOnboarding } from "./onboarding.js";
import { showConfirm } from "./modal.js";

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

    // Initialize Onboarding (walkthrough) if not disabled
    initOnboarding();

    // Prevent Space bar from triggering any button globally (standard fix for "Space bar clicks button")
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key === " " && e.target.tagName === "BUTTON") {
          e.preventDefault();
        }
      },
      true,
    );

    if (restored) {
      showToast(
        `Session restored — ${state.images.length} images, ${state.csvData.rows.length} rows loaded`,
        "info",
        3000,
      );
    }
  }

  renderGuide(step) {
    const guides = [
      {
        icon: "fa-images",
        action: "Upload your invitation card images",
        hint: "Drag & drop or browse — JPEG/PNG supported. You can reorder pages after uploading.",
      },
      {
        icon: "fa-wand-magic-sparkles",
        action: "Position text placeholders on your card",
        hint: "Add fields like {{Name}} and drag them into place on the preview canvas.",
      },
      {
        icon: "fa-address-book",
        action: "Import or create your guest list",
        hint: "Upload a CSV file or manually add guests. Column names become placeholders.",
      },
      {
        icon: "fa-paper-plane",
        action: "Review & generate personalized invitations",
        hint: "Check everything looks right, then download PDFs or send via WhatsApp.",
      },
    ];

    const g = guides[step];
    return `
      <div class="step-guide">
        <div class="guide-icon"><i class="fa-solid ${g.icon}"></i></div>
        <div class="guide-content">
          <h3>${g.action}</h3>
          <p>${g.hint}</p>
        </div>
      </div>
    `;
  }

  render() {
    const step = state.currentStep;

    const nextLabels = ["Personalize", "Guest List", "Generate", ""];
    const prevLabels = ["", "Upload", "Personalize", "Guest List"];

    this.container.innerHTML = `
      <!-- Header -->
      <header class="app-header">
        <div class="header-inner">
          <div class="logo">
            <div class="logo-icon"><i class="fa-solid fa-envelope-open-text"></i></div>
            <span class="logo-text">InviteCraft</span>
            <span class="logo-badge">Pro</span>
          </div>
          <div class="header-actions">
            <div id="whatsapp-hub-container"></div>
            <div class="btn btn-secondary btn-sm" id="help-btn" role="button" tabindex="-1" title="How to use this app">
              <i class="fa-solid fa-circle-question"></i> <span>Guide</span>
            </div>
            <div class="session-badge" id="session-badge" title="Session auto-saved to browser storage">
              <i class="fa-solid fa-cloud-arrow-up"></i> <span>Saved</span>
            </div>
            <div class="btn btn-danger btn-sm" id="clear-session-btn" role="button" tabindex="-1" title="Clear all data and start fresh">
              <i class="fa-solid fa-rotate-left"></i> <span>Reset</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Stepper -->
      <div class="stepper-container">
        <nav class="stepper" id="stepper">
          ${STEPS.map(
            (s, i) => `
            ${i > 0 ? `<div class="step-connector ${i <= step ? "completed" : ""}"></div>` : ""}
            <div class="step-item ${i === step ? "active" : ""} ${i < step ? "completed" : ""}" data-step="${i}">
              <div class="step-number">
                ${i < step ? '<i class="fa-solid fa-check"></i>' : i + 1}
              </div>
              <span class="step-label">${s.label}</span>
            </div>
          `,
          ).join("")}
        </nav>
      </div>

      <!-- Content -->
      <main class="main-content" id="step-content">
        ${this.renderGuide(step)}
        
        <div class="step-inner-content">
          ${STEPS[step].render()}
        </div>

        <!-- Navigation -->
        <div class="nav-buttons">
          ${
            step > 0
              ? `<div class="btn btn-secondary" id="prev-btn" role="button" tabindex="-1"><i class="fa-solid fa-arrow-left"></i> ${prevLabels[step]}</div>`
              : "<div></div>"
          }
          ${
            step < STEPS.length - 1
              ? `<div class="btn btn-primary btn-next" id="next-btn" role="button" tabindex="-1">Next: ${nextLabels[step]} <i class="fa-solid fa-arrow-right"></i></div>`
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
        // Allow moving to any previous step or the next immediate step
        if (target < step || target === step + 1) {
          state.currentStep = target;
          notify();
          this.render();
        }
      });
    });

    // Prev / Next buttons
    document.getElementById("prev-btn")?.addEventListener("click", (e) => {
      e.currentTarget.blur();
      if (state.currentStep > 0) {
        state.currentStep--;
        notify();
        this.render();
      }
    });
    document.getElementById("next-btn")?.addEventListener("click", (e) => {
      e.currentTarget.blur();
      if (state.currentStep < STEPS.length - 1) {
        state.currentStep++;
        notify();
        this.render();
      }
    });

    // Reset / Clear session button
    document
      .getElementById("clear-session-btn")
      ?.addEventListener("click", async () => {
        const confirmed = await showConfirm(
          "This will clear all your uploaded images, personalization, and guest list. Are you sure?",
          "Clear Entire Session",
          "danger",
        );
        if (!confirmed) return;
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

    // Help Button
    document.getElementById("help-btn")?.addEventListener("click", () => {
      showOnboarding();
    });

    // Ensure WhatsApp hub is rendered
    renderHub();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
