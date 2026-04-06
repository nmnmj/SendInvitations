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


    <!-- Detected columns display -->
    <div class="card mt-lg" id="csv-columns-card" style="display:none;">
      <div class="card-header">
        <div class="card-header-icon blue"><i class="fa-solid fa-table-columns"></i></div>
        <span class="card-title">Detected Columns / Variables</span>
        <div style="flex:1;"></div>
        <button class="btn btn-sm" id="edit-headers-btn" style="padding: 4px 8px; font-size: 0.7rem; background: var(--bg-input); color: var(--text-muted);">
          <i class="fa-solid fa-gear"></i> Edit Columns
        </button>
      </div>
      <p class="text-muted mb-md" style="font-size:0.85rem;">These will be available as <strong>{{placeholder}}</strong> variables in the personalization step.</p>
      <div class="page-pills" id="csv-columns-pills"></div>
      
      <div class="mt-lg p-md" style="background:rgba(37,211,102,0.05); border:1px solid rgba(37,211,102,0.2); border-radius:var(--radius-md);">
        <div class="flex items-center gap-sm mb-sm">
          <i class="fa-brands fa-whatsapp" style="color:#25D366; font-size:1.1rem;"></i>
          <span style="font-weight:600; font-size:0.9rem;">WhatsApp Suite</span>
        </div>
        
        <div class="flex gap-md flex-wrap">
          <div style="flex: 1; min-width: 250px;">
            <p class="text-muted mb-xs" style="font-size:0.8rem;"><strong>1. Select Phone Column</strong></p>
            <select class="form-select" id="phone-column-dropdown" style="border-color:rgba(37,211,102,0.3); background:var(--bg-card); font-size: 0.85rem;">
              <option value="">-- Choose Column --</option>
            </select>
          </div>
          
          <div style="flex: 2; min-width: 300px;">
            <p class="text-muted mb-xs" style="font-size:0.8rem;"><strong>2. Customize WhatsApp Message</strong></p>
            <textarea class="form-input" id="whatsapp-message-template" rows="2" style="font-size: 0.85rem; border-color:rgba(37,211,102,0.3); background:var(--bg-card); resize: vertical;" placeholder="e.g. Hello {{Name}}, check out your invite!"></textarea>
            <div id="variable-shortcuts" class="flex gap-xs flex-wrap mt-xs"></div>
          </div>
        </div>
      </div>
      <div class="mt-md">
        <button class="btn btn-sm btn-outline" id="add-column-btn" style="font-size: 0.7rem; border-style: dashed; padding: 4px 10px; border-color: var(--accent-primary-light); color: var(--accent-primary-light);">
          <i class="fa-solid fa-plus"></i> Add New Column
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="csv-stats" id="csv-stats" style="display:none;">
      <div class="stat-card">
        <div class="stat-value purple" id="stat-total">0</div>
        <div class="stat-label">Total Rows</div>
      </div>
      <div class="stat-card">
        <div class="stat-value green" id="stat-valid">0</div>
        <div class="stat-label">Valid Entries</div>
      </div>
      <div class="stat-card">
        <div class="stat-value purple" id="stat-columns">0</div>
        <div class="stat-label">Columns</div>
      </div>
      <div class="stat-card">
        <div class="stat-value orange" id="stat-blanks">0</div>
        <div class="stat-label">Blank Fields</div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-sm flex-wrap mt-lg" id="csv-actions" style="display:none;">
      <div class="btn btn-success" id="download-csv-btn" role="button" tabindex="-1"><i class="fa-solid fa-download"></i> Download CSV</div>
      <div class="flex items-center gap-sm px-md py-xs" style="background:var(--bg-input); border-radius:var(--radius-md); border:1px solid var(--border-color);">
        <label class="flex items-center gap-xs cursor-pointer" style="font-size:0.85rem; user-select:none;">
          <input type="checkbox" id="hindi-mode-toggle" tabindex="-1" style="width:16px; height:16px; accent-color:var(--accent-primary);" ${state.csvData.hindiMode ? "checked" : ""}>
          <span>Hindi Input Mode</span>
        </label>
        <span class="hint-btn" title="When ON, your typing (English) into cells will automatically convert to Hindi Devnagri script when you hit Space."><i class="fa-solid fa-circle-question" style="opacity:0.5; font-size:0.9rem;"></i></span>
      </div>
      <div class="btn btn-accent" id="send-all-wa-btn" style="background:#25D366; color:white;" role="button" tabindex="-1"><i class="fa-brands fa-whatsapp"></i> Send All to WhatsApp</div>
      <div id="wa-batch-status-inline" class="flex items-center gap-sm mt-sm" style="font-size:0.75rem; color:var(--text-muted);"></div>
      <div class="btn btn-danger" id="clear-csv-btn" role="button" tabindex="-1"><i class="fa-solid fa-trash"></i> Clear Data</div>
    </div>



    <!-- Info report -->
    <div id="csv-info-report" class="mt-lg"></div>

    <!-- Table -->
    <div class="csv-table-wrap mt-lg" id="csv-table-wrap" style="display:none; max-height: 500px; overflow-y: auto;">
      <table class="csv-table" id="csv-table">
        <thead><tr id="csv-table-head"></tr></thead>
        <tbody id="csv-table-body"></tbody>
      </table>
    </div>
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
    // Add one empty row
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
        // Auto-set phone header if it looks like phone
        if (!state.csvData.phoneHeader) {
          state.csvData.phoneHeader = newHeaders.find((h) =>
            /phone|mobile|number|contact/i.test(h),
          );
        }

        // If we have rows, update those rows to include the new/modified headers
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

  document
    .getElementById("phone-column-dropdown")
    ?.addEventListener("change", (e) => {
      state.csvData.phoneHeader = e.target.value || null;
      renderTable();
      notify();
      if (state.csvData.phoneHeader) {
        showToast(
          `Phone number column set to: ${state.csvData.phoneHeader}`,
          "success",
        );
      }
    });

  const msgTemplateInput = document.getElementById("whatsapp-message-template");
  if (msgTemplateInput) {
    msgTemplateInput.value = state.csvData.whatsappMessageTemplate || "";
    msgTemplateInput.addEventListener("input", (e) => {
      state.csvData.whatsappMessageTemplate = e.target.value;
      notify();
    });
  }

  document
    .getElementById("add-column-btn")
    ?.addEventListener("click", async () => {
      const val = await showPrompt("Enter new column name:", "", "Add Column");
      if (val && val.trim().length > 0) {
        const h = val.trim();
        if (!state.csvData.headers.includes(h)) {
          state.csvData.headers.push(h);
          state.csvData.rows.forEach((row) => (row[h] = ""));
          showResults();
          notify();
        } else {
          showToast("Column already exists", "warning");
        }
      }
    });

  document
    .getElementById("edit-headers-btn")
    ?.addEventListener("click", async () => {
      const current = state.csvData.headers.join(", ");
      const val = await showPrompt(
        "Enter column headers separated by commas:",
        current,
        "Edit Column Headers",
      );
      if (val !== null) {
        const newHeaders = val
          .split(",")
          .map((h) => h.trim())
          .filter((h) => h.length > 0);
        if (newHeaders.length > 0) {
          state.csvData.headers = newHeaders;
          showResults();
          notify();
        }
      }
    });

  document
    .getElementById("download-csv-btn")
    ?.addEventListener("click", downloadCSV);
  document
    .getElementById("send-all-wa-btn")
    ?.addEventListener("click", sendAllToWhatsApp);
  document.getElementById("clear-csv-btn")?.addEventListener("click", clearCSV);

  // Hindi Mode toggle listener
  const hindiToggle = document.getElementById("hindi-mode-toggle");
  hindiToggle?.addEventListener("change", (e) => {
    state.csvData.hindiMode = e.target.checked;
    notify();
  });

  // Re-render if data already exists (session restore)
  if (state.csvData.rows.length > 0) {
    showResults();
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
  state.csvData.blankCount = calculateBlankCount();
  const { headers, rows, blankCount } = state.csvData;

  // Show columns card
  const colCard = document.getElementById("csv-columns-card");
  colCard.style.display = "";
  document.getElementById("csv-columns-pills").innerHTML = headers
    .map(
      (h) => `
      <span class="page-pill ${h === state.csvData.phoneHeader ? "active" : ""}" style="cursor:pointer; ${h === state.csvData.phoneHeader ? "background:var(--success); border-color:var(--success);" : ""}" onclick="document.dispatchEvent(new CustomEvent('set-phone-header', {detail: '${h}'})) ">
        ${h === state.csvData.phoneHeader ? '<i class="fa-solid fa-phone"></i> ' : ""}{{${h}}}
      </span>`,
    )
    .join("");

  // Update shortcuts
  const shortcuts = document.getElementById("variable-shortcuts");
  if (shortcuts) {
    shortcuts.innerHTML = headers
      .map(
        (h) => `
      <button class="btn btn-sm btn-outline" style="font-size:0.65rem; padding: 2px 6px; border-color:rgba(108, 99, 255, 0.2); color:var(--text-muted);" onclick="document.dispatchEvent(new CustomEvent('insert-message-variable', {detail: '{{${h}}}'}))">
        + {{${h}}}
      </button>`,
      )
      .join("");
  }

  // Handle template shortcuts
  document.addEventListener(
    "insert-message-variable",
    (e) => {
      const input = document.getElementById("whatsapp-message-template");
      if (input) {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        const before = text.substring(0, start);
        const after = text.substring(end);
        input.value = before + e.detail + after;
        state.csvData.whatsappMessageTemplate = input.value;
        input.focus();
        input.setSelectionRange(
          start + e.detail.length,
          start + e.detail.length,
        );
        notify();
      }
    },
    { once: true },
  );

  // Update phone dropdown
  const dropdown = document.getElementById("phone-column-dropdown");
  if (dropdown) {
    // Attempt auto-fill if not set
    if (!state.csvData.phoneHeader) {
      state.csvData.phoneHeader = headers.find((h) =>
        /phone|mobile|number|contact/i.test(h),
      );
    }

    dropdown.innerHTML =
      '<option value="">-- Choose Column --</option>' +
      headers
        .map(
          (h) =>
            `<option value="${h}" ${h === state.csvData.phoneHeader ? "selected" : ""}>${h}</option>`,
        )
        .join("");
  }

  // Listen for custom event from pill click
  document.addEventListener(
    "set-phone-header",
    (e) => {
      state.csvData.phoneHeader = e.detail;
      showResults();
      notify();
    },
    { once: true },
  );

  // Stats
  document.getElementById("csv-stats").style.display = "";
  document.getElementById("csv-actions").style.display = "";
  document.getElementById("csv-table-wrap").style.display = "";

  // Add Row button if it doesn't exist
  if (!document.getElementById("add-row-manual-btn")) {
    const act = document.getElementById("csv-actions");
    const addBtn = document.createElement("div");
    addBtn.className = "btn btn-outline";
    addBtn.id = "add-row-manual-btn";
    addBtn.role = "button";
    addBtn.tabIndex = -1;
    addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Add One Guest`;

    addBtn.onclick = () => {
      addRow();
      renderTable();
      notify();
    };
    act.prepend(addBtn);
  }

  document.getElementById("stat-total").textContent = rows.length;
  document.getElementById("stat-valid").textContent = rows.length;
  document.getElementById("stat-columns").textContent = headers.length;
  document.getElementById("stat-blanks").textContent = blankCount || 0;

  // Info
  const infoEl = document.getElementById("csv-info-report");
  const blk = blankCount || 0;
  if (blk === 0) {
    infoEl.innerHTML = `
      <div class="card" style="border-color:rgba(16,185,129,0.3);">
        <div class="flex items-center gap-sm">
          <i class="fa-solid fa-circle-check" style="color:var(--success);font-size:1.2rem;"></i>
          <span style="color:var(--success);font-weight:600;">All fields filled! Ready to generate invitations.</span>
        </div>
      </div>`;
  } else {
    infoEl.innerHTML = `
      <div class="card" style="border-color:rgba(245,158,11,0.3);">
        <div class="flex items-center gap-sm mb-md">
          <i class="fa-solid fa-circle-info" style="color:var(--warning);font-size:1.2rem;"></i>
          <span style="font-weight:600;">${blk} blank field${blk !== 1 ? "s" : ""} detected</span>
        </div>
        <p class="text-muted" style="font-size:0.85rem;">
          Blank fields will be left empty on the generated PDF. This is perfectly fine for optional fields.
        </p>
      </div>`;
  }

  // Table
  renderTable();
}

export function renderTable() {
  const { headers, rows } = state.csvData;
  const thead = document.getElementById("csv-table-head");
  const tbody = document.getElementById("csv-table-body");
  if (!thead || !tbody) return;

  // Update stats that might have changed
  const totalEl = document.getElementById("stat-total");
  if (totalEl) totalEl.textContent = rows.length;
  const validEl = document.getElementById("stat-valid");
  if (validEl) validEl.textContent = rows.length;

  thead.innerHTML = `<th>#</th><th title="Manual Sent Status">Sent</th>${headers.map((h) => `<th>{{${h}}}</th>`).join("")}<th style="text-align:right;">Quick Share / Delete</th>`;

  tbody.innerHTML = rows
    .map((row, i) => {
      const isSent = row.__sent__ === true;
      let phoneTxt = "";

      if (state.csvData.phoneHeader) {
        phoneTxt = (row[state.csvData.phoneHeader] || "").toString().trim();
      } else {
        // Fallback auto-detection if no explicit header
        for (const h of headers) {
          const val = (row[h] || "").toString().trim();
          if (val.replace(/[^0-9]/g, "").length >= 10) {
            phoneTxt = val;
            break;
          }
        }
      }

      // Format for WhatsApp: Remove all non-digits, keep leading + if present
      phoneTxt = phoneTxt.replace(/[^0-9+]/g, "");

      // Handle Indian context: if 10 digits, prefix with 91
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

  // Add cell edit listeners
  document.querySelectorAll(".csv-cell").forEach((cell) => {
    // Shared transliteration logic
    const handleTransliteration = async (e, isManualKey) => {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const node = range.startContainer;

      // Find the word before the cursor
      const text = node.textContent || "";
      const pos = range.startOffset;

      // If triggered by 'input' event, the space/newline is already at pos-1
      const isInputInserted = e.type === "input";
      const lookbackPos = isInputInserted ? pos - 1 : pos;

      const textBefore = text.substring(0, lookbackPos);

      // Check if there's a word to transliterate
      const lastWordMatch = textBefore.match(/(\S+)$/);

      if (lastWordMatch) {
        // If keydown, we prevent default to control character insertion
        if (e.type === "keydown") e.preventDefault();

        const word = lastWordMatch[1];
        const start = lastWordMatch.index;

        try {
          const hindiWord = await transliterateWord(word);

          // If no change, just continue (avoids unnecessary cursor jumping)
          if (hindiWord === word) {
            if (e.type === "keydown") {
              const extra = isManualKey === "Enter" ? "\n" : " ";
              const newText =
                text.substring(0, pos) + extra + text.substring(pos);
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

          let newText;
          if (isInputInserted) {
            // Already has the space/newline inserted by the browser
            // We just need to replace the word part
            newText =
              text.substring(0, start) +
              hindiWord +
              text.substring(lookbackPos);
          } else {
            // Keydown, we need to add the extra char ourselves
            newText =
              text.substring(0, start) +
              hindiWord +
              extra +
              text.substring(pos);
          }

          node.textContent = newText;

          // Restore cursor
          const newRange = document.createRange();
          const newPos =
            start +
            hindiWord.length +
            (isInputInserted ? pos - lookbackPos : 1);
          newRange.setStart(node, Math.min(newPos, node.textContent.length));
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);

          // Update state
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
    };

    cell.addEventListener("keydown", async (e) => {
      if (!state.csvData.hindiMode) return;
      cell._keyboardHandled = false;

      const isSpace = e.key === " " || e.keyCode === 32;
      const isEnter = e.key === "Enter" || e.keyCode === 13;

      if (isSpace || isEnter) {
        // Detect Standard Keyboard (not IME/Mobile)
        if (e.key !== "Unidentified" && e.keyCode !== 229) {
          cell._keyboardHandled = true;
          e.stopImmediatePropagation();
          await handleTransliteration(e, isEnter ? "Enter" : "Space");
        }
      }
    });

    cell.addEventListener("input", async (e) => {
      if (!state.csvData.hindiMode) return;

      // Standard space or Enter on mobile/IME
      const isSpace = e.data === " ";
      const isEnter =
        e.inputType === "insertParagraph" || e.inputType === "insertLineBreak";

      if (isSpace || isEnter) {
        // If it was already handled by keydown (Desktop), skip it in input event
        if (cell._keyboardHandled) {
          cell._keyboardHandled = false;
          return;
        }
        e.stopImmediatePropagation();
        await handleTransliteration(e, isEnter ? "Enter" : "Space");
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
      // Style update if blank
      if (val === "") {
        e.target.style.color = "var(--text-muted)";
        e.target.style.fontStyle = "italic";
        e.target.innerText = "";
      } else {
        e.target.style.color = "";
        e.target.style.fontStyle = "";
      }
    });
  });

  // Delete row listener
  document.querySelectorAll(".csv-delete-row-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      state.csvData.rows.splice(idx, 1);
      renderTable();
      notify();
    });
  });

  // Add listeners for Sent checkboxes
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
        import("./state.js").then(({ notify }) => notify());
      }
    });
  });

  document.querySelectorAll(".wa-quick-send-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const tempBtn = e.currentTarget;
      const idx = parseInt(tempBtn.dataset.index);
      const phone = tempBtn.dataset.phone;

      if (!phone || phone.length < 10) {
        import("./toast.js").then(({ showToast }) =>
          showToast("No valid phone number for this row", "error"),
        );
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
          import("./state.js").then(({ notify }) => notify());
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

        // Revert sent status on failure
        const row = state.csvData.rows[idx];
        if (row) {
          row.__sent__ = false;
          const cb = document.querySelector(
            `.row-sent-checkbox[data-index="${idx}"]`,
          );
          if (cb) cb.checked = false;
          const tr = tempBtn.closest("tr");
          if (tr) tr.classList.remove("row-sent");
          import("./state.js").then(({ notify }) => notify());
        }
        console.error(err);
      }
    });
  });
}

function downloadCSV() {
  const { headers, rows } = state.csvData;
  if (rows.length === 0) {
    showToast("No data to download", "warning");
    return;
  }
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
  showToast("CSV downloaded", "success");
}

async function sendAllToWhatsApp() {
  const { rows, headers } = state.csvData;
  if (!rows.length) return;

  const btn = document.getElementById("send-all-wa-btn");
  const originalHTML = btn.innerHTML;

  const pendingRows = rows.filter((r) => !r.__sent__);
  if (pendingRows.length === 0) {
    import("./toast.js").then(({ showToast }) =>
      showToast("All guests have already been sent invitations.", "info"),
    );
    return;
  }

  const confirmed = await showConfirm(
    `Are you sure you want to send ${pendingRows.length} invitations? \n\nA 3s delay will be added between each to prevent spam flags.`,
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

    // Find phone number
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

    // Format for WhatsApp
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

      // Update the table button for this row to "Sent" if possible
      const rowBtns = document.querySelectorAll(
        `.wa-quick-send-btn[data-index="${i}"]`,
      );
      rowBtns.forEach((rb) => {
        rb.innerHTML = `<i class="fa-solid fa-check"></i> Sent`;
        rb.style.background = "#059669";
      });

      // Update sent status in state and UI
      state.csvData.rows[i].__sent__ = true;
      const cb = document.querySelector(
        `.row-sent-checkbox[data-index="${i}"]`,
      );
      if (cb) cb.checked = true;
      const tr = document
        .querySelector(`.row-sent-checkbox[data-index="${i}"]`)
        ?.closest("tr");
      if (tr) tr.classList.add("row-sent");
      import("./state.js").then(({ notify }) => notify());
    } catch (err) {
      console.error(`Batch send failed for row ${i + 1}:`, err);
      failCount++;

      // Update the table button for this row to "Fail"
      const rowBtns = document.querySelectorAll(
        `.wa-quick-send-btn[data-index="${i}"]`,
      );
      rowBtns.forEach((rb) => {
        rb.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Fail`;
        rb.style.background = "#dc2626";
        rb.style.opacity = "1";
      });

      // Ensure sent status is false on failure
      const row = state.csvData.rows[i];
      if (row) {
        row.__sent__ = false;
        const cb = document.querySelector(
          `.row-sent-checkbox[data-index="${i}"]`,
        );
        if (cb) cb.checked = false;
        const tr = document
          .querySelector(`.row-sent-checkbox[data-index="${i}"]`)
          ?.closest("tr");
        if (tr) tr.classList.remove("row-sent");
        import("./state.js").then(({ notify }) => notify());
      }
    }

    // Natural human delay between sends (3 seconds)
    // Only delay if there are more pending rows to send
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
  document.getElementById("csv-columns-card").style.display = "none";
  document.getElementById("csv-info-report").innerHTML = "";

  // Remove the "Add One Guest" button from actions if it exists
  document.getElementById("add-row-manual-btn")?.remove();

  showToast("CSV data cleared", "info");
  notify();
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
