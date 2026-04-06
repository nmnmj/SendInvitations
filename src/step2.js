/**
 * Step 2: Dynamic Personalization — Placeholders & Text Overlays
 * Interlinked with CSV: shows detected CSV columns as available variables.
 */
import { state, notify } from "./state.js";
import { showToast } from "./toast.js";

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
        <p class="empty-state-text">Please upload images in Step 1 first</p>
      </div>
    `;
  }

  // Determine which CSV columns are available but not yet added as placeholders
  const csvHeaders = state.csvData.headers || [];
  const existingKeys = state.placeholders.map((p) => p.key);
  const availableFromCSV = csvHeaders.filter((h) => !existingKeys.includes(h));

  return `
    <div class="section-header">
      <h1 class="section-title">Personalize Your Invitations</h1>
      <p class="section-subtitle">Add dynamic placeholders and position them on your pages. Each placeholder maps to a CSV column.</p>
    </div>

    <!-- CSV columns quick-add -->
    ${
      csvHeaders.length > 0
        ? `
    <div class="card mb-lg" style="border-color:rgba(59,130,246,0.3);">
      <div class="card-header">
        <div class="card-header-icon blue"><i class="fa-solid fa-link"></i></div>
        <span class="card-title">CSV Variables Available</span>
      </div>
      <p class="text-muted mb-md" style="font-size:0.85rem;">
        Columns from your uploaded CSV. Click to add as a placeholder:
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
    <div class="card mb-lg" style="border-color:rgba(245,158,11,0.3);">
      <div class="card-header">
        <div class="card-header-icon orange"><i class="fa-solid fa-circle-info"></i></div>
        <span class="card-title">No CSV Uploaded Yet</span>
      </div>
      <p class="text-muted" style="font-size:0.85rem;">
        Upload a CSV in Step 3 to auto-detect column variables, or manually add placeholders below.
      </p>
    </div>
    `
    }

    <!-- Manual add placeholder -->
    <div class="card mb-lg">
      <div class="card-header">
        <div class="card-header-icon purple"><i class="fa-solid fa-plus"></i></div>
        <span class="card-title">Add Custom Placeholder</span>
      </div>
      <div class="flex gap-sm flex-wrap items-center">
        <input type="text" class="form-input" id="new-placeholder-key" placeholder="e.g. f1, name, event" style="max-width:250px;" />
        <button class="btn btn-primary" id="add-placeholder-btn"><i class="fa-solid fa-plus"></i> Add</button>
      </div>
    </div>

    <!-- Placeholder list -->
    <div class="placeholder-list" id="placeholder-list"></div>

    <!-- Preview -->
    <div class="preview-container mt-xl" id="preview-section" style="${state.placeholders.length ? "" : "display:none"}">
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
          <p class="text-muted" style="font-size:0.8rem;">Placeholders on current page:</p>
          <div id="page-overlay-list" class="mt-md"></div>
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
  document.getElementById("preview-section").style.display = "";
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
      if (state.placeholders.length === 0) {
        document.getElementById("preview-section").style.display = "none";
      }
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
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
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

    if (Math.hypot(mx - trX, my - trY) <= 12) {
      resizeTarget = p;
      initialResizeFontSize = p.fontSize;
      initialResizeMouseY = my;
      canvas.style.cursor = "nesw-resize";
      return;
    }

    const hitH = scaledSize + 16;
    const hitW = scaledSize * text.length * 0.7 + 40;

    let hitX = px;
    if (p.alignment === "center") hitX = px - hitW / 2;
    else if (p.alignment === "right") hitX = px - hitW;

    if (
      mx >= hitX &&
      mx <= hitX + hitW &&
      my >= py - hitH / 2 &&
      my <= py + hitH / 2
    ) {
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
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
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
