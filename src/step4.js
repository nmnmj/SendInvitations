/**
 * Step 4: Generate & Download Personalized PDFs
 * Supports Hindi (Devanagari), English, and other Unicode scripts.
 * CSV columns are generic (f1, f2, ... fN). Blank fields = blank on PDF.
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { state, getPageDimensions } from "./state.js";
import { showToast } from "./toast.js";

// Cache for loaded font bytes
let cachedFonts = {};

function containsDevanagari(text) {
  return /[\u0900-\u097F]/.test(text);
}

async function loadFontBytes(fontName) {
  if (cachedFonts[fontName]) return cachedFonts[fontName];
  const fontFiles = {
    NotoSansDevanagari: "/fonts/NotoSansDevanagari.ttf",
    NotoSans: "/fonts/NotoSans.ttf",
  };
  const url = fontFiles[fontName];
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Font fetch failed: ${response.status}`);
    const bytes = await response.arrayBuffer();
    cachedFonts[fontName] = bytes;
    return bytes;
  } catch (err) {
    console.warn(`Failed to load font ${fontName}:`, err);
    return null;
  }
}

/** Guess image MIME type from data URL or filename */
function getImageType(img) {
  if (img.file && img.file.type) return img.file.type;
  if (img.url) {
    if (img.url.startsWith("data:image/png")) return "image/png";
    if (
      img.url.startsWith("data:image/jpeg") ||
      img.url.startsWith("data:image/jpg")
    )
      return "image/jpeg";
  }
  if (img.name) {
    const ext = img.name.split(".").pop().toLowerCase();
    if (ext === "png") return "image/png";
  }
  return "image/jpeg"; // safe default
}

export function renderStep4() {
  const imgCount = state.images.length;
  const phCount = state.placeholders.length;
  const rowCount = state.csvData.rows.length;
  const colCount = state.csvData.headers.length;

  const imgDone = imgCount > 0;
  const csvDone = rowCount > 0;

  // Determine which placeholders are linked to CSV columns
  const csvHeaders = state.csvData.headers || [];
  const linkedCount = state.placeholders.filter((p) =>
    csvHeaders.includes(p.key),
  ).length;
  const unlinkedCount = phCount - linkedCount;

  return `
    <div class="row gap-xl items-start">
      <div class="col flex-1">
        <div class="card">
          <div class="card-header">
            <div class="card-header-icon purple"><i class="fa-solid fa-list-check"></i></div>
            <span class="card-title">Final Checklist</span>
          </div>
          
          <ul class="checklist">
            <li class="${imgDone ? "completed" : "pending"}">
              <div class="check-circle"><i class="fa-solid ${imgDone ? "fa-check" : "fa-clock"}"></i></div>
              <div class="check-text">
                <strong>Templates Uploaded</strong>
                <span>${imgCount} image${imgCount !== 1 ? "s" : ""} detected</span>
              </div>
            </li>
            <li class="${phCount > 0 ? "completed" : "pending"}">
              <div class="check-circle"><i class="fa-solid ${phCount > 0 ? "fa-check" : "fa-clock"}"></i></div>
              <div class="check-text">
                <strong>Personalization Set</strong>
                <span>${phCount} placeholder${phCount !== 1 ? "s" : ""} added ${linkedCount > 0 ? `(${linkedCount} linked)` : ""}</span>
              </div>
            </li>
            <li class="${csvDone ? "completed" : "pending"}">
              <div class="check-circle"><i class="fa-solid ${csvDone ? "fa-check" : "fa-clock"}"></i></div>
              <div class="check-text">
                <strong>Guest List Ready</strong>
                <span>${rowCount} guest${rowCount !== 1 ? "s" : ""} across ${colCount} columns</span>
              </div>
            </li>
          </ul>

          ${
            unlinkedCount > 0
              ? `
          <div class="alert alert-warning mt-lg">
            <i class="fa-solid fa-circle-exclamation"></i>
            <div>
              <strong>${unlinkedCount} Unlinked Variable${unlinkedCount !== 1 ? "s" : ""}</strong>
              <p>Some placeholders aren't connected to CSV columns. They will appear blank on the PDF.</p>
            </div>
          </div>
          `
              : ""
          }
        </div>
      </div>

      <div class="col" style="width: 400px;">
        <div class="card highlight-card">
          <div class="card-header">
            <div class="card-header-icon green"><i class="fa-solid fa-bolt"></i></div>
            <span class="card-title">Primary Actions</span>
          </div>
          
          <div class="form-group">
            <label class="form-label">WhatsApp Number Column</label>
            <select class="form-select" id="whatsapp-col-select">
              <option value="">-- No WhatsApp Links --</option>
              ${csvHeaders
                .map((h) => {
                  const isSelected = h === state.csvData.phoneHeader;
                  return `<option value="${h}" ${isSelected ? "selected" : ""}>${h}</option>`;
                })
                .join("")}
            </select>
          </div>

          <button class="btn btn-primary btn-lg w-full" id="generate-btn" ${!imgDone || !csvDone ? "disabled" : ""}>
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            Generate ${rowCount} Invitation${rowCount !== 1 ? "s" : ""}
          </button>

          ${
            !imgDone || !csvDone
              ? `
          <p class="text-muted mt-md" style="font-size:0.8rem; text-align:center;">
            <i class="fa-solid fa-circle-info"></i>
            ${!imgDone && !csvDone ? "Upload images and add guests first" : !imgDone ? "Upload images in Step 1 first" : "Add guests in Step 3 first"}
          </p>
          `
              : ""
          }

          <div class="progress-container mt-lg" id="progress-container" style="display:none;">
            <div class="progress-bar-wrap">
              <div class="progress-bar" id="progress-bar"></div>
            </div>
            <p class="progress-text" id="progress-text">Preparing...</p>
          </div>
        </div>
      </div>
    </div>

    <div id="whatsapp-sharing-section" class="mt-2xl" style="display:none;">
      <div class="card">
        <div class="card-header">
          <div class="card-header-icon green"><i class="fa-brands fa-whatsapp"></i></div>
          <span class="card-title">WhatsApp Sharing Hub</span>
          <div style="flex:1"></div>
          <div id="wa-batch-status-inline"></div>
        </div>
        <p class="text-muted mb-lg" style="font-size:0.9rem;">Your PDFs are ready. You can now reach out to your guests individually via WhatsApp.</p>
        <div id="whatsapp-links-container" class="wa-grid"></div>
      </div>
    </div>
  `;
}

export function initStep4() {
  const btn = document.getElementById("generate-btn");
  if (btn) {
    btn.addEventListener("click", generateAllPDFs);
  }

  // Persist WhatsApp column selection
  const waColSelect = document.getElementById("whatsapp-col-select");
  waColSelect?.addEventListener("change", (e) => {
    import("./state.js").then(({ state, notify }) => {
      state.csvData.phoneHeader = e.target.value || null;
      notify();
    });
  });
}

async function generateAllPDFs() {
  const btn = document.getElementById("generate-btn");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");

  btn.disabled = true;
  btn.innerHTML =
    '<i class="fa-solid fa-spinner animate-spin"></i> Generating...';
  progressContainer.style.display = "";

  const rows = state.csvData.rows;
  const headers = state.csvData.headers;
  const total = rows.length;
  const zip = new JSZip();

  const waColSelect = document.getElementById("whatsapp-col-select");
  const waCol = waColSelect ? waColSelect.value : "";
  const waLinks = [];

  // Pre-load fonts
  progressText.textContent = "Loading fonts...";
  const [devanagariBytes, latinBytes] = await Promise.all([
    loadFontBytes("NotoSansDevanagari"),
    loadFontBytes("NotoSans"),
  ]);

  // Pre-load all images as ArrayBuffers
  progressText.textContent = "Loading images...";
  const imageBuffers = await Promise.all(
    state.images.map(async (img) => {
      const resp = await fetch(img.url);
      return {
        buffer: await resp.arrayBuffer(),
        type: getImageType(img),
        width: img.width,
        height: img.height,
      };
    }),
  );

  for (let i = 0; i < total; i++) {
    const row = rows[i];
    const pct = Math.round(((i + 1) / total) * 100);
    progressBar.style.width = pct + "%";

    // Use first column value for display, or fallback to row number
    const firstVal = headers.length > 0 ? (row[headers[0]] || "").trim() : "";
    const label = firstVal || `Row ${i + 1}`;
    progressText.textContent = `Generating PDF for ${label}... (${i + 1}/${total})`;

    try {
      const pdfBytes = await generateSinglePDF(
        row,
        imageBuffers,
        devanagariBytes,
        latinBytes,
      );

      let phoneVal = "";
      if (waCol && row[waCol]) {
        phoneVal = row[waCol]
          .toString()
          .trim()
          .replace(/[^0-9+]/g, "");
      }

      // Filename: use first column value or row index
      let safeName = (firstVal || `row_${i + 1}`)
        .replace(/[\\/:*?"<>|]/g, "")
        .trim()
        .replace(/\s+/g, "_");
      if (!firstVal) safeName = `row_${i + 1}`;
      if (phoneVal) safeName += `_${phoneVal}`;

      const outName = `${safeName}_invitation.pdf`;
      zip.file(outName, pdfBytes);

      if (waCol) {
        waLinks.push({
          label: firstVal || `Row ${i + 1}`,
          filename: outName,
          phone: phoneVal,
          row: row, // Keep full row for variable replacement
        });
      }
    } catch (err) {
      console.error(`Error generating PDF for row ${i + 1}:`, err);
      showToast(`Error for ${label}: ${err.message}`, "error");
    }

    // Yield to UI
    await new Promise((r) => setTimeout(r, 10));
  }

  progressText.textContent = "Packaging ZIP file...";
  progressBar.style.width = "100%";

  try {
    const zipBlob = await zip.generateAsync({ type: "blob" }, (meta) => {
      progressText.textContent = `Compressing... ${Math.round(meta.percent)}%`;
    });
    saveAs(zipBlob, "invitations.zip");
    showToast(`Successfully generated ${total} invitation PDFs!`, "success");

    if (waCol && waLinks.length > 0) {
      const waSection = document.getElementById("whatsapp-sharing-section");
      const waContainer = document.getElementById("whatsapp-links-container");
      if (waSection && waContainer) {
        waSection.style.display = "block";
        waContainer.innerHTML = waLinks
          .map((link) => {
            if (!link.phone) {
              return `<div style="padding:10px 15px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--text);">${link.label}</strong><br/>
                <span style="font-size:0.75rem; color:var(--text-muted);">${link.filename}</span>
              </div>
              <span style="font-size:0.8rem; color:var(--warning);"><i class="fa-solid fa-triangle-exclamation"></i> No Number provided</span>
            </div>`;
            }

            // Robust placeholder replacement using single-pass regex
            const template =
              state.csvData.whatsappMessageTemplate ||
              "Hello {{Name}}, here is your invitation!";
            const msg = template.replace(/{{(.*?)}}/g, (match, key) => {
              const val = link.row[key.trim()];
              return val !== undefined ? val : match;
            });

            const url = `https://web.whatsapp.com/send/?phone=${link.phone}&text=${encodeURIComponent(msg)}`;
            return `<div style="padding:10px 15px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--text);">${link.label}</strong> <span style="font-size:0.8rem; color:var(--text-muted);">(${link.phone})</span><br/>
                <span style="font-size:0.75rem; color:var(--text-muted);">${link.filename}</span>
              </div>
              <a href="${url}" target="_blank" class="btn btn-sm" style="background:#25D366; color:#fff; padding:6px 12px; text-decoration:none; display:flex; align-items:center; gap:6px;"><i class="fa-brands fa-whatsapp"></i> Send</a>
            </div>`;
          })
          .join("");
      }
    }
  } catch (err) {
    showToast(`ZIP creation failed: ${err.message}`, "error");
  }

  btn.disabled = false;
  btn.innerHTML =
    '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Again';
  progressContainer.style.display = "none";
}

async function generateSinglePDF(
  row,
  imageBuffers,
  devanagariBytes,
  latinBytes,
) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const settings = state.pdfSettings;
  const pageDims = getPageDimensions();

  // Pre-embed fonts
  let devFont = null;
  let latFont = null;

  if (devanagariBytes) {
    try {
      devFont = await pdfDoc.embedFont(devanagariBytes, { subset: false });
    } catch (err) {
      console.warn("Failed to embed Devanagari font:", err);
    }
  }
  if (latinBytes) {
    try {
      latFont = await pdfDoc.embedFont(latinBytes, { subset: false });
    } catch (err) {
      console.warn("Failed to embed Latin font:", err);
    }
  }

  for (let pageIdx = 0; pageIdx < imageBuffers.length; pageIdx++) {
    const imgData = imageBuffers[pageIdx];

    let pageW = pageDims.w;
    let pageH = pageDims.h;

    if (settings.orientation === "auto") {
      const isLandscapeImg = imgData.width > imgData.height;
      if (isLandscapeImg && pageH > pageW) [pageW, pageH] = [pageH, pageW];
      else if (!isLandscapeImg && pageW > pageH)
        [pageW, pageH] = [pageH, pageW];
    } else if (settings.orientation === "landscape") {
      if (pageH > pageW) [pageW, pageH] = [pageH, pageW];
    } else {
      if (pageW > pageH) [pageW, pageH] = [pageH, pageW];
    }

    const page = pdfDoc.addPage([pageW, pageH]);

    let embeddedImg;
    if (imgData.type === "image/png") {
      embeddedImg = await pdfDoc.embedPng(imgData.buffer);
    } else {
      embeddedImg = await pdfDoc.embedJpg(imgData.buffer);
    }

    let drawX = 0,
      drawY = 0,
      drawW = pageW,
      drawH = pageH;
    const imgRatio = imgData.width / imgData.height;
    const pageRatio = pageW / pageH;

    if (settings.scaling === "fit") {
      if (imgRatio > pageRatio) {
        drawW = pageW;
        drawH = pageW / imgRatio;
        drawX = 0;
        drawY = (pageH - drawH) / 2;
      } else {
        drawH = pageH;
        drawW = pageH * imgRatio;
        drawX = (pageW - drawW) / 2;
        drawY = 0;
      }
    } else if (settings.scaling === "fill") {
      if (imgRatio > pageRatio) {
        drawH = pageH;
        drawW = pageH * imgRatio;
        drawX = (pageW - drawW) / 2;
        drawY = 0;
      } else {
        drawW = pageW;
        drawH = pageW / imgRatio;
        drawX = 0;
        drawY = (pageH - drawH) / 2;
      }
    }

    page.drawImage(embeddedImg, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
    });

    // Draw text overlays for this page
    const overlays = state.placeholders.filter((p) =>
      p.pages.includes(pageIdx),
    );

    for (const overlay of overlays) {
      // Get value from CSV row — if blank or missing, use empty string (NOT the placeholder key)
      const rawValue = row[overlay.key];
      const textValue =
        rawValue !== undefined &&
        rawValue !== null &&
        rawValue.toString().trim() !== ""
          ? rawValue.toString().trim()
          : ""; // blank fields = blank on PDF

      // Skip rendering entirely if value is empty
      if (textValue === "") continue;

      // Create offscreen canvas for perfectly shaped Hindi text
      const tempCanvas = document.createElement("canvas");
      const tctx = tempCanvas.getContext("2d");

      const resolutionMult = 4; // Sharp print quality
      const fontSize = overlay.fontSize;
      const hiResSize = fontSize * resolutionMult;

      tctx.font = `${hiResSize}px "${overlay.fontFamily}"`;
      const metrics = tctx.measureText(textValue);

      const textW = metrics.width;
      const textAscent =
        metrics.fontBoundingBoxAscent ||
        metrics.actualBoundingBoxAscent ||
        hiResSize;
      const textDescent =
        metrics.fontBoundingBoxDescent ||
        metrics.actualBoundingBoxDescent ||
        hiResSize * 0.3;
      const textH = textAscent + textDescent + hiResSize * 0.5; // safe padding

      const padX = 20 * resolutionMult;
      const padY = 20 * resolutionMult;
      tempCanvas.width = Math.ceil(textW) + padX * 2;
      tempCanvas.height = Math.ceil(textH) + padY * 2;

      // Re-apply font post-resize
      tctx.font = `${hiResSize}px "${overlay.fontFamily}"`;
      tctx.fillStyle = overlay.color;
      tctx.textBaseline = "middle";
      tctx.textAlign = "left";

      tctx.fillText(textValue, padX, tempCanvas.height / 2);

      const pngDataUrl = tempCanvas.toDataURL("image/png");
      const fetchResp = await fetch(pngDataUrl);
      const pngBytes = await fetchResp.arrayBuffer();
      const embeddedTextImg = await pdfDoc.embedPng(pngBytes);

      // pdf-lib's y is bottom-left origin
      let x = (overlay.x / 100) * pageW;
      const y = pageH - (overlay.y / 100) * pageH;

      const visualTextW = textW / resolutionMult;
      const drawnW = tempCanvas.width / resolutionMult;
      const drawnH = tempCanvas.height / resolutionMult;

      if (overlay.alignment === "center") x -= visualTextW / 2;
      else if (overlay.alignment === "right") x -= visualTextW;

      x -= padX / resolutionMult; // shift back the padded offset

      page.drawImage(embeddedTextImg, {
        x,
        y: y - drawnH / 2, // Centered on the Y axis
        width: drawnW,
        height: drawnH,
      });
    }
  }

  return pdfDoc.save();
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function sendViaWhatsAppAutomation(rowIndex, phone) {
  const row = state.csvData.rows[rowIndex];
  if (!row) return;
  const headers = state.csvData.headers;
  const guestName =
    headers.length > 0 ? (row[headers[0]] || "").trim() : "Guest";

  showToast(`Building HD PDF for ${guestName}...`, "info");

  const [devBytes, latBytes] = await Promise.all([
    loadFontBytes("NotoSansDevanagari"),
    loadFontBytes("NotoSans"),
  ]);

  const imageBuffers = await Promise.all(
    state.images.map(async (img) => {
      const resp = await fetch(img.url);
      return {
        buffer: await resp.arrayBuffer(),
        type: getImageType(img),
        width: img.width,
        height: img.height,
      };
    }),
  );

  const pdfBytes = await generateSinglePDF(
    row,
    imageBuffers,
    devBytes,
    latBytes,
  );

  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const base64 = await blobToBase64(blob);

  showToast(`Sending to WhatsApp (+${phone})...`, "info");

  try {
    // Render custom caption using robust placeholder replacement
    const template =
      state.csvData.whatsappMessageTemplate ||
      "Hello {{Name}}, here is your invitation!";
    const caption = template.replace(/{{(.*?)}}/g, (match, key) => {
      const val = row[key.trim()];
      return val !== undefined ? val : match;
    });

    const response = await fetch("/api/send-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.sessionId,
        phone,
        pdfBase64: base64,
        filename: `${guestName.replace(/\s+/g, "_")}_invitation.pdf`,
        name: guestName,
        caption: caption,
      }),
    });

    const data = await response.json();

    if (data.success) {
      showToast(`✅ Successfully delivered to ${guestName}!`, "success");
    } else {
      throw new Error(data.error || "Bridge Error");
    }
  } catch (err) {
    console.error("WhatsApp Send Error:", err);
    showToast(`❌ Failed: ${err.message}`, "error");
    throw err;
  }
}
