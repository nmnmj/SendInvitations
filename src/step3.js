/**
 * Step 3: CSV Upload & Validation
 * Accepts ANY CSV schema — columns become dynamic placeholders.
 * No hardcoded name/phone_number requirement.
 */
import Papa from "papaparse";
import { state, notify } from "./state.js";
import { showToast } from "./toast.js";
import { showConfirm, showPrompt } from "./modal.js";

export function renderStep3() {
  return `
    <div class="row items-stretch gap-lg">
      <div class="col flex-1">
        <div class="card h-full">
          <div class="card-header">
            <div class="card-header-icon pink"><i class="fa-solid fa-file-csv"></i></div>
            <span class="card-title">Upload Guest List</span>
          </div>
          <p class="text-muted mb-lg" style="font-size:0.85rem;">Upload a CSV file or start by defining your fields manually.</p>
          <div class="dropzone h-full" id="csv-dropzone" style="min-height:220px;">
            <span class="dropzone-icon"><i class="fa-solid fa-cloud-arrow-up"></i></span>
            <p class="dropzone-title">Drop CSV file here</p>
            <p class="dropzone-subtitle">or <span class="dropzone-browse" id="csv-browse-trigger">browse</span></p>
            <input type="file" id="csv-file-input" accept=".csv" style="display:none;" />
          </div>
        </div>
      </div>

      <div class="col" style="width:350px;">
        <div class="card h-full" style="border-style:dashed;">
          <div class="card-header">
            <div class="card-header-icon purple"><i class="fa-solid fa-plus"></i></div>
            <span class="card-title">Start Manually</span>
          </div>
          <p class="text-muted mb-lg" style="font-size:0.85rem;">Don't have a CSV? You can define your own columns and add guests one by one.</p>
          <div class="flex flex-column gap-sm">
            <div class="btn btn-secondary w-full" id="manual-fields-btn" role="button" tabindex="-1">
              <i class="fa-solid fa-table-columns"></i> 1. Define Fields
            </div>
            <div class="btn btn-primary w-full" id="manual-add-btn" role="button" tabindex="-1">
              <i class="fa-solid fa-user-plus"></i> 2. Add Your First Guest
            </div>
          </div>


        </div>
      </div>
    </div>


    <div id="csv-info-report" class="mt-lg"></div>

    <!-- Stats slot -->
    <div id="csv-stats-container" class="mt-lg"></div>

    <!-- Actions slot -->
    <div id="csv-actions-container" class="mt-lg"></div>

    <!-- Table slot -->
    <div id="csv-table-container" class="mt-lg"></div>
  `;
}

export function initStep3() {
  const dropzone = document.getElementById("csv-dropzone");
  const fileInput = document.getElementById("csv-file-input");
  const browseTrigger = document.getElementById("csv-browse-trigger");

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
    if (e.dataTransfer.files[0]) handleCSV(e.dataTransfer.files[0]);
  });

  dropzone.addEventListener("click", (e) => {
    if (e.target.id !== "csv-browse-trigger") fileInput.click();
  });
  browseTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleCSV(fileInput.files[0]);
    fileInput.value = "";
  });

  const manualAddBtn = document.getElementById("manual-add-btn");
  const manualFieldsBtn = document.getElementById("manual-fields-btn");

  manualAddBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.csvData.headers.length === 0) {
      state.csvData.headers = ["Name", "Phone", "Table"];
    }
    addRow();
    showResults();
    notify();
  });

  manualFieldsBtn?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const current = state.csvData.headers.join(", ");
    const val = await showPrompt(
      "Enter column headers separated by commas (e.g. Name, Phone, Table):",
      current || "Name, Phone, Table",
      "Define Fields",
    );
    if (val !== null) {
      const newHeaders = val
        .split(",")
        .map((h) => h.trim())
        .filter((h) => h.length > 0);
      if (newHeaders.length > 0) {
        state.csvData.headers = newHeaders;
        if (!state.csvData.phoneHeader) {
          state.csvData.phoneHeader = newHeaders.find((h) =>
            /phone|mobile|number|contact/i.test(h),
          );
        }
        state.csvData.rows.forEach((row) => {
          newHeaders.forEach((h) => {
            if (!(h in row)) row[h] = "";
          });
        });
        showResults();
        notify();
      }
    }
  });

  // Re-render if data already exists (session restore)
  if (state.csvData.rows.length > 0) {
    showResults();
    renderTable();
  }
}

function handleCSV(file) {
  if (!file.name.endsWith(".csv")) {
    showToast("Please upload a .csv file", "error");
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
    complete: (results) => {
      const data = results.data;
      const headers = (results.meta.fields || []).filter((h) => h.length > 0);

      if (headers.length === 0) {
        showToast("CSV has no column headers", "error");
        return;
      }

      // Store in state
      state.csvData.headers = headers;
      // Initialize __sent__ status for each row
      state.csvData.rows = data.map((row) => ({
        ...row,
        __sent__: row.__sent__ || false,
      }));

      // Count blank fields
      state.csvData.blankCount = calculateBlankCount();

      showResults();
      renderTable();
      showToast(
        `CSV loaded: ${data.length} rows, ${headers.length} columns`,
        "success",
      );
      notify();
    },
    error: (err) => {
      showToast(`CSV parse error: ${err.message}`, "error");
    },
  });
}

function showResults() {
  const infoEl = document.getElementById("csv-info-report");
  if (!infoEl) return;

  if (state.csvData.rows.length > 0) {
    const headers = state.csvData.headers || [];
    infoEl.innerHTML = `
      <div class="card" style="border-color:rgba(16,185,129,0.3);">
        <div class="flex items-center gap-sm mb-md">
          <i class="fa-solid fa-circle-check" style="color:var(--success);font-size:1.2rem;"></i>
          <span style="color:var(--success);font-weight:600;">Data loaded successfully!</span>
        </div>
        
        <p class="text-muted mb-sm" style="font-size:0.85rem;"><strong>Variables Detected (${headers.length}):</strong></p>
        <div class="flex gap-xs flex-wrap">
          ${headers
            .map(
              (h) => `
            <span class="px-sm py-xs" style="background:rgba(108, 99, 255, 0.1); color:var(--accent-primary); border-radius:var(--radius-sm); font-size:0.75rem; font-weight:600; border:1px solid rgba(108, 99, 255, 0.2);">
              {{${h}}}
            </span>
          `,
            )
            .join("")}
        </div>
        <p class="text-muted mt-md" style="font-size:0.85rem;">Continue to Step 3 to personalize and send.</p>
      </div>`;

    // Render stats
    const statsEl = document.getElementById("csv-stats-container");
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="csv-stats">
          <div class="stat-card">
            <div class="stat-value purple" id="stat-total">${state.csvData.rows.length}</div>
            <div class="stat-label">Total Rows</div>
          </div>
          <div class="stat-card">
            <div class="stat-value green" id="stat-valid">${state.csvData.rows.length}</div>
            <div class="stat-label">Valid Entries</div>
          </div>
          <div class="stat-card">
            <div class="stat-value purple" id="stat-columns">${headers.length}</div>
            <div class="stat-label">Columns</div>
          </div>
          <div class="stat-card">
            <div class="stat-value orange" id="stat-blanks">${state.csvData.blankCount || 0}</div>
            <div class="stat-label">Blank Fields</div>
          </div>
        </div>
      `;
    }

    // Render actions
    const actionsEl = document.getElementById("csv-actions-container");
    if (actionsEl) {
      actionsEl.innerHTML = `
        <div class="flex gap-sm flex-wrap mt-lg border-t pt-lg" id="csv-actions">
          <div class="btn btn-outline" id="add-row-manual-btn-s2"><i class="fa-solid fa-plus"></i> Add One Guest</div>
          <div class="btn btn-success" id="download-csv-btn-s2"><i class="fa-solid fa-download"></i> Download CSV</div>
          <div class="flex items-center gap-sm px-md py-xs" style="background:var(--bg-input); border-radius:var(--radius-md); border:1px solid var(--border-color);">
            <label class="flex items-center gap-xs cursor-pointer" style="font-size:0.85rem; user-select:none;">
              <input type="checkbox" id="hindi-mode-toggle-s2" style="width:16px; height:16px; accent-color:var(--accent-primary);" ${state.csvData.hindiMode ? "checked" : ""}>
              <span>Hindi Input Mode</span>
            </label>
          </div>
          <div class="btn btn-danger" id="clear-csv-btn-s2"><i class="fa-solid fa-trash"></i> Clear Data</div>
        </div>
      `;
      // Listeners
      document
        .getElementById("add-row-manual-btn-s2")
        ?.addEventListener("click", () => {
          addRow();
          renderTable();
          notify();
        });
      document
        .getElementById("download-csv-btn-s2")
        ?.addEventListener("click", downloadCSV);
      document
        .getElementById("clear-csv-btn-s2")
        ?.addEventListener("click", clearCSV);
      document
        .getElementById("hindi-mode-toggle-s2")
        ?.addEventListener("change", (e) => {
          state.csvData.hindiMode = e.target.checked;
          notify();
        });
    }
  } else {
    infoEl.innerHTML = "";
    const statsEl = document.getElementById("csv-stats-container");
    const actionsEl = document.getElementById("csv-actions-container");
    const tableEl = document.getElementById("csv-table-container");
    if (statsEl) statsEl.innerHTML = "";
    if (actionsEl) actionsEl.innerHTML = "";
    if (tableEl) tableEl.innerHTML = "";
  }
}

function renderTable() {
  const { headers, rows } = state.csvData;
  const container = document.getElementById("csv-table-container");
  if (!container || rows.length === 0) return;

  container.innerHTML = `
    <div class="csv-table-wrap" style="max-height: 500px; overflow-y: auto; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
      <table class="csv-table">
        <thead>
          <tr>
            <th>#</th>
            <th title="Manual Sent Status">Sent</th>
            ${headers.map((h) => `<th>{{${h}}}</th>`).join("")}
            <th style="text-align:right;">Delete</th>
          </tr>
        </thead>
        <tbody id="csv-table-body-s2"></tbody>
      </table>
    </div>
  `;

  const tbody = document.getElementById("csv-table-body-s2");
  tbody.innerHTML = rows
    .map((row, i) => {
      const isSent = row.__sent__ === true;
      return `<tr class="${isSent ? "row-sent" : ""}">
        <td>${i + 1}</td>
        <td>
          <input type="checkbox" class="row-sent-checkbox-s2" data-index="${i}" ${isSent ? "checked" : ""}>
        </td>
        ${headers
          .map((h) => {
            const val = row[h] || "";
            const isBlank = val.toString().trim() === "";
            return `<td contenteditable="true" class="csv-cell-s2" data-header="${h}" data-index="${i}" ${isBlank ? 'style="color:var(--text-muted);font-style:italic;"' : ""}>${isBlank ? "" : val}</td>`;
          })
          .join("")}
        <td style="text-align:right;">
           <button class="btn btn-sm csv-delete-row-btn-s2" data-index="${i}" style="background:transparent; border:none; color:var(--danger); padding:4px;" title="Delete Row">
             <i class="fa-solid fa-trash"></i>
           </button>
        </td>
      </tr>`;
    })
    .join("");

  // Listeners
  document.querySelectorAll(".csv-cell-s2").forEach((cell) => {
    cell.addEventListener("keydown", async (e) => {
      if (!state.csvData.hindiMode) return;
      if (e.key === " " || e.key === "Enter") {
        e.stopImmediatePropagation();
        await handleTransliteration(
          e,
          e.key === "Enter" ? "Enter" : "Space",
          cell,
        );
      }
    });

    cell.addEventListener("input", (e) => {
      const idx = cell.dataset.index;
      const header = cell.dataset.header;
      state.csvData.rows[idx][header] = cell.innerText.trim();
      notify();
    });

    cell.addEventListener("blur", (e) => {
      const idx = e.target.dataset.index;
      const header = e.target.dataset.header;
      const val = e.target.innerText.trim();
      state.csvData.rows[idx][header] = val;
      state.csvData.blankCount = calculateBlankCount();
      notify();
      showResults(); // refresh stats
    });
  });

  document.querySelectorAll(".csv-delete-row-btn-s2").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      state.csvData.rows.splice(idx, 1);
      renderTable();
      showResults();
      notify();
    });
  });

  document.querySelectorAll(".row-sent-checkbox-s2").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const idx = parseInt(e.target.dataset.index);
      state.csvData.rows[idx].__sent__ = e.target.checked;
      const tr = e.target.closest("tr");
      if (tr) {
        if (e.target.checked) tr.classList.add("row-sent");
        else tr.classList.remove("row-sent");
      }
      notify();
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

  const textBefore = text.substring(0, pos);
  const lastWordMatch = textBefore.match(/(\S+)$/);

  if (lastWordMatch) {
    if (e.type === "keydown") e.preventDefault();
    const word = lastWordMatch[1];
    const start = lastWordMatch.index;
    try {
      const hindiWord = await transliterateWord(word);
      const extra = isManualKey === "Enter" ? "\n" : " ";
      const newText =
        text.substring(0, start) + hindiWord + extra + text.substring(pos);
      node.textContent = newText;
      const newRange = document.createRange();
      newRange.setStart(node, start + hindiWord.length + 1);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      const idx = cell.dataset.index;
      const header = cell.dataset.header;
      state.csvData.rows[idx][header] = node.textContent;
      state.csvData.blankCount = calculateBlankCount();
      notify();
    } catch (err) {
      console.error(err);
    }
  }
}

function downloadCSV() {
  const { headers, rows } = state.csvData;
  if (rows.length === 0) return;
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
  notify();
  renderStep3(); // Full refresh
  showToast("Guest data cleared", "success");
}

function addRow() {
  const { headers } = state.csvData;
  const newRow = { __sent__: false };
  headers.forEach((h) => (newRow[h] = ""));
  state.csvData.rows.push(newRow);
  state.csvData.blankCount = calculateBlankCount();
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

async function transliterateWord(word) {
  if (!word) return "";
  // Check if word contains any English alphabets. If not, no need to transliterate.
  if (!/[a-zA-Z]/.test(word)) return word;

  const url = `https://inputtools.google.com/request?itc=hi-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=test&text=${encodeURIComponent(word)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data[0] === "SUCCESS") {
    return data[1][0][1][0]; // Extract the first suggestion
  }
  return word;
}
