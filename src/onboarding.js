/**
 * Onboarding — Welcome modal & multi-step guide
 */

const ONBOARDING_DATA = [
  {
    title: "Upload Templates",
    subtitle: "Step 1: The Foundation",
    icon: "fa-images",
    illustration: "fa-cloud-arrow-up",
    content: `
      <p>Start by uploading your invitation card images. You can upload multiple designs at once.</p>
      <ul>
        <li><i class="fa-solid fa-check"></i> Support for JPG, PNG, and WebP</li>
        <li><i class="fa-solid fa-check"></i> Drag and drop functionality</li>
        <li><i class="fa-solid fa-check"></i> Reorder cards with ease</li>
      </ul>
    `,
  },
  {
    title: "Personalize Design",
    subtitle: "Step 2: Dynamic Overlays",
    icon: "fa-wand-magic-sparkles",
    illustration: "fa-pen-nib",
    content: `
      <p>Add placeholders like <code>{{Name}}</code> or <code>{{Table}}</code>. These are <b>interlinked</b> with your CSV list.</p>
      <ul>
        <li><i class="fa-solid fa-link"></i> <strong>Sync with CSV</strong>: Any field added in Step 3 automatically becomes a variable here.</li>
        <li><i class="fa-solid fa-font"></i> <strong>Creative Style</strong>: Custom fonts, multi-line support, and vibrant colors.</li>
        <li><i class="fa-solid fa-expand"></i> <strong>Precise Placement</strong>: Position text overlays perfectly on your template.</li>
      </ul>
    `,
  },
  {
    title: "Manage Guest List",
    subtitle: "Step 3: Intelligence & Data",
    icon: "fa-address-book",
    illustration: "fa-table-list",
    content: `
      <p>Organize your guests. Any column header added here becomes a <b>dynamic variable</b> in Step 2.</p>
      <ul>
        <li><i class="fa-solid fa-language"></i> <strong>Hindi Mode</strong>: Auto-convert English typing to Hindi.</li>
        <li><i class="fa-brands fa-whatsapp"></i> <strong>WhatsApp Suite</strong>: Send individual invites or use <b>Bulk Send</b> for all guests.</li>
        <li><i class="fa-solid fa-link"></i> <strong>Step 2 Link</strong>: Columns added here automatically sync as placeholders.</li>
      </ul>
    `,
  },
  {
    title: "Generate & Send",
    subtitle: "Step 4: Delivery",
    icon: "fa-paper-plane",
    illustration: "fa-whatsapp",
    content: `
      <p>Generate high-quality PDFs for all guests or send them directly via WhatsApp with a single click.</p>
      <ul>
        <li><i class="fa-solid fa-check"></i> Single PDF or Zip download</li>
        <li><i class="fa-solid fa-check"></i> Bulk WhatsApp messaging</li>
        <li><i class="fa-solid fa-check"></i> Real-time status tracking</li>
      </ul>
    `,
  },
];

let currentStep = 0;

export function initOnboarding() {
  const onboardingKey = "invitecraft_onboarding_shown_once";
  const hasShown = localStorage.getItem(onboardingKey);

  // Auto-show only on first visit ever. Otherwise user uses the Help button.
  if (!hasShown) {
    showOnboarding();
    localStorage.setItem(onboardingKey, "true");
  }
}

export function showOnboarding() {
  // Remove existing if any
  const existing = document.querySelector(".onboarding-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "onboarding-overlay";
  overlay.innerHTML = `
    <div class="onboarding-modal">
      <div class="onboarding-content">
        <aside class="onboarding-sidebar">
          <div class="logo" style="margin-bottom: var(--space-xl)">
            <div class="logo-icon"><i class="fa-solid fa-envelope-open-text"></i></div>
            <span class="logo-text">InviteCraft</span>
          </div>
          <div class="onboarding-step-list">
            ${ONBOARDING_DATA.map(
              (step, i) => `
              <div class="onboarding-step-item ${i === 0 ? "active" : ""}" data-index="${i}">
                <div class="onboarding-step-icon">${i + 1}</div>
                <span class="onboarding-step-label">${step.title}</span>
              </div>
            `,
            ).join("")}
          </div>
        </aside>
        <main class="onboarding-main">
          <div id="onboarding-step-content">
            <!-- Dynamic Content -->
          </div>
          <footer class="onboarding-footer">
            <div class="onboarding-footer-left">
              <label class="dont-show-container">
                <input type="checkbox" id="dont-show-again">
                Don't show this again
              </label>
            </div>
            <div class="onboarding-footer-right">
              <button class="btn btn-secondary" id="onboarding-prev" style="display: none;">Back</button>
              <button class="btn btn-primary" id="onboarding-next">Next <i class="fa-solid fa-arrow-right"></i></button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Trigger animation
  setTimeout(() => overlay.classList.add("active"), 10);

  currentStep = 0;
  updateOnboardingStep();

  // Event Listeners
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOnboarding();
  });

  overlay.querySelector("#onboarding-next").addEventListener("click", () => {
    if (currentStep < ONBOARDING_DATA.length - 1) {
      currentStep++;
      updateOnboardingStep();
    } else {
      closeOnboarding();
    }
  });

  overlay.querySelector("#onboarding-prev").addEventListener("click", () => {
    if (currentStep > 0) {
      currentStep--;
      updateOnboardingStep();
    }
  });

  overlay.querySelectorAll(".onboarding-step-item").forEach((item) => {
    item.addEventListener("click", () => {
      currentStep = parseInt(item.dataset.index);
      updateOnboardingStep();
    });
  });

  // Close on Escape
  const escHandler = (e) => {
    if (e.key === "Escape") closeOnboarding();
  };
  window.addEventListener("keydown", escHandler);
  overlay.escHandler = escHandler;
}

function updateOnboardingStep() {
  const data = ONBOARDING_DATA[currentStep];
  const container = document.getElementById("onboarding-step-content");
  const sidebarItems = document.querySelectorAll(".onboarding-step-item");
  const nextBtn = document.getElementById("onboarding-next");
  const prevBtn = document.getElementById("onboarding-prev");

  // Update Sidebar
  sidebarItems.forEach((item, i) => {
    item.classList.toggle("active", i === currentStep);
    item.classList.toggle("completed", i < currentStep);
    const icon = item.querySelector(".onboarding-step-icon");
    if (i < currentStep) {
      icon.innerHTML = '<i class="fa-solid fa-check"></i>';
    } else {
      icon.innerHTML = i + 1;
    }
  });

  // Update Content with animation
  container.style.opacity = "0";
  container.style.transform = "translateX(10px)";

  setTimeout(() => {
    container.innerHTML = `
      <div class="onboarding-header">
        <h2 class="onboarding-title">${data.title}</h2>
        <p class="onboarding-subtitle">${data.subtitle}</p>
      </div>
      <div class="onboarding-illustration">
        <i class="fa-solid ${data.illustration}"></i>
      </div>
      <div class="onboarding-body">
        ${data.content}
      </div>
    `;
    container.style.opacity = "1";
    container.style.transform = "translateX(0)";
  }, 200);

  // Update Buttons
  prevBtn.style.display = currentStep === 0 ? "none" : "inline-flex";
  if (currentStep === ONBOARDING_DATA.length - 1) {
    nextBtn.innerHTML = 'Get Started <i class="fa-solid fa-rocket"></i>';
  } else {
    nextBtn.innerHTML = 'Next <i class="fa-solid fa-arrow-right"></i>';
  }
}

function closeOnboarding() {
  const overlay = document.querySelector(".onboarding-overlay");
  const dontShow = document.getElementById("dont-show-again").checked;

  if (dontShow) {
    localStorage.setItem("invitecraft_onboarding_disabled", "true");
  }

  if (overlay) {
    overlay.classList.remove("active");
    setTimeout(() => {
      overlay.remove();
      window.removeEventListener("keydown", overlay.escHandler);
    }, 400);
  }
}
