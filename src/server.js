const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");
const { getLocalIPv4Addresses } = require("./network");

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 3000);

// Single canonical session store
const sessions = new Map();

// Auto-purge stale sessions older than 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > 30 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 60 * 1000);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Company File Transfer Server" });
});

app.get("/api/network", (req, res) => {
  res.json({
    addresses: getLocalIPv4Addresses(),
    port: PORT,
  });
});

app.post("/api/session", (req, res) => {
  const sessionId = crypto.randomBytes(8).toString("hex");

  sessions.set(sessionId, {
    laptop: null,
    phone: null,
    buffer: [],
    createdAt: Date.now(),
  });

  console.log(`[session] created ${sessionId}`);
  res.json({ sessionId });
});

const wss = new WebSocketServer({ server, path: "/ws" });

function safeSend(ws, obj) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(obj));
    return true;
  }
  return false;
}

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (err) {
      return;
    }

    const { type, sessionId, payload } = data;
    const session = sessions.get(sessionId);

    if (!session) {
      safeSend(ws, { type: "error", message: "Session not found" });
      return;
    }

    if (type === "join") {
      const role = payload && payload.role;
      if (role !== "laptop" && role !== "phone") {
        safeSend(ws, { type: "error", message: "Invalid role" });
        return;
      }

      session[role] = ws;
      ws.sessionId = sessionId;
      ws.role = role;

      const peerRole = role === "laptop" ? "phone" : "laptop";
      const peer = session[peerRole];

      if (peer && peer.readyState === 1) {
        safeSend(peer, { type: "peer-joined", role });
        safeSend(ws, { type: "peer-joined", role: peerRole });
      }

      if (session.buffer.length > 0) {
        const remaining = [];
        for (const item of session.buffer) {
          if (item.to === role) {
            safeSend(ws, item.data);
          } else {
            remaining.push(item);
          }
        }
        session.buffer = remaining;
      }
      return;
    }

    if (!ws.sessionId || ws.sessionId !== sessionId || !ws.role) return;

    const receiverRole = ws.role === "laptop" ? "phone" : "laptop";
    const receiver = session[receiverRole];

    if (receiver && receiver.readyState === 1) {
      safeSend(receiver, data);
    } else {
      session.buffer.push({ to: receiverRole, data });
      if (session.buffer.length > 200) session.buffer.shift();
    }
  });

  ws.on("close", () => {
    const session = sessions.get(ws.sessionId);
    if (!session) return;
    if (ws.role && session[ws.role] === ws) {
      session[ws.role] = null;
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});