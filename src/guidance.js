/**
 * Guidance — Context-aware hand gesture indicators with manual navigation and close option.
 */
import { state, onChange } from "./state.js";

let indicatorEl = null;
let currentTarget = null;
let checkInterval = null;
let manualRuleIndex = -1; // -1 means automatic logic

const GUIDANCE_RULES = [
  // --- GLOBAL / WHATSAPP ---
  {
    condition: () =>
      state.whatsappStatus === "not_started" ||
      state.whatsappStatus === "failed",
    target: "#wa-hub-open",
    text: "Point 1: Connect your WhatsApp account!",
    position: "bottom",
  },
  {
    condition: () =>
      state.whatsappStatus === "qr" &&
      document.getElementById("wa-qr-img-container")?.querySelector("img"),
    target: "#wa-qr-img-container img",
    text: "Link your device by scanning this QR code!",
    position: "bottom",
  },
  {
    condition: () =>
      !!state.whatsappPairingCode &&
      document.getElementById("wa-pairing-ui-root"),
    target: "#wa-pairing-ui-root",
    text: "Enter this pairing code on your phone!",
    position: "top",
  },

  // --- STEP 1 (UPLOAD) ---
  {
    step: 0,
    condition: () => state.images.length === 0,
    target: "#image-dropzone",
    text: "Drop your card background images here!",
    position: "bottom",
  },
  {
    step: 0,
    condition: () =>
      state.images.length > 0 &&
      document.getElementById("settings-body")?.style.display === "none",
    target: "#settings-toggle",
    text: "Tip: Adjust page size or scaling here.",
    position: "bottom",
  },
  {
    step: 0,
    condition: () => state.images.length > 0,
    target: "#next-btn",
    text: "Perfect! Now move to Step 2: Guest List.",
    position: "top",
  },

  // --- STEP 2 (GUEST LIST) ---
  {
    step: 1,
    condition: () => state.csvData.rows.length === 0,
    target: "#csv-dropzone",
    text: "Upload your guest database (CSV/Excel)!",
    position: "bottom",
  },
  {
    step: 1,
    condition: () => state.csvData.rows.length > 0 && !state.csvData.hindiMode,
    target: "#hindi-mode-toggle-s2",
    text: "Enable Hindi Mode for auto-translation!",
    position: "top",
  },
  {
    step: 1,
    condition: () => state.csvData.rows.length > 0,
    target: "#next-btn",
    text: "Ready! Path to Step 3: Personalize.",
    position: "top",
  },

  // --- STEP 3 (PERSONALIZE) ---
  {
    step: 2,
    condition: () =>
      state.placeholders.length === 0 &&
      document.getElementById("add-all-csv-btn"),
    target: "button#add-all-csv-btn",
    text: "Quickly place all CSV columns on your card!",
    position: "top",
  },
  {
    step: 2,
    condition: () =>
      state.placeholders.length === 0 &&
      (state.csvData.headers || []).length > 0,
    target: ".csv-var-btn",
    text: "Click each tag to add it to your design!",
    position: "top",
  },
  {
    step: 2,
    condition: () =>
      state.placeholders.length > 0 &&
      state.placeholders.some((p) => p.x === 50 && p.y === 50),
    target: "#preview-canvas",
    text: "Now drag the tags to place them correctly!",
    position: "bottom",
  },
  {
    step: 2,
    condition: () =>
      state.csvData.rows.length > 0 && !state.csvData.phoneHeader,
    target: "select#phone-column-dropdown",
    text: "Action: Link the Phone Number column!",
    position: "top",
  },
  {
    step: 2,
    condition: () =>
      state.csvData.rows.length > 0 &&
      state.csvData.whatsappMessageTemplate.includes("Hello {{Name}}"),
    target: "textarea#whatsapp-message-template",
    text: "Action: Customize your WhatsApp message!",
    position: "top",
  },
  {
    step: 2,
    condition: () =>
      state.csvData.rows.length > 0 &&
      !!state.csvData.phoneHeader &&
      (state.whatsappStatus === "ready" ||
        state.whatsappStatus === "initializing" ||
        state.whatsappStatus === "qr") &&
      document.getElementById("send-all-wa-btn"),
    target: "#send-all-wa-btn",
    text: "Final Action: Send to your entire list!",
    position: "top",
  },
  {
    step: 2,
    condition: () =>
      state.csvData.rows.length > 0 &&
      !!state.csvData.phoneHeader &&
      state.whatsappStatus === "ready",
    target: ".wa-quick-send-btn",
    text: "Action: Try sending a test message!",
    position: "top",
  },
  {
    step: 2,
    condition: () => state.placeholders.length > 0,
    target: "#next-btn",
    text: "Everything set? Move to final step.",
    position: "top",
  },

  // --- STEP 4 (GENERATE) ---
  {
    step: 3,
    condition: () => state.images.length > 0 && state.csvData.rows.length > 0,
    target: "button#generate-btn",
    text: "Finish: Build your personalized invitations!",
    position: "top",
  },
];

export function initGuidance() {
  if (typeof document === "undefined") return;

  if (!indicatorEl) {
    indicatorEl = document.createElement("div");
    indicatorEl.className = "guidance-indicator";
    indicatorEl.innerHTML = `
      <div class="guidance-bouncer">
        <div class="guidance-hand"><i class="fa-solid fa-hand-pointer"></i></div>
      </div>
      <div class="guidance-content">
        <button id="guidance-close" title="Hide All Hints" class="guidance-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="guidance-label"></div>
        <div class="guidance-nav">
          <button id="guidance-prev" title="Previous Hint"><i class="fa-solid fa-chevron-left"></i></button>
          <button id="guidance-next" title="Next Hint"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
      </div>
    `;
    document.body.appendChild(indicatorEl);

    document.getElementById("guidance-prev").addEventListener("click", (e) => {
      e.stopPropagation();
      navigateGuidance(-1);
    });
    document.getElementById("guidance-next").addEventListener("click", (e) => {
      e.stopPropagation();
      navigateGuidance(1);
    });
    document.getElementById("guidance-close").addEventListener("click", (e) => {
      e.stopPropagation();
      state.guidanceEnabled = false;
      localStorage.setItem("invitecraft_guidance_enabled", "false");
      updateGuidance();
    });
  }

  // Check guidance whenever state changes
  onChange(() => {
    // Reset manual mode on structural step change
    if (manualRuleIndex !== -1) {
      const currentRule = GUIDANCE_RULES[manualRuleIndex];
      const step = state.currentStep;
      if (
        currentRule &&
        currentRule.step !== undefined &&
        currentRule.step !== step
      ) {
        manualRuleIndex = -1;
      }
    }
    updateGuidance();
  });

  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(updateGuidance, 1200);

  window.addEventListener("scroll", updateGuidance, { passive: true });
  window.addEventListener("resize", updateGuidance, { passive: true });

  const observer = new MutationObserver(() => updateGuidance());
  observer.observe(document.body, { childList: true, subtree: true });

  updateGuidance();
}

function navigateGuidance(offset) {
  const step = state.currentStep;
  const currentStepRules = GUIDANCE_RULES.filter(
    (r) => r.step === undefined || r.step === step,
  ).filter((r) => document.querySelector(r.target));

  if (currentStepRules.length === 0) return;

  let currentIndex = -1;
  const activeRule = getActiveRule();
  if (activeRule) {
    currentIndex = currentStepRules.indexOf(activeRule);
  }

  let nextIndex = currentIndex + offset;
  if (nextIndex < 0) nextIndex = currentStepRules.length - 1;
  if (nextIndex >= currentStepRules.length) nextIndex = 0;

  const nextRule = currentStepRules[nextIndex];
  manualRuleIndex = GUIDANCE_RULES.indexOf(nextRule);
  updateGuidance();
}

function getActiveRule() {
  const step = state.currentStep;
  if (manualRuleIndex !== -1) {
    return GUIDANCE_RULES[manualRuleIndex];
  }
  return GUIDANCE_RULES.find(
    (r) => (r.step === undefined || r.step === step) && r.condition(),
  );
}

function updateGuidance() {
  if (!indicatorEl) return;

  // Check master switch
  if (!state.guidanceEnabled) {
    hideIndicator();
    return;
  }

  // Hide if any major overlay/modal is open
  if (
    document.querySelector(".onboarding-overlay") ||
    document.querySelector(".modal-overlay")
  ) {
    hideIndicator();
    return;
  }

  const activeRule = getActiveRule();
  if (!activeRule) {
    hideIndicator();
    return;
  }

  const el = document.querySelector(activeRule.target);
  if (!el || !isElementVisible(el)) {
    if (manualRuleIndex !== -1) {
      manualRuleIndex = -1;
      updateGuidance();
      return;
    }
    hideIndicator();
    return;
  }

  showIndicator(el, activeRule.text, activeRule.position);
}

function isElementVisible(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

function showIndicator(target, text, position) {
  if (currentTarget !== target) {
    if (currentTarget) currentTarget.classList.remove("guided-target");
    currentTarget = target;
    target.classList.add("guided-target");
  }

  const label = indicatorEl.querySelector(".guidance-label");
  const bouncer = indicatorEl.querySelector(".guidance-bouncer");
  const hand = indicatorEl.querySelector(".guidance-hand");

  if (label.textContent !== text) {
    label.textContent = text;
  }

  const rect = target.getBoundingClientRect();

  hand.style.transform = "";
  indicatorEl.style.flexDirection = "column";

  indicatorEl.style.visibility = "hidden";
  indicatorEl.classList.add("active");
  const indRect = indicatorEl.getBoundingClientRect();
  indicatorEl.style.visibility = "visible";

  let top, left;
  const gap = 5;

  if (position === "top") {
    top = rect.top - indRect.height - gap;
    left = rect.left + rect.width / 2 - indRect.width / 2;
    label.style.order = "1";
    bouncer.style.order = "2";
    hand.style.transform = "rotate(180deg)";
  } else if (position === "bottom") {
    top = rect.bottom + gap;
    left = rect.left + rect.width / 2 - indRect.width / 2;
    label.style.order = "2";
    bouncer.style.order = "1";
    hand.style.transform = "rotate(0deg)";
  } else if (position === "left") {
    top = rect.top + rect.height / 2 - indRect.height / 2;
    left = rect.left - indRect.width - gap;
    indicatorEl.style.flexDirection = "row";
    label.style.order = "1";
    bouncer.style.order = "2";
    hand.style.transform = "rotate(90deg)";
  } else if (position === "right") {
    top = rect.top + rect.height / 2 - indRect.height / 2;
    left = rect.right + gap;
    indicatorEl.style.flexDirection = "row";
    label.style.order = "2";
    bouncer.style.order = "1";
    hand.style.transform = "rotate(-90deg)";
  }

  if (left < 10) left = 10;
  if (left + indRect.width > window.innerWidth - 10) {
    left = window.innerWidth - indRect.width - 10;
  }
  if (top < 10) top = 10;
  if (top + indRect.height > window.innerHeight - 10) {
    top = window.innerHeight - indRect.height - 10;
  }

  indicatorEl.style.top = `${top}px`;
  indicatorEl.style.left = `${left}px`;
  indicatorEl.classList.add("active");
}

function hideIndicator() {
  if (indicatorEl) indicatorEl.classList.remove("active");
  if (currentTarget) {
    currentTarget.classList.remove("guided-target");
    currentTarget = null;
  }
}
