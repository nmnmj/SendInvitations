/**
 * Step 1: Image Upload & Management
 */
import Sortable from "sortablejs";
import { state, notify } from "./state.js";
import { showToast } from "./toast.js";

let sortableInstance = null;

export function renderStep1() {
  return `
    <div class="section-header">
      <h1 class="section-title">Upload Your Invitation Images</h1>
      <p class="section-subtitle">Drag and drop your images below or click to browse. Reorder them to set the page sequence in your PDF.</p>
    </div>

    <!-- Drop zone -->
    <div class="dropzone" id="image-dropzone">
      <span class="dropzone-icon"><i class="fa-solid fa-cloud-arrow-up"></i></span>
      <p class="dropzone-title">Drop images here</p>
      <p class="dropzone-subtitle">or <span class="dropzone-browse" id="browse-trigger">browse files</span> — JPEG, PNG supported</p>
      <input type="file" id="image-file-input" multiple accept="image/jpeg,image/png" style="display:none;" />
    </div>

    <!-- Image grid -->
    <div class="image-grid" id="image-grid"></div>

    <!-- PDF Settings -->
    <div class="settings-grid mt-xl" id="pdf-settings-panel" style="${state.images.length ? "" : "display:none"}">
      <div class="card">
        <div class="card-header">
          <div class="card-header-icon purple"><i class="fa-solid fa-file-pdf"></i></div>
          <span class="card-title">Page Settings</span>
        </div>
        <div class="form-group">
          <label class="form-label">Page Size</label>
          <select class="form-select" id="page-size-select">
            <option value="A4" ${state.pdfSettings.pageSize === "A4" ? "selected" : ""}>A4 (210 × 297 mm)</option>
            <option value="Letter" ${state.pdfSettings.pageSize === "Letter" ? "selected" : ""}>Letter (8.5 × 11 in)</option>
            <option value="Custom" ${state.pdfSettings.pageSize === "Custom" ? "selected" : ""}>Custom Size</option>
          </select>
        </div>
        <div class="settings-row ${state.pdfSettings.pageSize === "Custom" ? "" : "hidden"}" id="custom-size-row">
          <div class="form-group">
            <label class="form-label">Width (mm)</label>
            <input type="number" class="form-input" id="custom-width" value="${state.pdfSettings.customWidth}" min="50" max="1000" />
          </div>
          <div class="form-group">
            <label class="form-label">Height (mm)</label>
            <input type="number" class="form-input" id="custom-height" value="${state.pdfSettings.customHeight}" min="50" max="1000" />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-header-icon pink"><i class="fa-solid fa-arrows-rotate"></i></div>
          <span class="card-title">Image Options</span>
        </div>
        <div class="form-group">
          <label class="form-label">Orientation</label>
          <select class="form-select" id="orientation-select">
            <option value="auto" ${state.pdfSettings.orientation === "auto" ? "selected" : ""}>Auto-detect</option>
            <option value="portrait" ${state.pdfSettings.orientation === "portrait" ? "selected" : ""}>Portrait</option>
            <option value="landscape" ${state.pdfSettings.orientation === "landscape" ? "selected" : ""}>Landscape</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Scaling Mode</label>
          <select class="form-select" id="scaling-select">
            <option value="fit" ${state.pdfSettings.scaling === "fit" ? "selected" : ""}>Fit (preserve ratio, may have margins)</option>
            <option value="fill" ${state.pdfSettings.scaling === "fill" ? "selected" : ""}>Fill (preserve ratio, may crop)</option>
            <option value="stretch" ${state.pdfSettings.scaling === "stretch" ? "selected" : ""}>Stretch (fill page exactly)</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

export function initStep1() {
  const dropzone = document.getElementById("image-dropzone");
  const fileInput = document.getElementById("image-file-input");
  const browseTrigger = document.getElementById("browse-trigger");
  const grid = document.getElementById("image-grid");

  // Drag & Drop
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });
  dropzone.addEventListener("dragleave", () =>
    dropzone.classList.remove("drag-over"),
  );
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
  });

  dropzone.addEventListener("click", (e) => {
    if (e.target.id !== "browse-trigger") fileInput.click();
  });
  browseTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    handleFiles(fileInput.files);
    fileInput.value = "";
  });

  // Settings listeners
  document
    .getElementById("page-size-select")
    .addEventListener("change", (e) => {
      state.pdfSettings.pageSize = e.target.value;
      document
        .getElementById("custom-size-row")
        .classList.toggle("hidden", e.target.value !== "Custom");
      notify();
    });
  document
    .getElementById("orientation-select")
    .addEventListener("change", (e) => {
      state.pdfSettings.orientation = e.target.value;
      notify();
    });
  document.getElementById("scaling-select").addEventListener("change", (e) => {
    state.pdfSettings.scaling = e.target.value;
    notify();
  });
  document.getElementById("custom-width")?.addEventListener("input", (e) => {
    state.pdfSettings.customWidth = parseInt(e.target.value) || 210;
    notify();
  });
  document.getElementById("custom-height")?.addEventListener("input", (e) => {
    state.pdfSettings.customHeight = parseInt(e.target.value) || 297;
    notify();
  });

  // Sortable
  if (grid) {
    sortableInstance = Sortable.create(grid, {
      animation: 250,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      onEnd: (evt) => {
        const moved = state.images.splice(evt.oldIndex, 1)[0];
        state.images.splice(evt.newIndex, 0, moved);
        renderGrid();
        notify();
      },
    });
  }

  renderGrid();
}

function handleFiles(fileList) {
  const validTypes = ["image/jpeg", "image/png"];
  let added = 0;
  const promises = [];
  for (const file of fileList) {
    if (!validTypes.includes(file.type)) {
      showToast(`Skipped "${file.name}" — only JPEG/PNG allowed`, "warning");
      continue;
    }
    promises.push(loadImage(file));
    added++;
  }
  Promise.all(promises).then(() => {
    renderGrid();
    if (added > 0) {
      showToast(`${added} image${added > 1 ? "s" : ""} added`, "success");
      document.getElementById("pdf-settings-panel").style.display = "";
    }
    notify();
  });
}

function loadImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        state.images.push({
          id: crypto.randomUUID(),
          file,
          url: e.target.result,
          name: file.name,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        resolve();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderGrid() {
  const grid = document.getElementById("image-grid");
  if (!grid) return;
  grid.innerHTML = state.images
    .map(
      (img, i) => `
    <div class="image-card" data-id="${img.id}">
      <div class="image-card-badge">${i + 1}</div>
      <img src="${img.url}" alt="${img.name}" loading="lazy" />
      <div class="image-card-overlay">
        <div></div>
        <div class="image-card-actions">
          <button class="btn-delete" data-id="${img.id}" title="Remove image"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>
  `,
    )
    .join("");

  // Delete handlers
  grid.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      state.images = state.images.filter((img) => img.id !== id);
      renderGrid();
      if (state.images.length === 0) {
        document.getElementById("pdf-settings-panel").style.display = "none";
      }
      showToast("Image removed", "info");
      notify();
    });
  });
}
