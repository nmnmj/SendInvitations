import "dotenv/config";
import express from "express";
import cors from "cors";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion, // Fix for 405
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pino from "pino";

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

// Map of sessionId -> Socket instance
const sessions = new Map();
// Map of sessionId -> current UI status/QR data
const sessionData = new Map();

// Logger (silent to avoid cluttering Render logs)
const logger = pino({ level: "silent" });

/**
 * Initializes a new Baileys client for a sessionId
 */
async function getOrCreateClient(sessionId) {
  if (sessions.has(sessionId)) return sessions.get(sessionId);

  console.log(
    `🚀 Initializing LIGHTWEIGHT Baileys engine for [${sessionId}]...`,
  );
  console.log(
    `💡 Memory Usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB (VS 500MB+ in Puppeteer)`,
  );

  const authDir = path.join(__dirname, ".baileys_auth", sessionId);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  // Fetch latest version to avoid 405 Connection Failure
  const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1017531287],
    isLatest: false,
  }));
  console.log(
    `📡 Using WhatsApp Web v${version.join(".")} (Latest: ${isLatest})`,
  );

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  });

  // Track status
  sessionData.set(sessionId, { status: "initializing", qr: null });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`✨ QR Received for [${sessionId}]`);
      const qrDataURL = await QRCode.toDataURL(qr, {
        margin: 2,
        width: 300,
        color: { dark: "#25D366", light: "#ffffff" },
      });
      const current = sessionData.get(sessionId) || {};
      sessionData.set(sessionId, { ...current, status: "qr", qr: qrDataURL });
    }

    if (connection) {
      console.log(`🔌 Connection Update [${sessionId}]: ${connection}`);
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.warn(
        `⚠️ Session [${sessionId}] closed. Reason: ${lastDisconnect?.error?.message || "Unknown"} (Code: ${statusCode}). Reconnect: ${shouldReconnect}`,
      );

      if (!shouldReconnect) {
        const current = sessionData.get(sessionId) || {};
        sessionData.set(sessionId, {
          ...current,
          status: "disconnected",
          qr: null,
        });
        sessions.delete(sessionId);
        // Cleanup auth folder
        try {
          fs.rmSync(authDir, { recursive: true, force: true });
        } catch (e) {}
      } else {
        // Re-init socket with a delay to prevent spamming
        setTimeout(() => {
          sessions.delete(sessionId);
          getOrCreateClient(sessionId);
        }, 5000);
      }
    } else if (connection === "open") {
      console.log(`✅ Session [${sessionId}] is online!`);
      const current = sessionData.get(sessionId) || {};
      sessionData.set(sessionId, { ...current, status: "ready", qr: null });
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sessions.set(sessionId, sock);
  return sock;
}

// 1. Boot up a specific session
app.post("/api/whatsapp/init", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  await getOrCreateClient(sessionId);
  res.json({
    success: true,
    status: sessionData.get(sessionId)?.status || "initializing",
  });
});

// 2. Clear/Logout a specific session
app.post("/api/whatsapp/logout", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  const sock = sessions.get(sessionId);
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {}
    sessions.delete(sessionId);
    sessionData.delete(sessionId);
    // Delete credentials folder
    const authDir = path.join(__dirname, ".baileys_auth", sessionId);
    if (fs.existsSync(authDir))
      fs.rmSync(authDir, { recursive: true, force: true });
  }
  res.json({ success: true });
});

// 3. Request Pairing Code (for mobile linking)
app.post("/api/whatsapp/pairing-code", async (req, res) => {
  const { sessionId, phone } = req.body;
  if (!sessionId || !phone)
    return res.status(400).json({ error: "Missing sessionId or phone" });

  try {
    const sock = await getOrCreateClient(sessionId);
    // Wait a bit for the engine to stabilize if it was just created
    await new Promise((r) => setTimeout(r, 2000));

    // Format phone: remove everything except digits
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) throw new Error("Invalid phone number");

    console.log(
      `🔑 Requesting Pairing Code for [${sessionId}] -> ${cleanPhone}`,
    );
    const code = await sock.requestPairingCode(cleanPhone);

    // Save pairing code in sessionData so status polling can see it
    const current = sessionData.get(sessionId) || {};
    sessionData.set(sessionId, { ...current, pairingCode: code });

    res.json({ success: true, code });
  } catch (err) {
    console.error("Pairing Code Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Poll for Status/QR/PairingCode
app.get("/api/whatsapp/status", async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  let data = sessionData.get(sessionId);

  // Auto-init if it's not started yet (robust fallback)
  if (!data) {
    await getOrCreateClient(sessionId);
    data = sessionData.get(sessionId);
  }

  res.json(data || { status: "not_started" });
});

// 4. Send PDF using Baileys
app.post("/api/send-pdf", async (req, res) => {
  const { sessionId, phone, pdfBase64, filename, name, caption } = req.body;

  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  const sock = sessions.get(sessionId);
  const data = sessionData.get(sessionId);

  if (!sock || !data || data.status !== "ready") {
    return res.status(401).json({
      success: false,
      error: "WhatsApp session not ready. Please scan the QR code first.",
    });
  }

  try {
    let chatId = phone.replace(/[^0-9]/g, "");
    if (chatId.length === 10) chatId = "91" + chatId;
    if (!chatId.endsWith("@s.whatsapp.net")) chatId += "@s.whatsapp.net";

    console.log(`🚀 [${sessionId}] sending PDF to ${chatId}...`);

    // Remove base64 header if present
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    await sock.sendMessage(chatId, {
      document: buffer,
      fileName: filename || "Invitation.pdf",
      mimetype: "application/pdf",
      caption: caption || `Hello ${name || "Guest"}, here is your invitation!`,
    });

    console.log(`✅ [${sessionId}] Sent successful!`);
    res.json({ success: true });
  } catch (err) {
    console.error("Send Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Catch-all for SPA routing
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

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

const PORT = process.env.PORT || 3001;
const server = app
  .listen(PORT, () => {
    console.log(`\n🚀 Light-weight Baileys Gateway active on Port ${PORT}`);
    console.log(`💡 Best for Render Free Tier (Memory: ~50MB)`);
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `❌ Port ${PORT} is busy. Make sure old server is stopped!`,
      );
    } else {
      console.error("❌ Server startup error:", err);
    }
  });
