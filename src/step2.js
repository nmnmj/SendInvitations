/**
 * Step 2: Dynamic Personalization — Placeholders & Text Overlays
 * Interlinked with CSV: shows detected CSV columns as available variables.
 */
import Papa from "papaparse";
import { state, notify } from "./state.js";
import { showToast } from "./toast.js";
import { showConfirm, showPrompt } from "./modal.js";

const FONT_OPTIONS = [
  "Inter",
  "Noto Sans Devanagari",
  "Rajdhani",
  "Teko",
  "Kalam",
  "Poppins",
  "Playfair Display",
  "Dancing Script",
  "Roboto",
  "Montserrat",
  "Lora",
  "Arial",
];

const ALIGNMENT_OPTIONS = [
  { value: "left", label: "Left", icon: "fa-align-left" },
  { value: "center", label: "Center", icon: "fa-align-center" },
  { value: "right", label: "Right", icon: "fa-align-right" },
];

let currentPreviewPage = 0;
let canvas, ctx;
let dragTarget = null;
let dragOffset = { x: 0, y: 0 };
let resizeTarget = null;
let initialResizeFontSize = 0;
let initialResizeMouseY = 0;
let showGrid = false;

export function renderStep2() {
  if (state.images.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-image"></i></div>
        <p class="empty-state-text">No images uploaded yet</p>
        <p class="text-muted" style="font-size:0.85rem; margin-top: 4px;">Go back to Step 1 to upload your invitation card images first.</p>
      </div>
    `;
  }

  // Determine which CSV columns are available but not yet added as placeholders
  const csvHeaders = state.csvData.headers || [];
  const existingKeys = state.placeholders.map((p) => p.key);
  const availableFromCSV = csvHeaders.filter((h) => !existingKeys.includes(h));

  return `
    <!-- 1. CSV Variables (Highest Priority) -->
    ${
      csvHeaders.length > 0
        ? `
    <div class="card mb-lg" style="border-color:rgba(59,130,246,0.3);">
      <div class="card-header">
        <div class="card-header-icon blue"><i class="fa-solid fa-link"></i></div>
        <span class="card-title">CSV Variables Available</span>
      </div>
      <p class="text-muted mb-md" style="font-size:0.85rem;">
        Click to add CSV column as a text placeholder on your card:
      </p>
      <div class="flex gap-sm flex-wrap" id="csv-vars-area">
        ${csvHeaders
          .map((h) => {
            const added = existingKeys.includes(h);
            return `<button class="btn ${added ? "btn-success" : "btn-secondary"} btn-sm csv-var-btn" 
                    data-col="${h}" ${added ? "disabled" : ""}>
                    <i class="fa-solid ${added ? "fa-check" : "fa-plus"}"></i> {{${h}}}
                  </button>`;
          })
          .join("")}
      </div>
      ${
        availableFromCSV.length > 0
          ? `
        <button class="btn btn-primary btn-sm mt-md" id="add-all-csv-btn">
          <i class="fa-solid fa-plus-circle"></i> Add All Remaining (${availableFromCSV.length})
        </button>
      `
          : ""
      }
    </div>
    `
        : `
    <div class="card mb-lg" style="border-color:rgba(59,130,246,0.2);">
      <div class="card-header">
        <div class="card-header-icon blue"><i class="fa-solid fa-circle-info"></i></div>
        <span class="card-title">Tip: Link with Guest Data</span>
      </div>
      <p class="text-muted" style="font-size:0.85rem;">
        Upload a CSV in Step 2 and column names will appear here as one-click variables.
      </p>
    </div>
    `
    }

    <!-- 2. Manual Personalization Tools -->
    <div class="card mb-md">
      <div class="card-header">
        <div class="card-header-icon purple"><i class="fa-solid fa-plus"></i></div>
        <span class="card-title">Add Custom Placeholder</span>
      </div>
      <div class="flex gap-sm flex-wrap items-center">
        <input type="text" class="form-input" id="new-placeholder-key" placeholder="e.g. f1, name, event" style="max-width:250px;" />
        <button class="btn btn-primary" id="add-placeholder-btn"><i class="fa-solid fa-plus"></i> Add</button>
      </div>
    </div>

    <div class="placeholder-list" id="placeholder-list"></div>

    <!-- 3. Preview Section (Centerpiece) -->
    <div class="preview-container mt-xl" id="preview-section">
      <div class="preview-canvas-wrap">
        <div class="preview-toolbar">
          <span style="font-weight:600;font-size:0.9rem;"><i class="fa-solid fa-eye" style="margin-right:6px;"></i>Live Preview</span>
          <div style="flex:1;"></div>
          <button class="btn btn-secondary btn-sm" id="toggle-grid-btn" style="margin-right:8px; padding:4px 10px; font-size:0.75rem;" title="Toggle Alignment Grid">
            <i class="fa-solid fa-border-all"></i> Grid
          </button>
          <div class="page-pills" id="page-pills"></div>
        </div>
        <div class="preview-canvas-area" id="preview-canvas-area">
          <canvas id="preview-canvas"></canvas>
        </div>
        <p class="text-muted mt-md" style="font-size:0.8rem;">
          <i class="fa-solid fa-arrows-up-down-left-right"></i> Drag items to reposition &bull; 
          <i class="fa-solid fa-up-right-and-down-left-from-center"></i> Drag top-right corner to resize
        </p>
      </div>
      <div class="preview-sidebar">
        <div class="card">
          <div class="card-header">
            <div class="card-header-icon green"><i class="fa-solid fa-layer-group"></i></div>
            <span class="card-title">Page Overlays</span>
          </div>
          <div id="layer-list" class="layer-list"></div>
        </div>
      </div>
    </div>

    <div style="margin-top: 40px; border-top: 2px dashed var(--border-color); padding-top: 30px;">
       <div class="flex items-center gap-sm mb-lg">
         <i class="fa-solid fa-database" style="color:var(--accent-primary);"></i>
         <h3 style="margin:0; font-size:1.1rem; font-weight:600;">Data & WhatsApp Suite</h3>
       </div>

       <!-- 1. Stats -->
       <div class="csv-stats" id="csv-stats" style="${state.csvData.rows.length > 0 ? "" : "display:none;"}">
         <div class="stat-card">
           <div class="stat-value purple" id="stat-total">${state.csvData.rows.length}</div>
           <div class="stat-label">Total Guests</div>
         </div>
         <div class="stat-card">
           <div class="stat-value green" id="stat-valid">${state.csvData.rows.length}</div>
           <div class="stat-label">Valid Entries</div>
         </div>
         <div class="stat-card">
           <div class="stat-value purple" id="stat-columns">${csvHeaders.length}</div>
           <div class="stat-label">Columns</div>
         </div>
         <div class="stat-card">
           <div class="stat-value orange" id="stat-blanks">${state.csvData.blankCount || 0}</div>
           <div class="stat-label">Blank Fields</div>
         </div>
       </div>

       <!-- 2. WhatsApp Suite (Now Above Actions/Table) -->
       ${
         csvHeaders.length > 0
           ? `
         <div class="p-md mb-lg" id="whatsapp-suite-card" style="background:rgba(37,211,102,0.05); border:1px solid rgba(37,211,102,0.2); border-radius:var(--radius-md); border-top: 4px solid #25D366;">
           <div class="flex items-center gap-sm mb-sm">
             <i class="fa-brands fa-whatsapp" style="color:#25D366; font-size:1.1rem;"></i>
             <span style="font-weight:600; font-size:0.9rem;">Bulk WhatsApp Sending</span>
           </div>
           
           <div class="flex gap-md flex-wrap">
             <div style="flex: 1; min-width: 250px;">
               <p class="text-muted mb-xs" style="font-size:0.8rem;"><strong>1. Select Phone Column</strong></p>
               <select class="form-select" id="phone-column-dropdown" style="border-color:rgba(37,211,102,0.3); background:var(--bg-card); font-size: 0.85rem;">
                 <option value="">-- Choose Column --</option>
                 ${csvHeaders.map((h) => `<option value="${h}" ${h === state.csvData.phoneHeader ? "selected" : ""}>${h}</option>`).join("")}
               </select>
             </div>
             
             <div style="flex: 2; min-width: 300px;">
               <p class="text-muted mb-xs" style="font-size:0.8rem;"><strong>2. Customize WhatsApp Message</strong></p>
               <textarea class="form-input" id="whatsapp-message-template" rows="2" style="font-size: 0.85rem; border-color:rgba(37,211,102,0.3); background:var(--bg-card); resize: vertical;" placeholder="e.g. Hello {{Name}}, check out your invite!"></textarea>
               <div id="variable-shortcuts" class="flex gap-xs flex-wrap mt-xs">
                 ${csvHeaders.map((h) => `<button class="btn btn-sm btn-outline wa-var-btn" data-col="${h}" style="font-size:0.65rem; padding: 2px 6px; border-color:rgba(108, 99, 255, 0.2); color:var(--text-muted);">+ {{${h}}}</button>`).join("")}
               </div>
             </div>
           </div>

           <div class="mt-md pt-md" style="border-top:1px solid rgba(37,211,102,0.2);">
             <p class="text-muted mb-xs" style="font-size:0.8rem;"><strong>3. Optional video</strong> — same clip for every guest; sent by the WhatsApp bridge <strong>right after</strong> each PDF. Use MP4/MOV/WebM/3GP; very large files may fail (keep under ~110 MB).</p>
             <div class="flex items-center gap-sm flex-wrap">
               <input type="file" id="wa-video-input" accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/3gp" style="display:none;" />
               <button type="button" class="btn btn-sm btn-outline" id="wa-video-browse" role="button" tabindex="-1"><i class="fa-solid fa-film"></i> Choose video…</button>
               <span id="wa-video-label" class="text-muted" style="font-size:0.8rem; flex:1; min-width:120px;">None selected</span>
               <button type="button" class="btn btn-sm btn-outline" id="wa-video-clear" role="button" tabindex="-1" style="display:none;"><i class="fa-solid fa-xmark"></i> Remove</button>
             </div>
           </div>
           
           <div class="flex items-center gap-sm mt-md pt-md" style="border-top:1px solid rgba(37,211,102,0.2);">
             <div class="btn btn-accent" id="send-all-wa-btn" style="background:#25D366; color:white;" role="button" tabindex="-1"><i class="fa-brands fa-whatsapp"></i> Send All to WhatsApp</div>
             <div id="wa-batch-status-inline" class="flex items-center gap-sm" style="font-size:0.75rem; color:var(--text-muted);"></div>
           </div>
         </div>
         `
           : `
         <div class="card mb-lg" style="border-color:rgba(37,211,102,0.2);">
            <div class="card-header">
              <div class="card-header-icon green"><i class="fa-brands fa-whatsapp"></i></div>
              <span class="card-title">WhatsApp Sending</span>
            </div>
            <p class="text-muted" style="font-size:0.85rem;">Upload a Guest List CSV in Step 2 to enable bulk WhatsApp sending and messaging templates.</p>
         </div>
         `
       }

       <!-- 3. Data Actions -->
       <div class="flex gap-sm flex-wrap mt-lg mb-lg" id="csv-actions" style="${state.csvData.rows.length > 0 ? "" : "display:none;"}">
         <div class="btn btn-outline" id="add-row-manual-btn" role="button" tabindex="-1"><i class="fa-solid fa-plus"></i> Add One Guest</div>
         <div class="btn btn-success" id="download-csv-btn" role="button" tabindex="-1"><i class="fa-solid fa-download"></i> Download CSV</div>
         <div class="flex items-center gap-sm px-md py-xs" style="background:var(--bg-input); border-radius:var(--radius-md); border:1px solid var(--border-color);">
           <label class="flex items-center gap-xs cursor-pointer" style="font-size:0.85rem; user-select:none;">
             <input type="checkbox" id="hindi-mode-toggle" tabindex="-1" style="width:16px; height:16px; accent-color:var(--accent-primary);" ${state.csvData.hindiMode ? "checked" : ""}>
             <span>Hindi Input Mode</span>
           </label>
         </div>
         <div class="btn btn-danger" id="clear-csv-btn" role="button" tabindex="-1"><i class="fa-solid fa-trash"></i> Clear Data</div>
       </div>

       <!-- 4. Mini Info Report -->
       <div id="csv-info-report" class="mt-md"></div>

       <!-- 5. Guest List Table -->
       <div class="csv-table-wrap mb-xl" id="csv-table-wrap" style="${state.csvData.rows.length > 0 ? "" : "display:none;"} max-height: 400px; overflow-y: auto; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
         <table class="csv-table" id="csv-table">
           <thead><tr id="csv-table-head"></tr></thead>
           <tbody id="csv-table-body"></tbody>
         </table>
       </div>
    </div>
    </div>
  `;
}

export function initStep2() {
  const addBtn = document.getElementById("add-placeholder-btn");
  const keyInput = document.getElementById("new-placeholder-key");

  if (addBtn) {
    addBtn.addEventListener("click", () =>
      addPlaceholder(keyInput.value.trim()),
    );
    keyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addPlaceholder(keyInput.value.trim());
    });
  }

  // CSV variable quick-add buttons
  document.querySelectorAll(".csv-var-btn:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      addPlaceholder(btn.dataset.col);
      btn.disabled = true;
      btn.className = "btn btn-success btn-sm csv-var-btn";
      btn.innerHTML = `<i class="fa-solid fa-check"></i> {{${btn.dataset.col}}}`;
    });
  });

  // Add All CSV columns button
  document.getElementById("add-all-csv-btn")?.addEventListener("click", () => {
    const csvHeaders = state.csvData.headers || [];
    const existingKeys = state.placeholders.map((p) => p.key);
    const toAdd = csvHeaders.filter((h) => !existingKeys.includes(h));
    let count = 0;
    toAdd.forEach((key) => {
      if (addPlaceholderSilent(key)) count++;
    });
    if (count > 0) {
      renderPlaceholderList();
      document.getElementById("preview-section").style.display = "";
      drawPreview();
      showToast(
        `Added ${count} placeholder${count !== 1 ? "s" : ""} from CSV`,
        "success",
      );
      notify();
      // Update the CSV var buttons
      document.querySelectorAll(".csv-var-btn").forEach((btn) => {
        btn.disabled = true;
        btn.className = "btn btn-success btn-sm csv-var-btn";
        btn.innerHTML = `<i class="fa-solid fa-check"></i> {{${btn.dataset.col}}}`;
      });
      const addAllBtn = document.getElementById("add-all-csv-btn");
      if (addAllBtn) addAllBtn.remove();
    }
  });

  renderPlaceholderList();
  initPreview();

  // WhatsApp Suite bindings
  const msgTemplateInput = document.getElementById("whatsapp-message-template");
  if (msgTemplateInput) {
    msgTemplateInput.value = state.csvData.whatsappMessageTemplate || "";
    msgTemplateInput.addEventListener("input", (e) => {
      state.csvData.whatsappMessageTemplate = e.target.value;
      notify();
    });
  }

  document.querySelectorAll(".wa-var-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (msgTemplateInput) {
        const h = btn.dataset.col;
        const start = msgTemplateInput.selectionStart;
        const end = msgTemplateInput.selectionEnd;
        const text = msgTemplateInput.value;
        msgTemplateInput.value =
          text.substring(0, start) + `{{${h}}}` + text.substring(end);
        state.csvData.whatsappMessageTemplate = msgTemplateInput.value;
        msgTemplateInput.focus();
        msgTemplateInput.setSelectionRange(
          start + h.length + 4,
          start + h.length + 4,
        );
        notify();
      }
    });
  });

  document
    .getElementById("phone-column-dropdown")
    ?.addEventListener("change", (e) => {
      state.csvData.phoneHeader = e.target.value || null;
      notify();
      if (state.csvData.phoneHeader) {
        showToast(
          `Phone number column set to: ${state.csvData.phoneHeader}`,
          "success",
        );
      }
    });

  document
    .getElementById("send-all-wa-btn")
    ?.addEventListener("click", sendAllToWhatsApp);

  const waVideoInput = document.getElementById("wa-video-input");
  const waVideoBrowse = document.getElementById("wa-video-browse");
  const waVideoClear = document.getElementById("wa-video-clear");
  const waVideoLabel = document.getElementById("wa-video-label");
  const syncWaVideoUi = () => {
    const f = state.whatsappVideoFile;
    if (waVideoLabel) {
      waVideoLabel.textContent = f ? f.name : "None selected";
    }
    if (waVideoClear) {
      waVideoClear.style.display = f ? "" : "none";
    }
  };
  syncWaVideoUi();
  waVideoBrowse?.addEventListener("click", () => waVideoInput?.click());
  waVideoInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) {
      state.whatsappVideoFile = file;
      notify();
      syncWaVideoUi();
    }
    e.target.value = "";
  });
  waVideoClear?.addEventListener("click", () => {
    state.whatsappVideoFile = null;
    notify();
    syncWaVideoUi();
  });

  // Guest List Actions
  document
    .getElementById("add-row-manual-btn")
    ?.addEventListener("click", () => {
      addRow();
      renderTable();
      notify();
    });
  document
    .getElementById("download-csv-btn")
    ?.addEventListener("click", downloadCSV);
  document.getElementById("clear-csv-btn")?.addEventListener("click", clearCSV);
  document
    .getElementById("hindi-mode-toggle")
    ?.addEventListener("change", (e) => {
      state.csvData.hindiMode = e.target.checked;
      notify();
    });

  if (state.csvData.rows.length > 0) {
    renderTable();
    showInfoReport();
  }
}

function addPlaceholder(rawKey) {
  let key = rawKey.replace(/[{}]/g, "").replace(/\s+/g, "_").trim();
  if (!key) {
    showToast("Enter a placeholder name", "warning");
    return false;
  }
  if (state.placeholders.find((p) => p.key === key)) {
    showToast(`Placeholder "{{${key}}}" already exists`, "warning");
    return false;
  }
  state.placeholders.push({
    id: crypto.randomUUID(),
    key,
    fontFamily: "Inter",
    fontSize: 24,
    color: "#ffffff",
    alignment: "center",
    pages: [0],
    x: 50,
    y: 50,
  });
  const input = document.getElementById("new-placeholder-key");
  if (input) input.value = "";
  renderPlaceholderList();
  showToast(`Placeholder "{{${key}}}" added`, "success");
  drawPreview();
  notify();
  return true;
}

/** Add placeholder without toasts (for bulk add) */
function addPlaceholderSilent(key) {
  key = key.replace(/[{}]/g, "").replace(/\s+/g, "_").trim();
  if (!key || state.placeholders.find((p) => p.key === key)) return false;
  state.placeholders.push({
    id: crypto.randomUUID(),
    key,
    fontFamily: "Inter",
    fontSize: 24,
    color: "#ffffff",
    alignment: "center",
    pages: [0],
    x: 50,
    y: 50,
  });
  return true;
}

function renderPlaceholderList() {
  const list = document.getElementById("placeholder-list");
  if (!list) return;

  // Check which placeholders have matching CSV columns
  const csvHeaders = state.csvData.headers || [];

  list.innerHTML =
    state.placeholders.length === 0
      ? `<div class="empty-state" style="padding:var(--space-xl);">
        <p class="empty-state-text">No placeholders yet. Add one above to get started.</p>
      </div>`
      : state.placeholders
          .map((p) => {
            const hasCSVColumn = csvHeaders.includes(p.key);
            return `
      <div class="placeholder-item" data-id="${p.id}">
        <div class="placeholder-header">
          <div class="flex items-center gap-sm">
            <span class="placeholder-tag"><i class="fa-solid fa-code"></i> {{${p.key}}}</span>
            ${
              hasCSVColumn
                ? '<span class="badge badge-success"><i class="fa-solid fa-link"></i> Linked to CSV</span>'
                : '<span class="badge badge-warning"><i class="fa-solid fa-unlink"></i> No CSV column</span>'
            }
          </div>
          <button class="btn btn-danger btn-sm delete-placeholder" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="placeholder-controls">
          <div class="form-group">
            <label class="form-label">Font</label>
            <select class="form-select ph-font" data-id="${p.id}">
              ${FONT_OPTIONS.map((f) => `<option value="${f}" ${p.fontFamily === f ? "selected" : ""}>${f}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Size (px)</label>
            <input type="number" class="form-input ph-size" data-id="${p.id}" value="${p.fontSize}" min="8" max="200" />
          </div>
          <div class="form-group">
            <label class="form-label">Color</label>
            <input type="color" class="ph-color" data-id="${p.id}" value="${p.color}" />
          </div>
          <div class="form-group">
            <label class="form-label">Align</label>
            <select class="form-select ph-align" data-id="${p.id}">
              ${ALIGNMENT_OPTIONS.map((a) => `<option value="${a.value}" ${p.alignment === a.value ? "selected" : ""}>${a.label}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">X Position (%)</label>
            <input type="number" class="form-input ph-x" data-id="${p.id}" value="${p.x}" min="0" max="100" />
          </div>
          <div class="form-group">
            <label class="form-label">Y Position (%)</label>
            <input type="number" class="form-input ph-y" data-id="${p.id}" value="${p.y}" min="0" max="100" />
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Apply to Pages</label>
            <div class="page-pills ph-pages" data-id="${p.id}">
              ${state.images
                .map(
                  (_, i) => `
                <label class="page-pill ${p.pages.includes(i) ? "active" : ""}" data-page="${i}">
                  <input type="checkbox" ${p.pages.includes(i) ? "checked" : ""} style="display:none;" />
                  ${i + 1}
                </label>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
          })
          .join("");

  // Wire up listeners
  list.querySelectorAll(".delete-placeholder").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.placeholders = state.placeholders.filter(
        (p) => p.id !== btn.dataset.id,
      );
      renderPlaceholderList();
      drawPreview();
      showToast("Placeholder removed", "info");
      notify();
    });
  });

  list.querySelectorAll(".ph-font").forEach((el) => {
    el.addEventListener("change", (e) => {
      const p = findPlaceholder(e.target.dataset.id);
      if (p) {
        p.fontFamily = e.target.value;
        drawPreview();
        notify();
      }
    });
  });
  list.querySelectorAll(".ph-size").forEach((el) => {
    el.addEventListener("input", (e) => {
      const p = findPlaceholder(e.target.dataset.id);
      if (p) {
        p.fontSize = parseInt(e.target.value) || 24;
        drawPreview();
        notify();
      }
    });
  });
  list.querySelectorAll(".ph-color").forEach((el) => {
    el.addEventListener("input", (e) => {
      const p = findPlaceholder(e.target.dataset.id);
      if (p) {
        p.color = e.target.value;
        drawPreview();
        notify();
      }
    });
  });
  list.querySelectorAll(".ph-align").forEach((el) => {
    el.addEventListener("change", (e) => {
      const p = findPlaceholder(e.target.dataset.id);
      if (p) {
        p.alignment = e.target.value;
        drawPreview();
        notify();
      }
    });
  });
  list.querySelectorAll(".ph-x").forEach((el) => {
    el.addEventListener("input", (e) => {
      const p = findPlaceholder(e.target.dataset.id);
      if (p) {
        p.x = parseFloat(e.target.value) || 0;
        drawPreview();
        notify();
      }
    });
  });
  list.querySelectorAll(".ph-y").forEach((el) => {
    el.addEventListener("input", (e) => {
      const p = findPlaceholder(e.target.dataset.id);
      if (p) {
        p.y = parseFloat(e.target.value) || 0;
        drawPreview();
        notify();
      }
    });
  });

  // Page pills toggles
  list.querySelectorAll(".ph-pages").forEach((container) => {
    container.querySelectorAll(".page-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const p = findPlaceholder(container.dataset.id);
        const page = parseInt(pill.dataset.page);
        if (p) {
          const idx = p.pages.indexOf(page);
          if (idx >= 0) p.pages.splice(idx, 1);
          else p.pages.push(page);
          pill.classList.toggle("active");
          drawPreview();
          notify();
        }
      });
    });
  });
}

function findPlaceholder(id) {
  return state.placeholders.find((p) => p.id === id);
}

/* ============================================
   Preview Canvas with drag-to-position
   ============================================ */

function initPreview() {
  canvas = document.getElementById("preview-canvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");

  const gridBtn = document.getElementById("toggle-grid-btn");
  if (gridBtn) {
    gridBtn.addEventListener("click", () => {
      showGrid = !showGrid;
      gridBtn.classList.toggle("btn-primary", showGrid);
      gridBtn.classList.toggle("btn-secondary", !showGrid);
      drawPreview();
    });
  }

  renderPagePills();
  drawPreview();

  canvas.addEventListener("mousedown", onCanvasMouseDown);
  canvas.addEventListener("mousemove", onCanvasMouseMove);
  canvas.addEventListener("mouseup", onCanvasMouseUp);
  canvas.addEventListener("mouseleave", onCanvasMouseUp);

  // Touch event bindings for mobile
  canvas.addEventListener("touchstart", onCanvasMouseDown, { passive: false });
  canvas.addEventListener("touchmove", onCanvasMouseMove, { passive: false });
  canvas.addEventListener("touchend", onCanvasMouseUp);
  canvas.addEventListener("touchcancel", onCanvasMouseUp);
}

function renderPagePills() {
  const container = document.getElementById("page-pills");
  if (!container) return;
  container.innerHTML = state.images
    .map(
      (_, i) =>
        `<button class="page-pill ${i === currentPreviewPage ? "active" : ""}" data-page="${i}">Page ${i + 1}</button>`,
    )
    .join("");
  container.querySelectorAll(".page-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentPreviewPage = parseInt(btn.dataset.page);
      renderPagePills();
      drawPreview();
    });
  });
}

function getPreviewPageDims(img) {
  const settings = state.pdfSettings;
  const sizes = {
    A4: { w: 595.28, h: 841.89 },
    Letter: { w: 612, h: 792 },
    Custom: {
      w: settings.customWidth * 2.835,
      h: settings.customHeight * 2.835,
    },
  };
  const pageDims = sizes[settings.pageSize] || sizes.A4;

  let pageW = pageDims.w;
  let pageH = pageDims.h;

  if (settings.orientation === "auto") {
    const isLandscapeImg = img.width > img.height;
    if (isLandscapeImg && pageH > pageW) [pageW, pageH] = [pageH, pageW];
    else if (!isLandscapeImg && pageW > pageH) [pageW, pageH] = [pageH, pageW];
  } else if (settings.orientation === "landscape") {
    if (pageH > pageW) [pageW, pageH] = [pageH, pageW];
  } else {
    if (pageW > pageH) [pageW, pageH] = [pageH, pageW];
  }
  return { pageW, pageH };
}

function drawPreview() {
  if (!canvas || !ctx) return;
  const imgState = state.images[currentPreviewPage];
  if (!imgState) return;

  const image = new Image();
  image.onload = () => {
    const { pageW, pageH } = getPreviewPageDims(imgState);

    const maxW = 600,
      maxH = 600;
    // Scale canvas to match PDF aspect ratio
    let scale = Math.min(maxW / pageW, maxH / pageH, 1);
    const canvasW = pageW * scale;
    const canvasH = pageH * scale;

    canvas.width = canvasW;
    canvas.height = canvasH;
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Reproduce step4.js fit/fill/stretch logic
    let drawX = 0,
      drawY = 0,
      drawW = canvasW,
      drawH = canvasH;
    const imgRatio = image.naturalWidth / image.naturalHeight;
    const pageRatio = canvasW / canvasH;

    if (state.pdfSettings.scaling === "fit") {
      if (imgRatio > pageRatio) {
        drawW = canvasW;
        drawH = canvasW / imgRatio;
        drawX = 0;
        drawY = (canvasH - drawH) / 2;
      } else {
        drawH = canvasH;
        drawW = canvasH * imgRatio;
        drawX = (canvasW - drawW) / 2;
        drawY = 0;
      }
    } else if (state.pdfSettings.scaling === "fill") {
      if (imgRatio > pageRatio) {
        drawH = canvasH;
        drawW = canvasH * imgRatio;
        drawX = (canvasW - drawW) / 2;
        drawY = 0;
      } else {
        drawW = canvasW;
        drawH = canvasW / imgRatio;
        drawX = 0;
        drawY = (canvasH - drawH) / 2;
      }
    }

    ctx.drawImage(image, drawX, drawY, drawW, drawH);

    const w = canvasW;
    const h = canvasH;

    // Draw alignment grid if enabled
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;

      for (let i = 1; i < 10; i++) {
        const lineX = (i / 10) * w;
        const lineY = (i / 10) * h;

        ctx.beginPath();
        ctx.moveTo(lineX, 0);
        ctx.lineTo(lineX, h);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(w, lineY);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(247, 37, 133, 0.6)";
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw placeholders on this page
    const overlays = state.placeholders.filter((p) =>
      p.pages.includes(currentPreviewPage),
    );

    overlays.forEach((p) => {
      const px = (p.x / 100) * w;
      const py = (p.y / 100) * h;

      // Calculate font size true to PDF dimensions
      const canvasScale = canvasW / pageW;
      const scaledSize = p.fontSize * canvasScale;

      ctx.save();
      ctx.font = `${scaledSize}px "${p.fontFamily}"`;
      ctx.fillStyle = p.color;
      ctx.textAlign = p.alignment;
      ctx.textBaseline = "middle";

      let text = `{{${p.key}}}`;
      if (
        state.csvData &&
        state.csvData.rows &&
        state.csvData.rows.length > 0
      ) {
        const rowVal = state.csvData.rows[0][p.key];
        if (
          rowVal !== undefined &&
          rowVal !== null &&
          rowVal.toString().trim() !== ""
        ) {
          text = rowVal.toString().trim();
        }
      }

      const metrics = ctx.measureText(text);
      let rectX = px;
      if (p.alignment === "center") rectX = px - metrics.width / 2;
      else if (p.alignment === "right") rectX = px - metrics.width;

      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(
        rectX - 4,
        py - scaledSize / 2 - 2,
        metrics.width + 8,
        scaledSize + 4,
      );

      ctx.fillStyle = p.color;
      ctx.fillText(text, px, py);

      ctx.strokeStyle = "rgba(108, 99, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        rectX - 4,
        py - scaledSize / 2 - 2,
        metrics.width + 8,
        scaledSize + 4,
      );

      // Draw Resize Handle (Native Mobile Feel)
      const handleX = rectX - 4 + metrics.width + 8;
      const handleY = py - scaledSize / 2 - 2;
      ctx.setLineDash([]);
      ctx.fillStyle = "white";
      ctx.strokeStyle = "var(--accent-primary)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(handleX, handleY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    });

    updateOverlayList(overlays);
  };
  image.src = imgState.url;
}

function updateOverlayList(overlays) {
  const el = document.getElementById("page-overlay-list");
  if (!el) return;
  if (overlays.length === 0) {
    el.innerHTML =
      '<p class="text-muted" style="font-size:0.8rem;">No placeholders on this page</p>';
    return;
  }
  const csvHeaders = state.csvData.headers || [];
  el.innerHTML = overlays
    .map(
      (p) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-color);">
      <span class="placeholder-tag" style="font-size:0.7rem;padding:2px 8px;">{{${p.key}}}</span>
      <span class="text-muted" style="font-size:0.75rem;">${p.fontFamily} ${p.fontSize}px</span>
      ${csvHeaders.includes(p.key) ? '<i class="fa-solid fa-link" style="color:var(--success);font-size:0.65rem;" title="Linked to CSV"></i>' : ""}
    </div>
  `,
    )
    .join("");
}

/* Drag-to-reposition on canvas */
function onCanvasMouseDown(e) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const clientX =
    e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
  const clientY =
    e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const w = canvas.width;
  const h = canvas.height;

  const overlays = state.placeholders.filter((p) =>
    p.pages.includes(currentPreviewPage),
  );
  for (let i = overlays.length - 1; i >= 0; i--) {
    const p = overlays[i];
    const px = (p.x / 100) * w;
    const py = (p.y / 100) * h;
    const { pageW } = getPreviewPageDims(state.images[currentPreviewPage]);
    const canvasScale = canvas.width / pageW;
    const scaledSize = p.fontSize * canvasScale;
    let text = `{{${p.key}}}`;
    if (state.csvData && state.csvData.rows && state.csvData.rows.length > 0) {
      const rowVal = state.csvData.rows[0][p.key];
      if (
        rowVal !== undefined &&
        rowVal !== null &&
        rowVal.toString().trim() !== ""
      ) {
        text = rowVal.toString().trim();
      }
    }

    // Exact sizing
    ctx.font = `${scaledSize}px "${p.fontFamily}"`;
    const metrics = ctx.measureText(text);
    let rectX = px;
    if (p.alignment === "center") rectX = px - metrics.width / 2;
    else if (p.alignment === "right") rectX = px - metrics.width;

    const trX = rectX - 4 + metrics.width + 8;
    const trY = py - scaledSize / 2 - 2;

    const isTouch = e.type.startsWith("touch");
    const hitRadius = isTouch ? 30 : 15; // More forgiving on touch

    if (Math.hypot(mx - trX, my - trY) <= hitRadius) {
      if (e.cancelable) e.preventDefault();
      resizeTarget = p;
      initialResizeFontSize = p.fontSize;
      initialResizeMouseY = my;
      canvas.style.cursor = "nesw-resize";
      return;
    }

    const hitH = scaledSize + (isTouch ? 40 : 20);
    const hitW =
      (metrics.width || scaledSize * text.length * 0.7) + (isTouch ? 60 : 30);

    let hitX = px;
    if (p.alignment === "center") hitX = px - hitW / 2;
    else if (p.alignment === "right") hitX = px - hitW;

    if (
      mx >= hitX &&
      mx <= hitX + hitW &&
      my >= py - hitH / 2 &&
      my <= py + hitH / 2
    ) {
      if (e.cancelable) e.preventDefault();
      dragTarget = p;
      dragOffset.x = mx - px;
      dragOffset.y = my - py;
      canvas.style.cursor = "grabbing";
      return;
    }
  }
}

function onCanvasMouseMove(e) {
  if (!canvas) return;

  const isTouch = e.type.startsWith("touch");
  if (isTouch && e.touches.length > 1) return; // Ignore multi-touch for now to keep it stable

  if (dragTarget || resizeTarget) {
    if (e.cancelable) e.preventDefault(); // Stop mobile scroll while dragging
  }

  const rect = canvas.getBoundingClientRect();
  const clientX =
    e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
  const clientY =
    e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const w = canvas.width;
  const h = canvas.height;

  if (dragTarget) {
    dragTarget.x = Math.max(0, Math.min(100, ((mx - dragOffset.x) / w) * 100));
    dragTarget.y = Math.max(0, Math.min(100, ((my - dragOffset.y) / h) * 100));

    document
      .querySelectorAll(`.ph-x[data-id="${dragTarget.id}"]`)
      .forEach((el) => (el.value = Math.round(dragTarget.x)));
    document
      .querySelectorAll(`.ph-y[data-id="${dragTarget.id}"]`)
      .forEach((el) => (el.value = Math.round(dragTarget.y)));

    drawPreview();
    return;
  }

  if (resizeTarget) {
    const deltaY = initialResizeMouseY - my; // Moving mouse UP shrinks the Y coordinate, meaning POSITIVE delta
    const { pageW } = getPreviewPageDims(state.images[currentPreviewPage]);
    const canvasScale = canvas.width / pageW;

    resizeTarget.fontSize = Math.max(
      8,
      initialResizeFontSize + deltaY / canvasScale,
    );

    document
      .querySelectorAll(`.ph-size[data-id="${resizeTarget.id}"]`)
      .forEach((el) => (el.value = Math.round(resizeTarget.fontSize)));

    drawPreview();
    return;
  }

  // Hover detection for cursor
  let isHovering = false;
  const overlays = state.placeholders.filter((p) =>
    p.pages.includes(currentPreviewPage),
  );
  const { pageW } = getPreviewPageDims(state.images[currentPreviewPage]);
  const canvasScale = canvas.width / pageW;

  for (let i = overlays.length - 1; i >= 0; i--) {
    const p = overlays[i];
    const px = (p.x / 100) * w;
    const py = (p.y / 100) * h;
    const scaledSize = p.fontSize * canvasScale;
    let text = `{{${p.key}}}`;
    if (state.csvData && state.csvData.rows && state.csvData.rows.length > 0) {
      const rowVal = state.csvData.rows[0][p.key];
      if (
        rowVal !== undefined &&
        rowVal !== null &&
        rowVal.toString().trim() !== ""
      ) {
        text = rowVal.toString().trim();
      }
    }

    const hitH = scaledSize + 16;
    const hitW = scaledSize * text.length * 0.7 + 40;

    // Exact sizing
    ctx.font = `${scaledSize}px "${p.fontFamily}"`;
    const metrics = ctx.measureText(text);
    let rectX = px;
    if (p.alignment === "center") rectX = px - metrics.width / 2;
    else if (p.alignment === "right") rectX = px - metrics.width;

    const trX = rectX - 4 + metrics.width + 8;
    const trY = py - scaledSize / 2 - 2;

    if (Math.hypot(mx - trX, my - trY) <= 12) {
      isHovering = true;
      canvas.style.cursor = "nesw-resize";
      break;
    }

    let hitX = px;
    if (p.alignment === "center") hitX = px - hitW / 2;
    else if (p.alignment === "right") hitX = px - hitW;

    if (
      mx >= hitX &&
      mx <= hitX + hitW &&
      my >= py - hitH / 2 &&
      my <= py + hitH / 2
    ) {
      isHovering = true;
      canvas.style.cursor = "grab";
      break;
    }
  }
  if (!isHovering) canvas.style.cursor = "";
}

function onCanvasMouseUp() {
  if (dragTarget || resizeTarget) {
    dragTarget = null;
    resizeTarget = null;
    if (canvas) canvas.style.cursor = "";
    notify();
  }
}

export async function sendAllToWhatsApp() {
  const { rows, headers } = state.csvData;
  if (!rows.length) return;

  const btn = document.getElementById("send-all-wa-btn");
  if (!btn) return;
  const originalHTML = btn.innerHTML;

  const pendingRows = rows.filter((r) => !r.__sent__);
  if (pendingRows.length === 0) {
    import("./toast.js").then(({ showToast }) =>
      showToast("All guests have already been sent invitations.", "info"),
    );
    return;
  }

  if (state.whatsappStatus !== "ready") {
    import("./toast.js").then(({ showToast }) =>
      showToast(
        "Please connect your WhatsApp device first to bulk send.",
        "warning",
      ),
    );
    const waHubBtn = document.getElementById("wa-hub-open");
    if (waHubBtn) waHubBtn.click();
    return;
  }

  let warningPrefix = "";
  if (state.placeholders.length === 0) {
    warningPrefix =
      "WARNING: You haven't setup any text placeholders. Your cards will be sent without names.\n\n";
  }

  const confirmed = await showConfirm(
    `${warningPrefix}Are you sure you want to send ${pendingRows.length} invitations? \n\nPatience is key: A 3s delay will be added between each to prevent spam flags.`,
    "Bulk Automation Start",
    "success",
  );
  if (!confirmed) return;

  btn.disabled = true;
  btn.style.opacity = "0.7";

  const { sendViaWhatsAppAutomation } = await import("./step4.js");

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.__sent__) {
      continue;
    }

    let phone = "";
    if (state.csvData.phoneHeader) {
      phone = (row[state.csvData.phoneHeader] || "").toString().trim();
    } else {
      for (const h of headers) {
        const val = (row[h] || "").toString().trim();
        if (val.replace(/[^0-9]/g, "").length >= 10) {
          phone = val;
          break;
        }
      }
    }

    phone = phone.replace(/[^0-9+]/g, "");
    if (phone.length === 10 && !phone.startsWith("+")) {
      phone = "91" + phone;
    }

    if (!phone || phone.length < 10) {
      console.warn(`Row ${i + 1} has no phone number, skipping.`);
      failCount++;
      continue;
    }

    const name =
      headers.length > 0 ? (row[headers[0]] || "").trim() : `Guest ${i + 1}`;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Sending ${successCount + failCount + 1}/${pendingRows.length} to ${name}...`;

    try {
      await sendViaWhatsAppAutomation(i, phone);
      successCount++;

      state.csvData.rows[i].__sent__ = true;
      const cb = document.querySelector(
        `.row-sent-checkbox[data-index="${i}"]`,
      );
      if (cb) cb.checked = true;
      const tr = cb?.closest("tr");
      if (tr) tr.classList.add("row-sent");
      notify();
    } catch (err) {
      console.error(`Batch send failed for row ${i + 1}:`, err);
      failCount++;
      state.csvData.rows[i].__sent__ = false;
      const cb = document.querySelector(
        `.row-sent-checkbox[data-index="${i}"]`,
      );
      if (cb) cb.checked = false;
      const tr = cb?.closest("tr");
      if (tr) tr.classList.remove("row-sent");
      notify();
    }

    const hasMoreToSend = rows.slice(i + 1).some((r) => !r.__sent__);
    if (hasMoreToSend) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  btn.disabled = false;
  btn.style.opacity = "1";
  btn.innerHTML = `<i class="fa-solid fa-check-double"></i> Batch Complete!`;

  import("./toast.js").then(({ showToast }) =>
    showToast(
      `Batch Done! ${successCount} sent, ${failCount} failed.`,
      "success",
    ),
  );

  setTimeout(() => {
    btn.innerHTML = originalHTML;
  }, 5000);
}

export function renderTable() {
  const { headers, rows } = state.csvData;
  const thead = document.getElementById("csv-table-head");
  const tbody = document.getElementById("csv-table-body");
  if (!thead || !tbody) return;

  // Update stats
  const totalEl = document.getElementById("stat-total");
  if (totalEl) totalEl.textContent = rows.length;
  const validEl = document.getElementById("stat-valid");
  if (validEl) validEl.textContent = rows.length;
  const columnsEl = document.getElementById("stat-columns");
  if (columnsEl) columnsEl.textContent = headers.length;
  const blanksEl = document.getElementById("stat-blanks");
  if (blanksEl) blanksEl.textContent = state.csvData.blankCount || 0;

  thead.innerHTML = `<th>#</th><th title="Manual Sent Status">Sent</th>${headers.map((h) => `<th>{{${h}}}</th>`).join("")}<th style="text-align:right;">Quick Share / Delete</th>`;

  tbody.innerHTML = rows
    .map((row, i) => {
      const isSent = row.__sent__ === true;
      let phoneTxt = "";

      if (state.csvData.phoneHeader) {
        phoneTxt = (row[state.csvData.phoneHeader] || "").toString().trim();
      } else {
        for (const h of headers) {
          const val = (row[h] || "").toString().trim();
          if (val.replace(/[^0-9]/g, "").length >= 10) {
            phoneTxt = val;
            break;
          }
        }
      }

      phoneTxt = phoneTxt.replace(/[^0-9+]/g, "");
      if (phoneTxt.length === 10 && !phoneTxt.startsWith("+")) {
        phoneTxt = "91" + phoneTxt;
      }

      const hasPhone = phoneTxt.length >= 10;

      return `<tr class="${isSent ? "row-sent" : ""}">
      <td>${i + 1}</td>
      <td>
        <input type="checkbox" class="row-sent-checkbox" data-index="${i}" ${isSent ? "checked" : ""}>
      </td>
      ${headers
        .map((h) => {
          const val = row[h] || "";
          const isBlank = val.toString().trim() === "";
          return `<td contenteditable="true" class="csv-cell" data-header="${h}" data-index="${i}" ${isBlank ? 'style="color:var(--text-muted);font-style:italic;"' : ""}>${isBlank ? "" : val}</td>`;
        })
        .join("")}
      <td style="text-align:right;">
         <div class="flex items-center justify-end gap-sm">
           <button class="btn btn-sm wa-quick-send-btn hint-btn" data-index="${i}" data-phone="${phoneTxt}" style="${hasPhone ? "background:#25D366; color:white;" : "background:var(--bg-highlight); color:var(--text-muted);"}" ${!hasPhone ? 'title="No phone number detected"' : ""}>
             <i class="fa-brands fa-whatsapp"></i> ${hasPhone ? "Send" : "Generate"}
           </button>
           <button class="btn btn-sm csv-delete-row-btn" data-index="${i}" style="background:transparent; border:none; color:var(--danger); padding:4px;" title="Delete Row">
             <i class="fa-solid fa-trash"></i>
           </button>
         </div>
      </td>
    </tr>`;
    })
    .join("");

  // Cell listeners
  document.querySelectorAll(".csv-cell").forEach((cell) => {
    cell.addEventListener("keydown", async (e) => {
      if (!state.csvData.hindiMode) return;
      cell._keyboardHandled = false;
      const isSpace = e.key === " " || e.keyCode === 32;
      const isEnter = e.key === "Enter" || e.keyCode === 13;
      if (isSpace || isEnter) {
        if (e.key !== "Unidentified" && e.keyCode !== 229) {
          cell._keyboardHandled = true;
          e.stopImmediatePropagation();
          await handleTransliteration(e, isEnter ? "Enter" : "Space", cell);
        }
      }
    });

    cell.addEventListener("input", async (e) => {
      const idx = cell.dataset.index;
      const header = cell.dataset.header;
      state.csvData.rows[idx][header] = cell.innerText.trim();
      notify();

      if (!state.csvData.hindiMode) return;
      const isSpace = e.data === " ";
      const isEnter =
        e.inputType === "insertParagraph" || e.inputType === "insertLineBreak";
      if (isSpace || isEnter) {
        if (cell._keyboardHandled) {
          cell._keyboardHandled = false;
          return;
        }
        e.stopImmediatePropagation();
        await handleTransliteration(e, isEnter ? "Enter" : "Space", cell);
      }
    });

    cell.addEventListener("blur", (e) => {
      const idx = e.target.dataset.index;
      const header = e.target.dataset.header;
      const val = e.target.innerText.trim();
      state.csvData.rows[idx][header] = val;
      state.csvData.blankCount = calculateBlankCount();
      const stBlanks = document.getElementById("stat-blanks");
      if (stBlanks) stBlanks.textContent = state.csvData.blankCount;
      notify();
      if (val === "") {
        e.target.style.color = "var(--text-muted)";
        e.target.style.fontStyle = "italic";
        e.target.innerText = "";
      } else {
        e.target.style.color = "";
        e.target.style.fontStyle = "";
      }
      showInfoReport();
    });
  });

  // Action listeners
  document.querySelectorAll(".csv-delete-row-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      state.csvData.rows.splice(idx, 1);
      renderTable();
      notify();
    });
  });

  document.querySelectorAll(".row-sent-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const idx = parseInt(e.target.dataset.index);
      const row = state.csvData.rows[idx];
      if (row) {
        row.__sent__ = e.target.checked;
        const tr = e.target.closest("tr");
        if (tr) {
          if (row.__sent__) tr.classList.add("row-sent");
          else tr.classList.remove("row-sent");
        }
        notify();
      }
    });
  });

  document.querySelectorAll(".wa-quick-send-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const tempBtn = e.currentTarget;
      const idx = parseInt(tempBtn.dataset.index);

      const row = state.csvData.rows[idx];
      let phone = "";
      if (row) {
        if (state.csvData.phoneHeader) {
          phone = (row[state.csvData.phoneHeader] || "").toString().trim();
        } else {
          for (const h of state.csvData.headers) {
            const val = (row[h] || "").toString().trim();
            if (val.replace(/[^0-9]/g, "").length >= 10) {
              phone = val;
              break;
            }
          }
        }
        phone = phone.replace(/[^0-9+]/g, "");
        if (phone.length === 10 && !phone.startsWith("+")) {
          phone = "91" + phone;
        }
      }

      if (!phone || phone.length < 10) {
        showToast("No valid phone number for this row", "error");
        return;
      }

      if (state.whatsappStatus !== "ready") {
        showToast(
          "Please connect your WhatsApp device first to send.",
          "warning",
        );
        const waHubBtn = document.getElementById("wa-hub-open");
        if (waHubBtn) waHubBtn.click();
        return;
      }

      const originalHTML = tempBtn.innerHTML;
      tempBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Sending...`;
      tempBtn.style.pointerEvents = "none";
      tempBtn.style.opacity = "0.7";

      try {
        const { sendViaWhatsAppAutomation } = await import("./step4.js");
        await sendViaWhatsAppAutomation(idx, phone);

        const row = state.csvData.rows[idx];
        if (row) {
          row.__sent__ = true;
          const cb = document.querySelector(
            `.row-sent-checkbox[data-index="${idx}"]`,
          );
          if (cb) cb.checked = true;
          const tr = tempBtn.closest("tr");
          if (tr) tr.classList.add("row-sent");
          notify();
        }

        tempBtn.innerHTML = `<i class="fa-solid fa-check"></i> Sent`;
        tempBtn.style.background = "#059669";
        tempBtn.style.opacity = "1";

        setTimeout(() => {
          tempBtn.innerHTML = originalHTML;
          tempBtn.style.background = "#25D366";
          tempBtn.style.pointerEvents = "auto";
        }, 3000);
      } catch (err) {
        tempBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Fail`;
        tempBtn.style.background = "#dc2626";
        tempBtn.style.pointerEvents = "auto";
        tempBtn.style.opacity = "1";
        console.error(err);
      }
    });
  });
}

async function handleTransliteration(e, isManualKey, cell) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  const text = node.textContent || "";
  const pos = range.startOffset;
  const isInputInserted = e.type === "input";
  const lookbackPos = isInputInserted ? pos - 1 : pos;
  const textBefore = text.substring(0, lookbackPos);
  const lastWordMatch = textBefore.match(/(\S+)$/);

  if (lastWordMatch) {
    if (e.type === "keydown") e.preventDefault();
    const word = lastWordMatch[1];
    const start = lastWordMatch.index;
    try {
      const hindiWord = await transliterateWord(word);
      if (hindiWord === word) {
        if (e.type === "keydown") {
          const extra = isManualKey === "Enter" ? "\n" : " ";
          const newText = text.substring(0, pos) + extra + text.substring(pos);
          node.textContent = newText;
          const newRange = document.createRange();
          newRange.setStart(node, pos + 1);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
        return;
      }
      const extra = isManualKey === "Enter" ? "\n" : " ";
      let newText = isInputInserted
        ? text.substring(0, start) + hindiWord + text.substring(lookbackPos)
        : text.substring(0, start) + hindiWord + extra + text.substring(pos);
      node.textContent = newText;
      const newRange = document.createRange();
      const newPos =
        start + hindiWord.length + (isInputInserted ? pos - lookbackPos : 1);
      newRange.setStart(node, Math.min(newPos, node.textContent.length));
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      const idx = cell.dataset.index;
      const header = cell.dataset.header;
      state.csvData.rows[idx][header] = node.textContent;
      state.csvData.blankCount = calculateBlankCount();
      const blanksEl = document.getElementById("stat-blanks");
      if (blanksEl) blanksEl.textContent = state.csvData.blankCount;
      notify();
    } catch (err) {
      console.error("Transliteration failed", err);
    }
  }
}

async function transliterateWord(word) {
  if (!word || !/[a-zA-Z]/.test(word)) return word;
  const url = `https://inputtools.google.com/request?itc=hi-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=test&text=${encodeURIComponent(word)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data[0] === "SUCCESS") return data[1][0][1][0];
  return word;
}

function calculateBlankCount() {
  const { headers, rows } = state.csvData;
  let count = 0;
  rows.forEach((row) => {
    headers.forEach((h) => {
      const val = row[h];
      if (val === undefined || val === null || val.toString().trim() === "")
        count++;
    });
  });
  return count;
}

function addRow() {
  const { headers } = state.csvData;
  const newRow = { __sent__: false };
  headers.forEach((h) => (newRow[h] = ""));
  state.csvData.rows.push(newRow);
  state.csvData.blankCount = calculateBlankCount();
}

function downloadCSV() {
  const { headers, rows } = state.csvData;
  if (rows.length === 0) return showToast("No data to download", "warning");
  const csv = Papa.unparse({
    fields: headers,
    data: rows.map((r) => headers.map((h) => r[h] || "")),
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "guest_list.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function clearCSV() {
  const confirmed = await showConfirm(
    "Permanently clear all guest data?",
    "Clear Data",
    "danger",
  );
  if (!confirmed) return;
  state.csvData = { rows: [], headers: [], blankCount: 0 };
  document.getElementById("csv-stats").style.display = "none";
  document.getElementById("csv-actions").style.display = "none";
  document.getElementById("csv-table-wrap").style.display = "none";
  document.getElementById("csv-info-report").innerHTML = "";
  notify();
}

function showInfoReport() {
  const infoEl = document.getElementById("csv-info-report");
  if (!infoEl) return;
  const blk = state.csvData.blankCount || 0;
  if (blk === 0 && state.csvData.rows.length > 0) {
    infoEl.innerHTML = `
      <div class="card" style="border-color:rgba(16,185,129,0.3);">
        <div class="flex items-center gap-sm">
          <i class="fa-solid fa-circle-check" style="color:var(--success);font-size:1.2rem;"></i>
          <span style="color:var(--success);font-weight:600;">All fields filled! Ready to go.</span>
        </div>
      </div>`;
  } else if (blk > 0) {
    infoEl.innerHTML = `
      <div class="card" style="border-color:rgba(245,158,11,0.3);">
        <div class="flex items-center gap-sm">
          <i class="fa-solid fa-circle-info" style="color:var(--warning);font-size:1.2rem;"></i>
          <span style="font-weight:600;">${blk} blank fields detected.</span>
        </div>
      </div>`;
  } else {
    infoEl.innerHTML = "";
  }
}
