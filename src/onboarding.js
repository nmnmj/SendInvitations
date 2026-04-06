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
    title: "Guest List",
    subtitle: "Step 2: Data & Intelligence",
    icon: "fa-address-book",
    illustration: "fa-table-list",
    content: `
      <p>Import your guests. Upload a CSV or add them manually. All columns are automatically detected as variables.</p>
      <ul>
        <li><i class="fa-solid fa-bolt"></i> <strong>Variable Detection</strong>: Column headers become tags like {{Name}}.</li>
        <li><i class="fa-solid fa-language"></i> <strong>Hindi Mode</strong>: English typing converts to Hindi automatically.</li>
        <li><i class="fa-solid fa-table"></i> <strong>Live Table</strong>: Edit guest details directly in the dashboard.</li>
      </ul>
    `,
  },
  {
    title: "Personalize Design",
    subtitle: "Step 3: Creative Control",
    icon: "fa-wand-magic-sparkles",
    illustration: "fa-pen-nib",
    content: `
      <p>Place dynamic text on your card. Variables from Step 2 appear at the top for one-click placement.</p>
      <ul>
        <li><i class="fa-solid fa-link"></i> <strong>Variable Sync</strong>: Click any detected column tag at the top to add it to your design.</li>
        <li><i class="fa-solid fa-arrows-up-down-left-right"></i> <strong>Visual Canvas</strong>: Drag, style, and resize text overlays directly on the card.</li>
        <li><i class="fa-brands fa-whatsapp"></i> <strong>WhatsApp Suite</strong>: Manage bulk sending and templates at the bottom.</li>
      </ul>
    `,
  },
  {
    title: "Generate & Send",
    subtitle: "Step 4: Delivery",
    icon: "fa-paper-plane",
    illustration: "fa-whatsapp",
    content: `
      <p>The final stage! Generate high-quality personalized PDFs or trigger bulk WhatsApp messages.</p>
      <ul>
        <li><i class="fa-solid fa-file-pdf"></i> Single PDF or Zip download options</li>
        <li><i class="fa-brands fa-whatsapp"></i> Direct WhatsApp invitation delivery</li>
        <li><i class="fa-solid fa-magnifying-glass"></i> Real-time generation preview</li>
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
                <span>Don't show this again</span>
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
