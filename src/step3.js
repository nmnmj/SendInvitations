/**
 * Step 3: CSV Upload & Validation
 * Accepts ANY CSV schema — columns become dynamic placeholders.
 * No hardcoded name/phone_number requirement.
 */
import Papa from "papaparse";
import { state, notify } from "./state.js";
import { showToast } from "./toast.js";

export function renderStep3() {
  return `
    <div class="section-header">
      <h1 class="section-title">Upload Guest List</h1>
      <p class="section-subtitle">
        Upload a CSV file with any columns (e.g. <code style="background:var(--bg-input);padding:2px 8px;border-radius:4px;color:var(--accent-primary-light);">f1, f2, f3, f4</code>).
        Each column header becomes a placeholder variable you can position on your invitation in Step 2.
      </p>
    </div>

    <!-- Upload area -->
    <div class="dropzone" id="csv-dropzone">
      <span class="dropzone-icon"><i class="fa-solid fa-file-csv"></i></span>
      <p class="dropzone-title">Drop CSV file here</p>
      <p class="dropzone-subtitle">or <span class="dropzone-browse" id="csv-browse-trigger">browse</span> — .csv files only</p>
      <input type="file" id="csv-file-input" accept=".csv" style="display:none;" />
    </div>

    <!-- Detected columns display -->
    <div class="card mt-lg" id="csv-columns-card" style="display:none;">
      <div class="card-header">
        <div class="card-header-icon blue"><i class="fa-solid fa-table-columns"></i></div>
        <span class="card-title">Detected Columns</span>
      </div>
      <p class="text-muted mb-md" style="font-size:0.85rem;">These columns will be available as <strong>{{placeholder}}</strong> variables in Step 2:</p>
      <div class="page-pills" id="csv-columns-pills"></div>
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
      <button class="btn btn-success" id="download-csv-btn"><i class="fa-solid fa-download"></i> Download CSV</button>
      <button class="btn btn-accent" id="send-all-wa-btn" style="background:#25D366; color:white;"><i class="fa-brands fa-whatsapp"></i> Send All to WhatsApp</button>
      <div id="wa-batch-status-inline" class="flex items-center gap-sm mt-sm" style="font-size:0.75rem; color:var(--text-muted);"></div>
      <button class="btn btn-danger" id="clear-csv-btn"><i class="fa-solid fa-trash"></i> Clear Data</button>
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

  document
    .getElementById("download-csv-btn")
    ?.addEventListener("click", downloadCSV);
  document
    .getElementById("send-all-wa-btn")
    ?.addEventListener("click", sendAllToWhatsApp);
  document.getElementById("clear-csv-btn")?.addEventListener("click", clearCSV);

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
      let blankCount = 0;
      data.forEach((row) => {
        headers.forEach((h) => {
          if (!row[h] || row[h].trim() === "") blankCount++;
        });
      });
      state.csvData.blankCount = blankCount;

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
  const { headers, rows, blankCount } = state.csvData;

  // Show columns card
  const colCard = document.getElementById("csv-columns-card");
  colCard.style.display = "";
  document.getElementById("csv-columns-pills").innerHTML = headers
    .map(
      (h) =>
        `<span class="page-pill active" style="cursor:default;">{{${h}}}</span>`,
    )
    .join("");

  // Stats
  document.getElementById("csv-stats").style.display = "";
  document.getElementById("csv-actions").style.display = "";
  document.getElementById("csv-table-wrap").style.display = "";

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

function renderTable() {
  const { headers, rows } = state.csvData;
  const thead = document.getElementById("csv-table-head");
  const tbody = document.getElementById("csv-table-body");
  if (!thead || !tbody) return;

  thead.innerHTML = `<th>#</th><th title="Manual Sent Status">Sent</th>${headers.map((h) => `<th>{{${h}}}</th>`).join("")}<th style="text-align:right;">Quick Share</th>`;

  tbody.innerHTML = rows
    .map((row, i) => {
      const isSent = row.__sent__ === true;
      // Find a possible phone number automatically (10 digits or more)
      let phoneTxt = "";
      for (const h of headers) {
        const val = (row[h] || "").toString().trim();
        if (val.replace(/[^0-9]/g, "").length >= 10) {
          phoneTxt = val.replace(/[^0-9+]/g, "");
          break;
        }
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
          const isBlank = val.trim() === "";
          return `<td${isBlank ? ' style="color:var(--text-muted);font-style:italic;"' : ""}>${isBlank ? "(blank)" : val}</td>`;
        })
        .join("")}
      <td style="text-align:right;">
         <button class="btn btn-sm wa-quick-send-btn hint-btn" data-index="${i}" data-phone="${phoneTxt}" style="${hasPhone ? "background:#25D366; color:white;" : "background:var(--bg-highlight); color:var(--text-muted);"}" ${!hasPhone ? 'title="No phone number detected"' : ""}>
           <i class="fa-brands fa-whatsapp"></i> ${hasPhone ? "Send" : "Generate"}
         </button>
      </td>
    </tr>`;
    })
    .join("");

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

  if (
    !confirm(
      `Are you sure you want to send ${rows.length} invitations automatically? \n\nA small delay (3s) will be added between each send to prevent WhatsApp spam flags.`,
    )
  ) {
    return;
  }

  btn.disabled = true;
  btn.style.opacity = "0.7";

  const { sendViaWhatsAppAutomation } = await import("./step4.js");

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Find phone number
    let phone = "";
    for (const h of headers) {
      const val = (row[h] || "").toString().trim();
      if (val.replace(/[^0-9]/g, "").length >= 10) {
        phone = val.replace(/[^0-9+]/g, "");
        break;
      }
    }

    if (!phone) {
      console.warn(`Row ${i + 1} has no phone number, skipping.`);
      failCount++;
      continue;
    }

    const name =
      headers.length > 0 ? (row[headers[0]] || "").trim() : `Guest ${i + 1}`;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> (${i + 1}/${rows.length}) Sending to ${name}...`;

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
    if (i < rows.length - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  btn.disabled = false;
  btn.style.opacity = "1";
  btn.innerHTML = `<i class="fa-solid fa-check-double"></i> Batch Complete!`;

  import("./toast.js").then(({ showToast }) =>
    showToast(
      `Batch Done! ${successCount} sent, ${failCount} skipped/failed.`,
      "success",
    ),
  );

  setTimeout(() => {
    btn.innerHTML = originalHTML;
  }, 5000);
}

function clearCSV() {
  state.csvData = { rows: [], headers: [], blankCount: 0 };
  document.getElementById("csv-stats").style.display = "none";
  document.getElementById("csv-actions").style.display = "none";
  document.getElementById("csv-table-wrap").style.display = "none";
  document.getElementById("csv-columns-card").style.display = "none";
  document.getElementById("csv-info-report").innerHTML = "";
  showToast("CSV data cleared", "info");
  notify();
}
