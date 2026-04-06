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
import { showConfirm, showModal } from "./modal.js";
import { initGuidance } from "./guidance.js";
import QRCode from "qrcode";

const STEPS = [
  {
    label: "Upload Images",
    icon: "fa-images",
    render: renderStep1,
    init: initStep1,
  },
  {
    label: "Guest List",
    icon: "fa-address-book",
    render: renderStep3,
    init: initStep3,
  },
  {
    label: "Personalize",
    icon: "fa-wand-magic-sparkles",
    render: renderStep2,
    init: initStep2,
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

    // Initialize dynamic guidance indicators
    initGuidance();

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
        icon: "fa-address-book",
        action: "Import or create your guest list",
        hint: "Upload a CSV file or manually add guests. Column names become placeholders.",
      },
      {
        icon: "fa-wand-magic-sparkles",
        action: "Position text placeholders on your card",
        hint: "Add fields like {{Name}} and drag them into place on the preview canvas. Setup WhatsApp messages here.",
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

    const nextLabels = ["Guest List", "Personalize", "Generate", ""];
    const prevLabels = ["", "Upload", "Guest List", "Personalize"];

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
            <div class="btn btn-secondary btn-sm" id="help-btn" role="button" tabindex="-1" title="${state.guidanceEnabled ? "Show app walkthrough" : "Re-enable guidance hints"}">
              <i class="fa-solid fa-${state.guidanceEnabled ? "circle-question" : "wand-magic-sparkles"}"></i> 
              <span>${state.guidanceEnabled ? "Guide" : "Enable Tips"}</span>
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

      <!-- Footer -->
      <footer class="app-footer">
        <div class="footer-inner">
          <div class="support-section">
            <h3 style="margin-bottom: 5px;">Love this tool?</h3>
            <p class="text-secondary" style="font-size: 0.9rem; margin-bottom: 15px;">Support the developer to keep InviteCraft free and ad-free.</p>
            <button class="btn btn-primary btn-sm" id="support-dev-btn">
              <i class="fa-solid fa-heart"></i> Support the Work
            </button>
          </div>

          <div class="footer-logo">
            <div class="logo-icon" style="width: 30px; height: 30px; font-size: 0.9rem;"><i class="fa-solid fa-envelope-open-text"></i></div>
            <span class="logo-text" style="font-size: 1.1rem;">InviteCraft</span>
          </div>

          <p class="footer-credits">
            Crafted with <i class="fa-solid fa-heart" style="color: #f43f5e;"></i> for the community.
          </p>
        </div>
      </footer>
    `;

    // Initialize current step
    STEPS[step].init();

    // Support Developer Button
    document
      .getElementById("support-dev-btn")
      ?.addEventListener("click", () => {
        this.showSupportModal();
      });

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
      state.guidanceEnabled = true;
      localStorage.setItem("invitecraft_guidance_enabled", "true");
      notify();
      showOnboarding();
    });

    // Ensure WhatsApp hub is rendered
    renderHub();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  showSupportModal() {
    const upiId = "nmnjay@oksbi";
    const upiName = "InviteCraft Designer";
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&cu=INR`;

    const html = `
      <div class="support-modal-content">
        <div class="support-qr-card">
           <canvas id="support-qr-canvas" style="width: 200px; height: 200px;"></canvas>
           <div class="qr-banner">SCAN TO PAY</div>
        </div>
        
        <div style="text-align: center; width: 100%; margin-top: 10px;">
          <p class="text-secondary" style="font-size: 0.95rem; line-height: 1.5; color: var(--text-secondary); max-width: 280px; margin: 0 auto 15px;">
             Your support helps keep this tool free and open for everyone.
          </p>
          <div class="upi-id-row" style="margin: 0 auto;">
            <span class="upi-id-text">${upiId}</span>
            <button class="copy-btn" id="copy-upi-btn">
              <i class="fa-regular fa-clone"></i>
            </button>
          </div>
        </div>

        <a href="${upiLink}" class="btn pay-link-btn gpay-btn" style="margin-top: 8px;">
          <i class="fa-brands fa-google-pay"></i>
          <span>PAY WITH GOOGLE PAY</span>
        </a>

        <div class="pay-accepted-container">
          <div class="accepted-badge">
             <i class="fa-brands fa-google-pay"></i> <span>Accepted Here</span>
          </div>
          
          <div class="alt-pay-icons">
            <i class="fa-solid fa-indian-rupee-sign"></i>
            <i class="fa-brands fa-apple-pay"></i>
            <i class="fa-solid fa-building-columns"></i>
          </div>
        </div>
      </div>
    `;

    showModal({
      title: "Support the Developer",
      message: html,
      type: "purple",
      confirmText: "Done",
    });

    // Generate CLEAN QR code from the UPI ID (no name/image from the raw jpeg)
    setTimeout(async () => {
      const canvas = document.getElementById("support-qr-canvas");
      if (canvas) {
        try {
          await QRCode.toCanvas(canvas, upiLink, {
            width: 220,
            margin: 1,
            color: {
              dark: "#050508", // match --bg-primary
              light: "#ffffff",
            },
          });
        } catch (err) {
          console.error("QR Code Error:", err);
          canvas.parentElement.innerHTML =
            '<div class="support-qr-placeholder"><i class="fa-solid fa-qrcode"></i></div>';
        }
      }

      // Add copy listener
      document.getElementById("copy-upi-btn")?.addEventListener("click", () => {
        navigator.clipboard.writeText(upiId);
        showToast("UPI ID copied! Ready to paste in Google Pay.", "success");
      });
    }, 100);
  }
}
