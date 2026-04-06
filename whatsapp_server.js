import "dotenv/config";
import express from "express";
import cors from "cors";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// 0. Serve built frontend files (Production)
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Map of sessionId -> Client instance
const sessions = new Map();
// Map of sessionId -> current UI status/QR data
const sessionData = new Map();

/**
 * Initializes a new client or returns existing one for a sessionId
 */
async function getOrCreateClient(sessionId) {
  if (sessions.has(sessionId)) return sessions.get(sessionId);

  console.log(`🚀 Initializing private WhatsApp engine for [${sessionId}]...`);
  console.log(
    `💡 Note: Render Free Tier (512MB RAM) can typically only handle 1-2 concurrent users.`,
  );
  console.log(
    `Current Memory Usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
  );

  // Initialize data record
  sessionData.set(sessionId, { status: "initializing", qr: null });

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `user-${sessionId}` }),
    puppeteer: {
      headless: true, // Headless:true is mandatory for multi-user servers
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-gpu", // Memory optimization
        "--no-first-run",
      ],
      // Use system browser if available to save disk space
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    },
  });

  client.on("qr", async (qr) => {
    console.log(`✨ QR Received for [${sessionId}]`);
    try {
      const qrDataURL = await QRCode.toDataURL(qr, {
        margin: 2,
        width: parseInt(process.env.QR_WIDTH) || 300,
        color: {
          dark: process.env.QR_COLOR_DARK || "#25D366",
          light: process.env.QR_COLOR_LIGHT || "#ffffff",
        },
      });
      sessionData.set(sessionId, { status: "qr", qr: qrDataURL });
    } catch (err) {
      console.error("QR Generation Error:", err);
    }
  });

  client.on("ready", () => {
    console.log(`✅ Session [${sessionId}] is online!`);
    sessionData.set(sessionId, { status: "ready", qr: null });
  });

  client.on("authenticated", () => {
    sessionData.set(sessionId, { status: "authenticated", qr: null });
  });

  client.on("auth_failure", () => {
    console.error(`❌ Session [${sessionId}] auth failed.`);
    sessionData.set(sessionId, { status: "failed", qr: null });
    sessions.delete(sessionId);
  });

  client.on("disconnected", () => {
    console.warn(`⚠️ Session [${sessionId}] disconnected.`);
    sessionData.set(sessionId, { status: "disconnected", qr: null });
    sessions.delete(sessionId);
  });

  sessions.set(sessionId, client);
  client.initialize().catch((err) => {
    console.error(`Init error for [${sessionId}]:`, err);
    sessionData.set(sessionId, { status: "error", error: err.message });
  });

  return client;
}

// 1. Boot up a specific session
app.post("/api/whatsapp/init", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  await getOrCreateClient(sessionId);
  res.json({ success: true, status: sessionData.get(sessionId).status });
});

// 2. Clear/Logout a specific session
app.post("/api/whatsapp/logout", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  const client = sessions.get(sessionId);
  if (client) {
    try {
      await client.logout();
      await client.destroy();
    } catch (e) {}
    sessions.delete(sessionId);
    sessionData.delete(sessionId);
  }
  res.json({ success: true });
});

// 3. Poll for Status/QR
app.get("/api/whatsapp/status", (req, res) => {
  const { sessionId } = req.query;
  const data = sessionData.get(sessionId) || { status: "not_started" };
  res.json(data);
});

// 4. Enhanced Multi-User Send PDF
app.post("/api/send-pdf", async (req, res) => {
  const { sessionId, phone, pdfBase64, filename, name } = req.body;

  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  const client = sessions.get(sessionId);
  const data = sessionData.get(sessionId);

  if (!client || !data || data.status !== "ready") {
    return res.status(401).json({
      success: false,
      error: "WhatsApp session not ready. Please scan the QR code first.",
    });
  }

  try {
    let chatId = phone.replace(/[^0-9]/g, "");
    if (chatId.length === 10) chatId = "91" + chatId;
    if (!chatId.endsWith("@c.us")) chatId += "@c.us";

    console.log(`🚀 [${sessionId}] sending to ${chatId}...`);

    const media = new MessageMedia("application/pdf", pdfBase64, filename);
    await client.sendMessage(chatId, media, {
      caption: `Hello ${name || "Guest"}, here is your invitation!`,
    });

    console.log(`✅ [${sessionId}] Sent successful!`);
    res.json({ success: true });
  } catch (err) {
    console.error("Send Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Catch-all for SPA routing (MUST be after API routes)
app.get(/.*/, (req, res) => {
  const indexFile = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res
      .status(404)
      .send("Frontend build not found. Run 'npm run build' first.");
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(
    `\n🚀 Multi-User WhatsApp Gateway active on http://localhost:${PORT}`,
  );
});
