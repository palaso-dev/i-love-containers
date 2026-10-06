import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createEngineHandler, attachPtyWebSocket } from "../vite-engine-plugin";

const home = os.homedir();
const isWin = process.platform === "win32";

const defaultPaths = isWin
  ? [
      "C:\\Program Files\\Docker\\Docker\\resources\\bin",
      "C:\\Program Files\\Docker\\Docker\\resources",
      "C:\\Program Files\\RedHat\\Podman",
      path.join(home, "AppData\\Local\\Programs\\Rancher Desktop\\resources\\resources\\win32\\bin"),
    ]
  : [
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "/opt/homebrew/sbin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
      `${home}/.docker/bin`,
      `${home}/.orbstack/bin`,
      `${home}/.rd/bin`,
      `${home}/.local/bin`,
    ];

const delimiter = path.delimiter || (isWin ? ";" : ":");
const currentPaths = (process.env.PATH || "").split(delimiter);
for (const p of defaultPaths) {
  if (!currentPaths.includes(p)) {
    currentPaths.unshift(p);
  }
}
process.env.PATH = currentPaths.join(delimiter);

const PORT = 41785;
const HOST = "127.0.0.1";

const handler = createEngineHandler({ cors: true });

const server = http.createServer((req, res) => {
  handler(req, res).catch((err) => {
    console.error("[Backend Server Error]:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: err?.message || "Internal Server Error" }));
    }
  });
});

attachPtyWebSocket(server);

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.log(`[Container Engine Server] Port ${PORT} is already in use; reusing running instance.`);
    process.exit(0);
  } else {
    console.error("[Container Engine Server] Server error:", err);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[Container Engine Server] Listening on http://${HOST}:${PORT}`);
});

process.on("SIGINT", () => {
  console.log("[Container Engine Server] Received SIGINT, exiting...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("[Container Engine Server] Received SIGTERM, exiting...");
  process.exit(0);
});

if (process.ppid) {
  const ppidCheck = setInterval(() => {
    try {
      process.kill(process.ppid, 0);
    } catch {
      clearInterval(ppidCheck);
      console.log("[Container Engine Server] Parent process terminated, exiting...");
      process.exit(0);
    }
  }, 3000);
  ppidCheck.unref();
}
