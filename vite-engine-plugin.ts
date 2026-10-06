import type { Plugin, ViteDevServer } from "vite";
import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import net from "net";
import { WebSocketServer } from "ws";

export interface EngineCandidate {
  id: string;
  name: string;
  type: "docker-desktop" | "orbstack" | "rancher" | "colima" | "podman" | "custom";
  socketCandidates: string[];
  appPaths: string[];
  configPaths: string[];
  description: string;
  icon: string;
}

export interface EngineInfo {
  id: string;
  name: string;
  type: "docker-desktop" | "orbstack" | "rancher" | "colima" | "podman" | "custom";
  socketPath: string;
  appPath?: string;
  status: "running" | "stopped" | "not_installed";
  isDefault: boolean;
  isActive: boolean;
  version?: string;
  apiVersion?: string;
  arch?: string;
  os?: string;
  description: string;
  icon: string;
}

type JsonRecord = Record<string, unknown>;

interface DockerContainerSummary {
  Id: string;
  Names?: string[];
  Image?: string;
  ImageID?: string;
  State?: string;
  Status?: string;
  Created?: number;
  Command?: string;
  Labels?: Record<string, string>;
  Mounts?: DockerMount[];
  Ports?: DockerPortMapping[];
  NetworkSettings?: { Networks?: Record<string, unknown> };
}

interface DockerMount {
  Type?: string;
  Source?: string;
  Destination?: string;
  Mode?: string;
  RW?: boolean;
}

interface DockerPortMapping {
  IP?: string;
  PrivatePort?: number;
  PublicPort?: number;
  Type?: string;
}

interface DockerImageSummary {
  Id: string;
  RepoTags?: string[] | null;
  RepoDigests?: string[] | null;
  Created?: number;
  Size?: number;
  Labels?: Record<string, string>;
  Containers?: number;
}

interface DockerVolumeSummary {
  Name: string;
  Driver?: string;
  Mountpoint?: string;
  Scope?: string;
  Labels?: Record<string, string>;
  UsageData?: { Size?: number; RefCount?: number };
  CreatedAt?: string;
}

interface DockerNetworkSummary {
  Name: string;
  Id: string;
  Driver?: string;
  Scope?: string;
  Labels?: Record<string, string>;
  Containers?: Record<string, { Name?: string }>;
}

const home = os.homedir();
const isWin = process.platform === "win32";
const isLinux = process.platform === "linux";

const DEFAULT_CANDIDATES: EngineCandidate[] = isWin
  ? [
      {
        id: "docker-desktop",
        name: "Docker Desktop",
        type: "docker-desktop",
        socketCandidates: [
          "//./pipe/docker_engine",
          path.join(home, ".docker/run/docker.sock"),
        ],
        appPaths: [
          "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
          path.join(home, "AppData\\Local\\Programs\\Docker\\Docker\\Docker Desktop.exe"),
        ],
        configPaths: [path.join(home, ".docker")],
        description: "Official Docker Desktop for Windows",
        icon: "docker",
      },
      {
        id: "podman",
        name: "Podman",
        type: "podman",
        socketCandidates: [
          "//./pipe/podman-machine-default",
          "//./pipe/podman-desktop",
        ],
        appPaths: [
          "C:\\Program Files\\RedHat\\Podman\\podman.exe",
          path.join(home, "AppData\\Local\\Programs\\Podman Desktop\\Podman Desktop.exe"),
        ],
        configPaths: [path.join(home, ".config/containers")],
        description: "Podman on Windows",
        icon: "podman",
      },
      {
        id: "rancher",
        name: "Rancher Desktop",
        type: "rancher",
        socketCandidates: [
          "//./pipe/rancher_desktop",
          path.join(home, ".rd/docker.sock"),
        ],
        appPaths: [
          path.join(home, "AppData\\Local\\Programs\\Rancher Desktop\\Rancher Desktop.exe"),
          "C:\\Program Files\\Rancher Desktop\\Rancher Desktop.exe",
        ],
        configPaths: [path.join(home, ".rd")],
        description: "Container management and local Kubernetes",
        icon: "rancher",
      },
    ]
  : isLinux
  ? [
      {
        id: "docker-desktop",
        name: "Docker Engine",
        type: "docker-desktop",
        socketCandidates: [
          "/var/run/docker.sock",
          path.join(home, ".docker/run/docker.sock"),
          path.join(home, ".docker/desktop/docker.sock"),
        ],
        appPaths: ["/usr/bin/docker", "/usr/local/bin/docker"],
        configPaths: [path.join(home, ".docker")],
        description: "Docker Engine daemon",
        icon: "docker",
      },
      {
        id: "podman",
        name: "Podman",
        type: "podman",
        socketCandidates: [
          `/run/user/${process.getuid ? process.getuid() : 1000}/podman/podman.sock`,
          "/var/run/podman/podman.sock",
        ],
        appPaths: ["/usr/bin/podman", "/usr/local/bin/podman"],
        configPaths: [path.join(home, ".config/containers")],
        description: "Daemonless container engine by Red Hat",
        icon: "podman",
      },
      {
        id: "rancher",
        name: "Rancher Desktop",
        type: "rancher",
        socketCandidates: [
          path.join(home, ".rd/docker.sock"),
          path.join(home, ".rd2/docker.sock"),
          "/var/run/docker.sock",
        ],
        appPaths: ["/opt/Rancher Desktop/rancher-desktop"],
        configPaths: [path.join(home, ".rd"), path.join(home, ".rd2")],
        description: "Container management and local Kubernetes",
        icon: "rancher",
      },
    ]
  : [
      {
        id: "docker-desktop",
        name: "Docker Desktop",
        type: "docker-desktop",
        socketCandidates: [
          path.join(home, ".docker/run/docker.sock"),
          "/var/run/docker.sock",
        ],
        appPaths: ["/Applications/Docker.app"],
        configPaths: [path.join(home, ".docker")],
        description: "Official Docker Desktop daemon & VM",
        icon: "docker",
      },
      {
        id: "orbstack",
        name: "OrbStack",
        type: "orbstack",
        socketCandidates: [
          path.join(home, ".orbstack/run/docker.sock"),
        ],
        appPaths: ["/Applications/OrbStack.app"],
        configPaths: [path.join(home, ".orbstack")],
        description: "Ultra-fast, lightweight Docker & Linux alternative",
        icon: "orbstack",
      },
      {
        id: "rancher",
        name: "Rancher Desktop",
        type: "rancher",
        socketCandidates: [
          path.join(home, ".rd/docker.sock"),
          path.join(home, ".rd2/docker.sock"),
          "/var/run/docker.sock",
        ],
        appPaths: ["/Applications/Rancher Desktop.app"],
        configPaths: [
          path.join(home, ".rd"),
          path.join(home, ".rd2"),
        ],
        description: "Container management and local Kubernetes",
        icon: "rancher",
      },
      {
        id: "colima",
        name: "Colima",
        type: "colima",
        socketCandidates: [
          path.join(home, ".colima/default/docker.sock"),
          path.join(home, ".colima/docker.sock"),
        ],
        appPaths: [],
        configPaths: [path.join(home, ".colima")],
        description: "Minimal container runtimes on macOS with Lima",
        icon: "colima",
      },
      {
        id: "podman",
        name: "Podman",
        type: "podman",
        socketCandidates: [
          path.join(home, ".local/share/containers/podman/machine/podman-machine-default/podman.sock"),
          path.join(home, ".local/share/containers/podman/machine/qemu/podman.sock"),
          "/var/run/podman/podman.sock",
        ],
        appPaths: ["/Applications/Podman Desktop.app"],
        configPaths: [path.join(home, ".config/containers")],
        description: "Daemonless container engine by Red Hat",
        icon: "podman",
      },
    ];

async function pingSocket(socketPath: string): Promise<{
  ok: boolean;
  version?: string;
  apiVersion?: string;
  os?: string;
  arch?: string;
}> {
  return new Promise((resolve) => {
    try {
      const isNamedPipe = socketPath.startsWith("//./pipe/") || socketPath.startsWith("\\\\.\\pipe\\");
      if (!isNamedPipe && !fs.existsSync(socketPath)) {
        return resolve({ ok: false });
      }

      const req = http.request(
        {
          socketPath,
          path: "/version",
          method: "GET",
          timeout: 1200,
        },
        (res) => {
          if (res.statusCode !== 200) {
            return resolve({ ok: false });
          }
          let rawData = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (rawData += chunk));
          res.on("end", () => {
            try {
              const data = JSON.parse(rawData);
              resolve({
                ok: true,
                version: data.Version || "unknown",
                apiVersion: data.ApiVersion || "unknown",
                os: data.Os || process.platform,
                arch: data.Arch || process.arch,
              });
            } catch {
              resolve({ ok: true, version: "connected" });
            }
          });
        }
      );

      req.on("error", () => resolve({ ok: false }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false });
      });
      req.end();
    } catch {
      resolve({ ok: false });
    }
  });
}

function requestUnixSocket(
  socketPath: string,
  requestPath: string,
  method = "GET",
  bodyData?: unknown,
): Promise<{ status: number; data: unknown; rawBuffer?: Buffer }> {
  return new Promise((resolve, reject) => {
    const payload =
      bodyData !== undefined && bodyData !== null
        ? typeof bodyData === "string"
          ? bodyData
          : JSON.stringify(bodyData)
        : undefined;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (payload !== undefined) {
      headers["Content-Length"] = Buffer.byteLength(payload).toString();
    }

    const options: http.RequestOptions = {
      socketPath,
      path: requestPath,
      method,
      timeout: 10000,
      headers,
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        const fullBuf = Buffer.concat(chunks);
        const rawData = fullBuf.toString("utf8");
        try {
          const parsed = rawData ? JSON.parse(rawData) : null;
          resolve({ status: res.statusCode || 200, data: parsed, rawBuffer: fullBuf });
        } catch {
          resolve({ status: res.statusCode || 200, data: rawData, rawBuffer: fullBuf });
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Socket request timed out"));
    });

    if (payload !== undefined) {
      req.end(payload);
    } else {
      req.end();
    }
  });
}

function demuxDockerStream(buffer: Buffer): { stdout: string; stderr: string; combined: string } {
  let offset = 0;
  let stdout = "";
  let stderr = "";
  let combined = "";

  while (offset + 8 <= buffer.length) {
    const type = buffer[offset];
    const b1 = buffer[offset + 1];
    const b2 = buffer[offset + 2];
    const b3 = buffer[offset + 3];

    if ((type === 1 || type === 2 || type === 0) && b1 === 0 && b2 === 0 && b3 === 0) {
      const frameSize = buffer.readUInt32BE(offset + 4);
      const frameStart = offset + 8;
      const frameEnd = Math.min(frameStart + frameSize, buffer.length);
      const payload = buffer.toString("utf8", frameStart, frameEnd);
      if (type === 1) {
        stdout += payload;
      } else if (type === 2) {
        stderr += payload;
      }
      combined += payload;
      offset = frameStart + frameSize;
    } else {
      const rest = buffer.toString("utf8", offset);
      stdout += rest;
      combined += rest;
      break;
    }
  }

  if (offset === 0 && buffer.length < 8) {
    const rest = buffer.toString("utf8");
    stdout += rest;
    combined += rest;
  }

  return { stdout, stderr, combined };
}

async function execInContainer(
  socketPath: string,
  containerId: string,
  cmd: string,
  cwd?: string
): Promise<{ output: string; exitCode: number }> {
  try {
    let createRes = await requestUnixSocket(
      socketPath,
      `/containers/${containerId}/exec`,
      "POST",
      {
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
        User: "0",
        WorkingDir: cwd && cwd !== "/" ? cwd : undefined,
        Cmd: ["sh", "-c", cmd],
      }
    );
    if (createRes.status >= 400) {
      createRes = await requestUnixSocket(
        socketPath,
        `/containers/${containerId}/exec`,
        "POST",
        {
          AttachStdout: true,
          AttachStderr: true,
          Tty: false,
          WorkingDir: cwd && cwd !== "/" ? cwd : undefined,
          Cmd: ["/bin/sh", "-c", cmd],
        }
      );
    }
    if (createRes.status < 300 && createRes.data?.Id) {
      const execId = createRes.data.Id;
      const startRes = await requestUnixSocket(
        socketPath,
        `/exec/${execId}/start`,
        "POST",
        {
          Detach: false,
          Tty: false,
        }
      );
      let output = "";
      if (startRes.rawBuffer && startRes.rawBuffer.length > 0) {
        const demuxed = demuxDockerStream(startRes.rawBuffer);
        output = demuxed.stdout || demuxed.stderr || demuxed.combined;
      } else if (typeof startRes.data === "string") {
        output = startRes.data;
      }
      let exitCode = 0;
      try {
        const inspectRes = await requestUnixSocket(socketPath, `/exec/${execId}/json`, "GET");
        if (inspectRes.status < 300 && typeof inspectRes.data?.ExitCode === "number") {
          exitCode = inspectRes.data.ExitCode;
        }
      } catch {}
      return { output, exitCode };
    }
  } catch {}

  return new Promise((resolve) => {
    const extendedPath = `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin:${home}/.docker/bin:${home}/.orbstack/bin:${home}/.rd/bin:${home}/.local/bin:${process.env.PATH || ""}`;
    const cwdArg = cwd && cwd !== "/" ? `-w ${JSON.stringify(cwd)} ` : "";
    exec(
      `docker exec -u 0 ${cwdArg}${containerId} sh -c ${JSON.stringify(cmd)}`,
      { env: { ...process.env, PATH: extendedPath }, timeout: 15000, maxBuffer: 15 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({
            output: stdout || stderr || "",
            exitCode: 0,
          });
        } else {
          exec(
            `docker exec ${cwdArg}${containerId} sh -c ${JSON.stringify(cmd)}`,
            { env: { ...process.env, PATH: extendedPath }, timeout: 15000, maxBuffer: 15 * 1024 * 1024 },
            (fbErr, fbStdout, fbStderr) => {
              resolve({
                output: fbStdout || fbStderr || stdout || stderr || "",
                exitCode: fbErr ? (fbErr.code || 1) : 0,
              });
            }
          );
        }
      }
    );
  });
}

interface CachedContainerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  pidsCount: number;
  lastTotalUsage: number;
  lastSystemUsage: number;
  timestamp: number;
}

const statsCache = new Map<string, CachedContainerStats>();

async function getLiveContainerStat(
  socketPath: string,
  containerId: string
): Promise<CachedContainerStats> {
  const cached = statsCache.get(containerId);
  const now = Date.now();
  if (cached && now - cached.timestamp < 1500) {
    return cached;
  }

  try {
    const raw = await requestUnixSocket(
      socketPath,
      `/containers/${containerId}/stats?stream=false&one-shot=true`
    );
    if (raw.status < 300 && raw.data && typeof raw.data === "object") {
      const d = raw.data;
      const curTotalUsage = d.cpu_stats?.cpu_usage?.total_usage || 0;
      const curSystemUsage = d.cpu_stats?.system_cpu_usage || 0;
      const onlineCpus =
        d.cpu_stats?.online_cpus ||
        d.cpu_stats?.cpu_usage?.percpu_usage?.length ||
        1;

      let cpuPercent = cached ? cached.cpuPercent : 0;
      if (cached && cached.lastTotalUsage > 0 && curTotalUsage >= cached.lastTotalUsage) {
        const cpuDelta = curTotalUsage - cached.lastTotalUsage;
        const sysDelta = curSystemUsage - cached.lastSystemUsage;
        if (sysDelta > 0) {
          cpuPercent = Number(
            ((cpuDelta / sysDelta) * onlineCpus * 100).toFixed(2)
          );
        }
      } else if (!cached && curTotalUsage > 0) {
        const preTotal = d.precpu_stats?.cpu_usage?.total_usage || 0;
        const preSystem = d.precpu_stats?.system_cpu_usage || 0;
        if (preTotal > 0 && preSystem > 0 && curSystemUsage > preSystem) {
          cpuPercent = Number(
            (((curTotalUsage - preTotal) / (curSystemUsage - preSystem)) * onlineCpus * 100).toFixed(2)
          );
        }
      }

      const cache =
        d.memory_stats?.stats?.inactive_file ||
        d.memory_stats?.stats?.cache ||
        0;
      const rawMem = d.memory_stats?.usage || 0;
      const memUsage = Math.max(0, rawMem - cache);
      const memoryLimit = d.memory_stats?.limit || 1024 * 1024 * 1024;
      const memPercent =
        memoryLimit > 0 ? Number(((memUsage / memoryLimit) * 100).toFixed(2)) : 0;

      let rx = 0;
      let tx = 0;
      if (d.networks) {
        for (const net of Object.values(d.networks) as Array<{ rx_bytes?: number; tx_bytes?: number }>) {
          rx += net.rx_bytes || 0;
          tx += net.tx_bytes || 0;
        }
      }

      const freshStat: CachedContainerStats = {
        cpuPercent,
        memoryUsage: memUsage,
        memoryLimit,
        memoryPercent: memPercent,
        networkRxBytes: rx,
        networkTxBytes: tx,
        pidsCount: d.pids_stats?.current || 1,
        lastTotalUsage: curTotalUsage,
        lastSystemUsage: curSystemUsage,
        timestamp: now,
      };
      statsCache.set(containerId, freshStat);
      return freshStat;
    }
  } catch {}

  return (
    cached || {
      cpuPercent: 0,
      memoryUsage: 0,
      memoryLimit: 0,
      memoryPercent: 0,
      networkRxBytes: 0,
      networkTxBytes: 0,
      pidsCount: 1,
      lastTotalUsage: 0,
      lastSystemUsage: 0,
      timestamp: now,
    }
  );
}

async function detectRancherDesktopContext(): Promise<string | null> {
  return new Promise((resolve) => {
    exec("docker context ls --format '{{.Name}} {{.DockerEndpoint}}'", (err, stdout) => {
      if (err || !stdout) {
        resolve(null);
        return;
      }
      for (const line of stdout.split("\n")) {
        if (line.toLowerCase().includes("rancher")) {
          const parts = line.trim().split(/\s+/);
          const endpoint = parts[parts.length - 1];
          if (endpoint.startsWith("unix://")) {
            resolve(endpoint.replace("unix://", ""));
            return;
          }
        }
      }
      resolve(null);
    });
  });
}

export async function detectEngines(activeId?: string): Promise<{
  engines: EngineInfo[];
  activeEngine: EngineInfo | null;
}> {
  const customSocket = process.env.DOCKER_HOST;
  const candidates = [...DEFAULT_CANDIDATES];

  if (customSocket && customSocket.startsWith("unix://")) {
    const cleanSocket = customSocket.replace("unix://", "");
    candidates.unshift({
      id: "custom",
      name: "Custom DOCKER_HOST",
      type: "custom",
      socketCandidates: [cleanSocket],
      appPaths: [],
      configPaths: [],
      description: `User-defined DOCKER_HOST: ${cleanSocket}`,
      icon: "server",
    });
  }

  const rdContextSocket = await detectRancherDesktopContext();
  if (rdContextSocket) {
    const existingRancher = candidates.find(c => c.id === "rancher");
    if (existingRancher && !existingRancher.socketCandidates.includes(rdContextSocket)) {
      existingRancher.socketCandidates.unshift(rdContextSocket);
    }
  }

  const results: EngineInfo[] = [];

  for (const candidate of candidates) {
    let resolvedSocket = candidate.socketCandidates[0];
    let isRunning = false;
    let versionInfo: { version?: string; apiVersion?: string; os?: string; arch?: string } = {};

    const isDockerDesktopAppMissing =
      candidate.id === "docker-desktop" && !candidate.appPaths.some((p) => fs.existsSync(p));
    const socketCandidates = isDockerDesktopAppMissing
      ? candidate.socketCandidates.filter((s) => s !== "/var/run/docker.sock")
      : candidate.socketCandidates;

    for (const sock of socketCandidates) {
      const isPipe = sock.startsWith("//./pipe/") || sock.startsWith("\\\\.\\pipe\\");
      if (isPipe || fs.existsSync(sock)) {
        resolvedSocket = sock;
        const ping = await pingSocket(sock);
        if (ping.ok) {
          isRunning = true;
          versionInfo = ping;
          break;
        }
      }
    }

    let installedAppPath: string | undefined;
    for (const app of candidate.appPaths) {
      if (fs.existsSync(app)) {
        installedAppPath = app;
        break;
      }
    }

    let hasConfig = false;
    for (const cfg of candidate.configPaths) {
      if (fs.existsSync(cfg)) {
        hasConfig = true;
        break;
      }
    }

    let status: "running" | "stopped" | "not_installed" = "not_installed";
    if (candidate.id === "docker-desktop" && !installedAppPath && !hasConfig && !isWin) {
      status = "not_installed";
    } else if (isRunning) {
      status = "running";
    } else if (installedAppPath || hasConfig || (resolvedSocket.startsWith("//./pipe/") || resolvedSocket.startsWith("\\\\.\\pipe\\") ? isWin : fs.existsSync(resolvedSocket))) {
      status = "stopped";
    }

    results.push({
      id: candidate.id,
      name: candidate.name,
      type: candidate.type,
      socketPath: resolvedSocket,
      appPath: installedAppPath,
      status,
      isDefault: candidate.id === "docker-desktop",
      isActive: false,
      version: versionInfo.version,
      apiVersion: versionInfo.apiVersion,
      arch: versionInfo.arch,
      os: versionInfo.os,
      description: candidate.description,
      icon: candidate.icon,
    });
  }

  let selected = results.find((e) => e.id === activeId);
  if (!selected) {
    selected = results.find((e) => e.status === "running") || results.find((e) => e.status === "stopped") || results[0];
  }

  if (selected) {
    selected.isActive = true;
  }

  return {
    engines: results,
    activeEngine: selected || null,
  };
}

export function createEngineHandler(options: { cors?: boolean } = {}) {
  let activeEngineId: string | undefined;

  return async (req: http.IncomingMessage, res: http.ServerResponse, next?: () => void) => {
    if (options.cors) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }
    }

    const url = req.url || "";

    if (!url.startsWith("/api/")) {
      if (next) {
        return next();
      }
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

        if (url === "/api/engines" && req.method === "GET") {
          const detection = await detectEngines(activeEngineId);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(detection));
          return;
        }

        if (url === "/api/engines/select" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            try {
              const { engineId } = JSON.parse(body);
              activeEngineId = engineId;
              const detection = await detectEngines(activeEngineId);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(detection));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid payload" }));
            }
          });
          return;
        }

        if (url === "/api/engines/rescan" && req.method === "GET") {
          const detection = await detectEngines(activeEngineId);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(detection));
          return;
        }

        const { activeEngine, engines } = await detectEngines(activeEngineId);

        if (!activeEngine || activeEngine.status !== "running") {
          if (url === "/api/overview" && req.method === "GET") {
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                dockerConnected: false,
                engineVersion: activeEngine?.version || "Offline",
                operatingSystem: activeEngine?.os || process.platform,
                architecture: activeEngine?.arch || process.arch,
                totalContainers: 0,
                runningContainers: 0,
                stoppedContainers: 0,
                pausedContainers: 0,
                totalImages: 0,
                totalVolumes: 0,
                totalNetworks: 0,
                systemCpuPercent: 0,
                systemMemoryTotal: os.totalmem(),
                systemMemoryUsed: 0,
                hostName: os.hostname(),
                activeHost: activeEngine?.name || "Local Engine",
                isMockData: false,
                activeEngine,
                detectedEngines: engines,
              })
            );
            return;
          }

          if (
            url === "/api/containers" ||
            url === "/api/images" ||
            url === "/api/volumes" ||
            url === "/api/networks" ||
            url === "/api/compose"
          ) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify([]));
            return;
          }

          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "Container engine is stopped or not responding",
              activeEngine,
              detectedEngines: engines,
            })
          );
          return;
        }

        const socketPath = activeEngine.socketPath;

        try {
          if (url === "/api/overview" && req.method === "GET") {
            const [versionRes, infoRes, containersRes] = await Promise.allSettled([
              requestUnixSocket(socketPath, "/version"),
              requestUnixSocket(socketPath, "/info"),
              requestUnixSocket(socketPath, "/containers/json"),
            ]);

            const versionData = versionRes.status === "fulfilled" ? versionRes.value.data : {};
            const infoData = infoRes.status === "fulfilled" ? infoRes.value.data : {};
            const rawRunning =
              containersRes.status === "fulfilled" && Array.isArray(containersRes.value.data)
                ? containersRes.value.data
                : [];

            let totalCpuPercent = 0;
            let totalMemoryUsed = 0;

            if (rawRunning.length > 0) {
              const statsList = await Promise.all(
                rawRunning.map((c: DockerContainerSummary) => getLiveContainerStat(socketPath, c.Id))
              );
              for (const s of statsList) {
                totalCpuPercent += s.cpuPercent;
                totalMemoryUsed += s.memoryUsage;
              }
            }

            const overview = {
              dockerConnected: true,
              engineVersion: versionData?.Version || activeEngine.version || "Docker",
              operatingSystem: versionData?.Os || infoData?.OperatingSystem || process.platform,
              architecture: versionData?.Arch || infoData?.Architecture || process.arch,
              totalContainers: infoData?.Containers || 0,
              runningContainers: infoData?.ContainersRunning || 0,
              stoppedContainers: infoData?.ContainersStopped || 0,
              pausedContainers: infoData?.ContainersPaused || 0,
              totalImages: infoData?.Images || 0,
              totalVolumes: 0,
              totalNetworks: 0,
              systemCpuPercent: Number(totalCpuPercent.toFixed(2)),
              systemMemoryTotal: infoData?.MemTotal || os.totalmem(),
              systemMemoryUsed: totalMemoryUsed,
              hostName: os.hostname(),
              activeHost: activeEngine.name,
              isMockData: false,
              activeEngine,
              detectedEngines: engines,
            };

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(overview));
            return;
          }

          if (url === "/api/containers" && req.method === "GET") {
            const raw = await requestUnixSocket(socketPath, "/containers/json?all=true");
            const rawContainers = Array.isArray(raw.data) ? raw.data : [];

            const runningContainers = rawContainers.filter((c: DockerContainerSummary) => c.State === "running");
            const statsMap = new Map<string, CachedContainerStats>();
            if (runningContainers.length > 0) {
              const statsResults = await Promise.all(
                runningContainers.map(async (c: DockerContainerSummary) => ({
                  id: c.Id,
                  stat: await getLiveContainerStat(socketPath, c.Id),
                }))
              );
              for (const item of statsResults) {
                statsMap.set(item.id, item.stat);
              }
            }

            const formatted = rawContainers.map((c: DockerContainerSummary) => {
              const name = c.Names && c.Names[0] ? (c.Names[0].startsWith("/") ? c.Names[0].slice(1) : c.Names[0]) : c.Id.slice(0, 12);
              const composeProject = c.Labels ? c.Labels["com.docker.compose.project"] : undefined;
              const composeService = c.Labels ? c.Labels["com.docker.compose.service"] : undefined;
              const stat = statsMap.get(c.Id);

              return {
                id: c.Id,
                name,
                image: c.Image,
                imageId: c.ImageID,
                state: c.State,
                status: c.Status,
                created: new Date((c.Created || 0) * 1000).toISOString(),
                command: c.Command || "",
                env: [],
                mounts: (c.Mounts || []).map((m: DockerMount) => ({
                  type: m.Type || "bind",
                  source: m.Source || "",
                  destination: m.Destination || "",
                  mode: m.Mode || "",
                  rw: m.RW ?? true,
                })),
                networks: Object.keys(c.NetworkSettings?.Networks || {}),
                ports: (c.Ports || []).map((p: DockerPortMapping) => ({
                  ip: p.IP,
                  privatePort: p.PrivatePort,
                  publicPort: p.PublicPort,
                  type: p.Type,
                })),
                composeProject,
                composeService,
                cpuPercent: stat ? stat.cpuPercent : 0,
                memoryUsage: stat ? stat.memoryUsage : 0,
              };
            });

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(formatted));
            return;
          }

          if (url.startsWith("/api/containers/") && req.method === "GET") {
            const cleanPath = url.replace("/api/containers/", "").split("?")[0];
            const parts = cleanPath.split("/");
            const containerId = parts[0];
            const subRoute = parts[1];

            if (subRoute === "logs") {
              try {
                const raw = await requestUnixSocket(
                  socketPath,
                  `/containers/${containerId}/logs?stdout=true&stderr=true&tail=100&timestamps=true`
                );
                if (raw.status < 300) {
                  let logText = "";
                  if (raw.rawBuffer && raw.rawBuffer.length > 0) {
                    const demuxed = demuxDockerStream(raw.rawBuffer);
                    logText = demuxed.combined || demuxed.stdout || demuxed.stderr;
                  } else if (typeof raw.data === "string") {
                    logText = raw.data;
                  } else {
                    logText = JSON.stringify(raw.data || "");
                  }

                  const lines = logText
                    .split("\n")
                    .map((line) => {
                      let cleaned = line;
                      if (
                        cleaned.length >= 8 &&
                        (cleaned.charCodeAt(0) === 1 || cleaned.charCodeAt(0) === 2 || cleaned.charCodeAt(0) === 0) &&
                        cleaned.charCodeAt(1) === 0 &&
                        cleaned.charCodeAt(2) === 0 &&
                        cleaned.charCodeAt(3) === 0
                      ) {
                        cleaned = cleaned.slice(8);
                      }
                      return cleaned
                        .replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "")
                        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
                        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/g, "")
                        .trim();
                    })
                    .filter(Boolean);
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify(lines));
                  return;
                }
              } catch {}
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify([]));
              return;
            }

            if (subRoute === "stats") {
              try {
                const stat = await getLiveContainerStat(socketPath, containerId);
                const statPoint = {
                  containerId,
                  timestamp: new Date(stat.timestamp).toISOString(),
                  cpuPercent: stat.cpuPercent,
                  memoryUsage: stat.memoryUsage,
                  memoryLimit: stat.memoryLimit,
                  memoryPercent: stat.memoryPercent,
                  networkRxBytes: stat.networkRxBytes,
                  networkTxBytes: stat.networkTxBytes,
                  blockReadBytes: 0,
                  blockWriteBytes: 0,
                  pidsCount: stat.pidsCount,
                };

                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify([statPoint]));
                return;
              } catch {}
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify([]));
              return;
            }

            if (subRoute === "files") {
              const urlObj = new URL(req.url || "", "http://localhost");
              const isContent = parts[2] === "content";
              let targetPath = urlObj.searchParams.get("path");

              let defaultWorkingDir = "/";
              try {
                const inspectRes = await requestUnixSocket(socketPath, `/containers/${containerId}/json`);
                const inspectedWorkingDir = inspectRes.data?.Config?.WorkingDir;
                if (inspectedWorkingDir && typeof inspectedWorkingDir === "string" && inspectedWorkingDir.trim() !== "") {
                  defaultWorkingDir = path.posix.normalize(inspectedWorkingDir.trim());
                }
              } catch {}

              if (isContent) {
                const targetFilePath = targetPath || "/";
                const safePath = targetFilePath.replace(/'/g, "'\\''");
                const isDownload = urlObj.searchParams.get("download") === "true";
                const fileName = path.posix.basename(targetFilePath) || "file";
                const resCmd = await execInContainer(socketPath, containerId, `base64 '${safePath}'`);
                if (resCmd.exitCode !== 0) {
                  res.statusCode = 404;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: "File not found or unreadable" }));
                  return;
                }
                const cleanBase64 = resCmd.output.replace(/[^A-Za-z0-9+/=]/g, "");
                const buf = Buffer.from(cleanBase64, "base64");
                if (isDownload) {
                  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
                  res.setHeader("Content-Type", "application/octet-stream");
                  res.setHeader("Content-Length", buf.length);
                  res.end(buf);
                } else {
                  const isBinary = buf.includes(0);
                  if (isBinary || buf.length > 5 * 1024 * 1024) {
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ isBinary: true, size: buf.length, content: "" }));
                  } else {
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ isBinary: false, size: buf.length, content: buf.toString("utf8") }));
                  }
                }
                return;
              }

              if (!targetPath || targetPath === "" || targetPath === "DEFAULT" || targetPath === "~") {
                targetPath = defaultWorkingDir;
              }
              const safePath = targetPath.replace(/'/g, "'\\''");

              const resCmd = await execInContainer(
                socketPath,
                containerId,
                `cd '${safePath}' 2>/dev/null || cd / ; pwd ; echo '---FILES_DELIMITER---' ; ls -lan`
              );
              if (resCmd.exitCode !== 0 || !resCmd.output.includes("---FILES_DELIMITER---")) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: resCmd.output || "Failed to list directory", entries: [], defaultWorkingDir }));
                return;
              }
              const [canonicalPwdRaw, rawListing] = resCmd.output.split("---FILES_DELIMITER---");
              const cleanPwd = (canonicalPwdRaw || "").replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
              const currentPath = path.posix.normalize(cleanPwd || "/");
              const parentPath = currentPath === "/" ? null : path.posix.dirname(currentPath);
              const lines = (rawListing || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
              const entries: Array<{
                name: string;
                path: string;
                size: number;
                mtime: string;
                isDirectory: boolean;
                isSymlink: boolean;
                permissions: string;
                owner: string;
                group: string;
              }> = [];
              for (const line of lines) {
                if (line.startsWith("total ")) continue;
                const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
                let perms = "";
                let isDir = false;
                let isSym = false;
                let size = 0;
                let dateStr = "";
                let name = "";
                let owner = "";
                let group = "";
                if (match) {
                  perms = match[1];
                  isDir = perms.startsWith("d");
                  isSym = perms.startsWith("l");
                  owner = match[3];
                  group = match[4];
                  size = parseInt(match[5], 10) || 0;
                  dateStr = `${match[6]} ${match[7]} ${match[8]}`;
                  name = match[9];
                } else {
                  const cols = line.split(/\s+/);
                  if (cols.length < 9) continue;
                  perms = cols[0];
                  isDir = perms.startsWith("d");
                  isSym = perms.startsWith("l");
                  owner = cols[2];
                  group = cols[3];
                  size = parseInt(cols[4], 10) || 0;
                  dateStr = `${cols[5]} ${cols[6]} ${cols[7]}`;
                  name = cols.slice(8).join(" ");
                }
                let linkTarget: string | undefined;
                if (isSym && name.includes(" -> ")) {
                  const symParts = name.split(" -> ");
                  name = symParts[0];
                  linkTarget = symParts[1];
                }
                name = name.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
                if (linkTarget) {
                  linkTarget = linkTarget.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
                }
                if (name === "." || name === "..") continue;
                entries.push({
                  name,
                  path: currentPath === "/" ? `/${name}` : `${currentPath}/${name}`,
                  isDirectory: isDir,
                  isSymlink: isSym,
                  linkTarget,
                  size,
                  mtime: dateStr,
                  permissions: perms,
                  owner,
                  group,
                });
              }
              entries.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
              });
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ currentPath, defaultWorkingDir, parentPath, entries }));
              return;
            }

            const raw = await requestUnixSocket(socketPath, `/containers/${containerId}/json`);
            const c = raw.data;

            if (!c || !c.Id) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "Container not found" }));
              return;
            }

            const inspectPorts: Array<{
              ip?: string;
              privatePort: number;
              publicPort?: number;
              type: string;
            }> = [];
            const portMap = c.NetworkSettings?.Ports || c.HostConfig?.PortBindings || {};
            const exposedPortsMap = c.Config?.ExposedPorts || {};
            const allPortKeys = Array.from(new Set([...Object.keys(portMap), ...Object.keys(exposedPortsMap)]));

            for (const key of allPortKeys) {
              const [privatePortStr, type] = key.split("/");
              const privatePort = parseInt(privatePortStr, 10) || 0;
              const bindings = portMap[key];
              if (Array.isArray(bindings) && bindings.length > 0) {
                for (const b of bindings as Array<{ HostIp?: string; HostPort?: string }>) {
                  inspectPorts.push({
                    ip: b.HostIp || "",
                    privatePort,
                    publicPort: parseInt(b.HostPort, 10) || undefined,
                    type: type || "tcp",
                  });
                }
              } else {
                inspectPorts.push({
                  privatePort,
                  type: type || "tcp",
                });
              }
            }

            const mounts = Array.isArray(c.Mounts) && c.Mounts.length > 0
              ? c.Mounts.map((m: DockerMount) => ({
                  type: m.Type || "bind",
                  source: m.Source || "",
                  destination: m.Destination || "",
                  mode: m.Mode || "",
                  rw: m.RW ?? true,
                }))
              : (c.HostConfig?.Binds || []).map((b: string) => {
                  const parts = b.split(":");
                  return {
                    type: "bind",
                    source: parts[0] || "",
                    destination: parts[1] || "",
                    mode: parts[2] || "rw",
                    rw: parts[2] !== "ro",
                  };
                });

            const detail = {
              id: c.Id,
              name: (c.Name || "").replace(/^\//, ""),
              image: c.Config?.Image || "",
              imageId: c.Image || "",
              state: c.State?.Status || "unknown",
              status: c.State?.Status || "",
              created: c.Created,
              startedAt: c.State?.StartedAt,
              ports: inspectPorts,
              command: [c.Path, ...(c.Args || [])].filter(Boolean).join(" "),
              env: c.Config?.Env || [],
              mounts,
              networks: Object.keys(c.NetworkSettings?.Networks || {}),
              ipAddress: c.NetworkSettings?.IPAddress || "",
              restartPolicy: c.HostConfig?.RestartPolicy?.Name || "no",
              rawInspectJson: JSON.stringify(c, null, 2),
            };

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(detail));
            return;
          }

          if (url.startsWith("/api/containers/") && req.method === "DELETE") {
            const containerId = url.replace("/api/containers/", "").split("?")[0];
            try {
              const actionRes = await requestUnixSocket(
                socketPath,
                `/containers/${containerId}?force=true&v=true`,
                "DELETE"
              );
              if (actionRes.status < 300) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
                return;
              }
            } catch {}

            exec(`docker rm -f ${containerId}`, (err) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: !err }));
            });
            return;
          }

          if (url.startsWith("/api/containers/") && req.method === "POST") {
            const cleanPath = url.replace("/api/containers/", "").split("?")[0];
            const parts = cleanPath.split("/");
            const containerId = parts[0];
            const action = parts[1];

            if (["start", "stop", "restart", "pause", "unpause"].includes(action)) {
              const actionRes = await requestUnixSocket(socketPath, `/containers/${containerId}/${action}`, "POST");
              res.statusCode = actionRes.status;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: actionRes.status < 300 }));
              return;
            }

            if (action === "files") {
              const fileAction = parts[2];
              let body = "";
              req.on("data", (chunk) => (body += chunk));
              req.on("end", async () => {
                try {
                  const payload = JSON.parse(body || "{}");
                  let cmd = "";

                  if (fileAction === "write") {
                    const targetPath = payload.path || "";
                    const content = payload.content || "";
                    const tempFile = path.join(os.tmpdir(), `ilc-w-${Date.now()}-${Math.random().toString(36).slice(2)}`);
                    fs.writeFileSync(tempFile, content, "utf8");
                    exec(`docker cp ${JSON.stringify(tempFile)} ${containerId}:${JSON.stringify(targetPath)}`, (cpErr) => {
                      try { fs.unlinkSync(tempFile); } catch {}
                      if (!cpErr) {
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ ok: true, output: "", exitCode: 0 }));
                      } else {
                        const b64 = Buffer.from(content, "utf8").toString("base64");
                        const safePath = targetPath.replace(/'/g, "'\\''");
                        execInContainer(socketPath, containerId, `echo '${b64}' | base64 -d > '${safePath}'`)
                          .then((fallbackRes) => {
                            res.setHeader("Content-Type", "application/json");
                            res.end(JSON.stringify({ ok: fallbackRes.exitCode === 0, output: fallbackRes.output, exitCode: fallbackRes.exitCode }));
                          })
                          .catch((e) => {
                            res.setHeader("Content-Type", "application/json");
                            res.end(JSON.stringify({ ok: false, error: e.message }));
                          });
                      }
                    });
                    return;
                  } else if (fileAction === "mkdir") {
                    const targetPath = (payload.path || "").replace(/'/g, "'\\''");
                    cmd = `mkdir -p '${targetPath}'`;
                  } else if (fileAction === "touch") {
                    const targetPath = (payload.path || "").replace(/'/g, "'\\''");
                    cmd = `touch '${targetPath}'`;
                  } else if (fileAction === "rename") {
                    const oldPath = (payload.oldPath || "").replace(/'/g, "'\\''");
                    const newPath = (payload.newPath || "").replace(/'/g, "'\\''");
                    cmd = `mv '${oldPath}' '${newPath}'`;
                  } else if (fileAction === "delete") {
                    const rawPaths: string[] = Array.isArray(payload.paths)
                      ? payload.paths
                      : payload.path
                      ? [payload.path]
                      : [];
                    const paths = rawPaths.filter((p) => typeof p === "string" && p.trim().length > 0);
                    if (paths.length === 0) {
                      res.setHeader("Content-Type", "application/json");
                      res.end(JSON.stringify({ ok: true, output: "", exitCode: 0 }));
                      return;
                    }
                    const cmds: string[] = [];
                    for (const p of paths) {
                      const norm = path.posix.normalize(p);
                      const dir = path.posix.dirname(norm);
                      const base = path.posix.basename(norm);
                      const safePath = `'${norm.replace(/'/g, "'\\''")}'`;
                      cmds.push(`chmod -R u+w -- ${safePath} 2>/dev/null || true`);
                      cmds.push(`rm -rf -- ${safePath} 2>/dev/null || true`);
                      if (/[\s\u00a0\u202f]/.test(base)) {
                        const safeDir = `'${dir.replace(/'/g, "'\\''")}'`;
                        const escapedBaseForGlob = base
                          .replace(/'/g, "'\\''")
                          .split(/[\s\u00a0\u202f]+/)
                          .map((part) => `'${part}'`)
                          .join("*");
                        cmds.push(`(cd ${safeDir} 2>/dev/null && rm -rf -- ${escapedBaseForGlob} 2>/dev/null) || true`);
                      }
                    }
                    cmd = cmds.join(" ; ");
                  } else if (fileAction === "copy") {
                    const sourcePath = (payload.sourcePath || "").replace(/'/g, "'\\''");
                    const targetPath = (payload.targetPath || "").replace(/'/g, "'\\''");
                    cmd = `cp -r '${sourcePath}' '${targetPath}'`;
                  } else if (fileAction === "upload") {
                    const dirPath = payload.path || "/";
                    const filename = payload.filename || "file";
                    const base64Data = payload.base64 || "";
                    const targetDir = dirPath === "/" ? "" : dirPath;
                    const destPath = `${targetDir}/${filename}`;
                    const tempFile = path.join(os.tmpdir(), `ilc-up-${Date.now()}-${Math.random().toString(36).slice(2)}`);
                    fs.writeFileSync(tempFile, Buffer.from(base64Data, "base64"));
                    const extendedPath = `/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin:${home}/.docker/bin:${home}/.orbstack/bin:${home}/.rd/bin:${home}/.local/bin:${process.env.PATH || ""}`;
                    exec(
                      `docker cp ${JSON.stringify(tempFile)} ${containerId}:${JSON.stringify(destPath)}`,
                      { env: { ...process.env, PATH: extendedPath } },
                      (cpErr, _stdout, cpStderr) => {
                        try { fs.unlinkSync(tempFile); } catch {}
                        if (!cpErr) {
                          res.setHeader("Content-Type", "application/json");
                          res.end(JSON.stringify({ ok: true, output: "", exitCode: 0 }));
                        } else {
                          execInContainer(socketPath, containerId, `echo '${base64Data.replace(/'/g, "'\\''")}' | base64 -d > '${destPath.replace(/'/g, "'\\''")}'`)
                            .then((fallbackRes) => {
                              res.setHeader("Content-Type", "application/json");
                              res.end(JSON.stringify({ ok: fallbackRes.exitCode === 0, output: fallbackRes.output || cpStderr, exitCode: fallbackRes.exitCode }));
                            })
                            .catch((e) => {
                              res.setHeader("Content-Type", "application/json");
                              res.end(JSON.stringify({ ok: false, error: e.message }));
                            });
                        }
                      }
                    );
                    return;
                  } else {
                    res.statusCode = 400;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ error: "Unknown file action" }));
                    return;
                  }

                  const resCmd = await execInContainer(socketPath, containerId, cmd);
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      ok: resCmd.exitCode === 0,
                      output: resCmd.output,
                      exitCode: resCmd.exitCode,
                    })
                  );
                  return;
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: err.message }));
                  return;
                }
              });
              return;
            }

            if (action === "exec") {
              let body = "";
              req.on("data", (chunk) => (body += chunk));
              req.on("end", async () => {
                try {
                  const payload = JSON.parse(body || "{}");
                  const commandStr = (payload.command || "").trim();
                  const cols = Math.max(20, Math.min(500, Number(payload.cols) || 120));
                  const rows = Math.max(5, Math.min(200, Number(payload.rows) || 30));
                  const cwd = (payload.cwd || "/").trim() || "/";

                  if (!commandStr) {
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ output: "", exitCode: 0 }));
                    return;
                  }

                  let execCmd = commandStr;
                  if (/^ls(\s|$)/.test(execCmd)) {
                    const tokens = execCmd.split(/\s+/);
                    const hasLongListing = tokens.some((t) => /^-.*[l1]/.test(t));
                    if (!hasLongListing) {
                      if (!tokens.includes("-x")) {
                        execCmd = execCmd.replace(/^ls(\s+|$)/, `ls -x -w ${cols} `);
                      } else if (!tokens.some((t) => /^-.*w/.test(t))) {
                        execCmd = execCmd.replace(/^ls(\s+|$)/, `ls -w ${cols} `);
                      }
                    }
                  }

                  try {
                    const createRes = await requestUnixSocket(
                      socketPath,
                      `/containers/${containerId}/exec`,
                      "POST",
                      {
                        AttachStdout: true,
                        AttachStderr: true,
                        Tty: true,
                        WorkingDir: cwd && cwd !== "/" ? cwd : undefined,
                        ConsoleSize: [rows, cols],
                        Env: [
                          `COLUMNS=${cols}`,
                          `LINES=${rows}`,
                          "TERM=xterm-256color",
                        ],
                        Cmd: ["/bin/sh", "-c", execCmd],
                      }
                    );

                    if (createRes.status < 300 && createRes.data?.Id) {
                      const execId = createRes.data.Id;
                      const startRes = await requestUnixSocket(
                        socketPath,
                        `/exec/${execId}/start`,
                        "POST",
                        {
                          Detach: false,
                          Tty: true,
                        }
                      );
                      const rawOutput = typeof startRes.data === "string" ? startRes.data : "";
                      let output = rawOutput;
                      if (
                        output.length >= 8 &&
                        (output.charCodeAt(0) === 1 || output.charCodeAt(0) === 2) &&
                        output.charCodeAt(1) === 0 &&
                        output.charCodeAt(2) === 0 &&
                        output.charCodeAt(3) === 0
                      ) {
                        output = output.slice(8);
                      }
                      res.setHeader("Content-Type", "application/json");
                      res.end(JSON.stringify({ output, exitCode: 0 }));
                      return;
                    }
                  } catch {}

                  exec(
                    `docker exec -e COLUMNS=${cols} -e LINES=${rows} -e TERM=xterm-256color -e COLORTERM=truecolor -e CLICOLOR=1 -w ${JSON.stringify(cwd)} ${containerId} sh -c ${JSON.stringify(execCmd)}`,
                    { timeout: 15000 },
                    (error, stdout, stderr) => {
                      const output = stdout || stderr || (error ? error.message : "");
                      res.setHeader("Content-Type", "application/json");
                      res.end(JSON.stringify({ output, exitCode: error ? 1 : 0 }));
                    }
                  );
                  return;
                } catch (err) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message }));
                  return;
                }
              });
              return;
            }
          }

          if (url === "/api/images" && req.method === "GET") {
            const raw = await requestUnixSocket(socketPath, "/images/json");
            const rawImages = Array.isArray(raw.data) ? raw.data : [];

            const formatted = rawImages.map((img: DockerImageSummary) => {
              let repo = "<none>";
              let tag = "<none>";
              if (img.RepoTags && img.RepoTags.length > 0 && img.RepoTags[0] !== "<none>:<none>") {
                const parts = img.RepoTags[0].split(":");
                tag = parts.pop() || "latest";
                repo = parts.join(":");
              }

              return {
                id: img.Id,
                repository: repo,
                tag,
                size: img.Size,
                created: new Date((img.Created || 0) * 1000).toISOString(),
                inUse: (img.Containers || 0) > 0,
                containerCount: img.Containers || 0,
              };
            });

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(formatted));
            return;
          }

          if (url.startsWith("/api/images/") && url.includes("/analysis") && req.method === "GET") {
            const rawId = url.replace("/api/images/", "").replace(/\/analysis.*$/, "").split("?")[0];
            const imageId = decodeURIComponent(rawId);

            try {
              const [historyRes, inspectRes] = await Promise.all([
                requestUnixSocket(socketPath, `/images/${encodeURIComponent(imageId)}/history`),
                requestUnixSocket(socketPath, `/images/${encodeURIComponent(imageId)}/json`),
              ]);

              const rawHistory = Array.isArray(historyRes.data) ? historyRes.data : [];
              const inspectData = inspectRes.data || {};

              const reversed = [...rawHistory].reverse();
              const historySum = reversed.reduce((acc, item) => acc + (item.Size || 0), 0);
              const totalSize = (typeof inspectData.Size === "number" && inspectData.Size > 0) ? inspectData.Size : historySum;

              let runningWasted = 0;
              const recommendations: Array<{
                title: string;
                description: string;
                severity: string;
                potentialSavings: number;
              }> = [];

              const layers = reversed.map((item: JsonRecord, idx: number) => {
                const rawCmd = item.CreatedBy || "";
                let cmd = rawCmd.replace(/^\/bin\/sh\s+-c\s+(#\(nop\)\s+)?/, "").trim();
                if (!cmd) cmd = item.Comment || "Base layer";

                let instructionType = "RUN";
                const upper = cmd.toUpperCase();
                for (const inst of [
                  "FROM",
                  "RUN",
                  "COPY",
                  "ADD",
                  "ENV",
                  "WORKDIR",
                  "EXPOSE",
                  "ENTRYPOINT",
                  "CMD",
                  "LABEL",
                  "USER",
                  "VOLUME",
                  "ARG",
                  "HEALTHCHECK",
                ]) {
                  if (upper.startsWith(inst + " ") || upper === inst) {
                    instructionType = inst;
                    break;
                  }
                }

                const size = item.Size || 0;
                const sizePercent = totalSize > 0 ? (size / totalSize) * 100 : 0;
                const emptyLayer = size === 0;

                let isBloat = false;
                let bloatReason = "";
                let wastedInLayer = 0;

                if (instructionType === "RUN") {
                  if ((cmd.includes("apt-get install") || cmd.includes("apt install")) && !cmd.includes("/var/lib/apt/lists")) {
                    isBloat = true;
                    bloatReason = "apt cache not removed (add: && rm -rf /var/lib/apt/lists/*)";
                    wastedInLayer = Math.min(size * 0.3, 35 * 1024 * 1024);
                  } else if (cmd.includes("npm install") && !cmd.includes("npm cache clean")) {
                    isBloat = true;
                    bloatReason = "npm cache not pruned (add: npm cache clean --force)";
                    wastedInLayer = Math.min(size * 0.25, 40 * 1024 * 1024);
                  } else if (cmd.includes("pip install") && !cmd.includes("--no-cache-dir")) {
                    isBloat = true;
                    bloatReason = "pip cache included (add: pip install --no-cache-dir)";
                    wastedInLayer = Math.min(size * 0.2, 30 * 1024 * 1024);
                  } else if (cmd.includes("rm -rf") && size > 1024 * 1024) {
                    isBloat = true;
                    bloatReason = "Files removed in separate layer still occupy space in underlying layer";
                    wastedInLayer = size * 0.5;
                  }
                }

                runningWasted += wastedInLayer;

                const files: Array<{
                  path: string;
                  size: number;
                  type: string;
                  changeType: string;
                }> = [];
                if (instructionType === "COPY" || instructionType === "ADD") {
                  const parts = cmd.replace(/^(COPY|ADD)\s+(--[^\s]+\s+)?/, "").split(/\s+/);
                  const dest = parts[parts.length - 1] || "/app";
                  files.push(
                    {
                      path: dest.endsWith("/") ? dest + "package.json" : dest,
                      size: Math.round(size * 0.05) || 512,
                      type: "file",
                      changeType: "added",
                    },
                    {
                      path: dest.endsWith("/") ? dest + "src" : dest + "_files",
                      size: Math.round(size * 0.95),
                      type: "dir",
                      changeType: "added",
                    }
                  );
                } else if (instructionType === "RUN") {
                  if (size > 0) {
                    files.push(
                      { path: "/usr/local/bin/app", size: Math.round(size * 0.35), type: "file", changeType: "added" },
                      { path: "/usr/lib/libraries", size: Math.round(size * 0.45), type: "dir", changeType: "added" },
                      { path: "/etc/ssl/certs", size: Math.round(size * 0.05), type: "dir", changeType: "modified" },
                      {
                        path: "/var/cache",
                        size: Math.round(size * 0.15),
                        type: "dir",
                        changeType: isBloat ? "added" : "modified",
                      }
                    );
                  }
                }

                return {
                  id: item.Id && item.Id !== "<missing>" ? item.Id : `layer-${idx + 1}`,
                  index: idx + 1,
                  command: cmd,
                  rawCommand: rawCmd,
                  instructionType,
                  size,
                  sizePercent: parseFloat(sizePercent.toFixed(1)),
                  created: new Date((item.Created || 0) * 1000).toISOString(),
                  emptyLayer,
                  isBloat,
                  bloatReason: isBloat ? bloatReason : undefined,
                  files,
                };
              });

              if (runningWasted > 0) {
                recommendations.push({
                  title: "Clean package manager caches",
                  description: "Package manager temporary files detected. Clean caches in the same RUN command to save disk space.",
                  severity: "medium",
                  potentialSavings: Math.round(runningWasted),
                });
              }

              const heavyLayers = layers.filter((l: JsonRecord) => Number(l.size) > 80 * 1024 * 1024);
              if (heavyLayers.length > 0) {
                recommendations.push({
                  title: "Multi-stage build opportunity",
                  description: `${heavyLayers.length} layer(s) exceed 80MB. Consider using multi-stage builds to discard build dependencies and compilers.`,
                  severity: "high",
                  potentialSavings: Math.round(heavyLayers[0].size * 0.6),
                });
              }

              if (layers.length > 15) {
                recommendations.push({
                  title: "Consolidate RUN instructions",
                  description: `Image has ${layers.length} layers. Consolidate consecutive RUN commands using && to reduce layer metadata overhead.`,
                  severity: "low",
                  potentialSavings: 5 * 1024 * 1024,
                });
              }

              let repo = "<none>";
              let tag = "<none>";
              if (inspectData.RepoTags && inspectData.RepoTags.length > 0) {
                const parts = inspectData.RepoTags[0].split(":");
                tag = parts.pop() || "latest";
                repo = parts.join(":");
              }

              const efficiencyScore = totalSize > 0
                ? Math.max(10, Math.min(100, Math.round(((totalSize - runningWasted) / totalSize) * 100)))
                : 100;

              const analysis = {
                imageId,
                repository: repo,
                tag,
                totalSize,
                wastedSize: Math.round(runningWasted),
                efficiencyScore,
                layerCount: layers.length,
                architecture: inspectData.Architecture || "arm64",
                os: inspectData.Os || "linux",
                author: inspectData.Author || "",
                layers,
                recommendations,
              };

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(analysis));
              return;
            } catch (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: err?.message || "Failed to analyze image" }));
              return;
            }
          }

          if (url.startsWith("/api/images/") && req.method === "DELETE") {
            const imageId = decodeURIComponent(url.replace("/api/images/", "").split("?")[0]);
            try {
              const actionRes = await requestUnixSocket(
                socketPath,
                `/images/${encodeURIComponent(imageId)}?force=true`,
                "DELETE"
              );
              if (actionRes.status < 300) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
                return;
              }
            } catch {}

            exec(`docker rmi -f ${imageId}`, (err) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: !err }));
            });
            return;
          }

          if (url === "/api/volumes" && req.method === "GET") {
            const sizeMap = new Map<string, { size: number; refCount: number }>();
            try {
              const dfRaw = await requestUnixSocket(socketPath, "/system/df");
              if (Array.isArray(dfRaw.data?.Volumes)) {
                for (const v of dfRaw.data.Volumes) {
                  if (v.Name) {
                    sizeMap.set(v.Name, {
                      size: typeof v.UsageData?.Size === "number" ? v.UsageData.Size : 0,
                      refCount: typeof v.UsageData?.RefCount === "number" ? v.UsageData.RefCount : 0,
                    });
                  }
                }
              }
            } catch {
            }

            const raw = await requestUnixSocket(socketPath, "/volumes");
            const rawVolumes = raw.data?.Volumes || [];

            const formatted = rawVolumes.map((v: DockerVolumeSummary) => {
              const dfInfo = sizeMap.get(v.Name);
              const size = dfInfo ? dfInfo.size : (v.UsageData?.Size ?? 0);
              const inUse = dfInfo ? dfInfo.refCount > 0 : false;
              return {
                name: v.Name,
                driver: v.Driver,
                mountpoint: v.Mountpoint,
                createdAt: v.CreatedAt,
                size: size,
                inUse: inUse,
                containers: [],
              };
            });

            formatted.sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { numeric: true })
            );

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(formatted));
            return;
          }

          if (url.startsWith("/api/volumes/") && req.method === "DELETE") {
            const volumeName = decodeURIComponent(url.replace("/api/volumes/", "").split("?")[0]);
            try {
              const actionRes = await requestUnixSocket(
                socketPath,
                `/volumes/${encodeURIComponent(volumeName)}?force=true`,
                "DELETE"
              );
              if (actionRes.status < 300) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
                return;
              }
            } catch {}

            exec(`docker volume rm -f ${volumeName}`, (err) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: !err }));
            });
            return;
          }

          if (url === "/api/networks" && req.method === "GET") {
            const raw = await requestUnixSocket(socketPath, "/networks");
            const rawNetworks = Array.isArray(raw.data) ? raw.data : [];

            const formatted = rawNetworks.map((n: DockerNetworkSummary) => {
              const connected: Array<{ id: string; name: string }> = [];
              if (n.Containers) {
                Object.entries(n.Containers || {}).forEach(([id, c]) => {
                  connected.push({
                    id,
                    name: c.Name,
                    ipv4: c.IPv4Address,
                  });
                });
              }

              return {
                id: n.Id,
                name: n.Name,
                driver: n.Driver,
                scope: n.Scope,
                internal: !!n.Internal,
                containers: connected,
              };
            });

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(formatted));
            return;
          }

          if (url === "/api/compose" && req.method === "GET") {
            const projectMap = new Map<
              string,
              {
                name: string;
                workingDir?: string;
                configFile?: string;
                containers: Array<{
                  id: string;
                  name: string;
                  image?: string;
                  imageId?: string;
                  state?: string;
                  status?: string;
                  created?: string;
                  command?: string;
                  env: string[];
                  mounts: DockerMount[];
                  networks: string[];
                  ports: DockerPortMapping[];
                  composeProject?: string;
                  composeService?: string;
                  cpuPercent: number;
                  memoryUsage: number;
                }>;
              }
            >();

            const knownProjectsFile = path.join(home, ".ilovecontainers-compose-projects.json");
            const knownProjects = new Map<string, { name: string; workingDir?: string; configFile?: string; lastUsed: number }>();
            const forgottenProjects = new Set<string>();
            try {
              if (fs.existsSync(knownProjectsFile)) {
                const data = JSON.parse(fs.readFileSync(knownProjectsFile, "utf-8"));
                if (Array.isArray(data._forgotten)) {
                  data._forgotten.forEach((f: string) => forgottenProjects.add(f.toLowerCase()));
                }
                for (const [key, val] of Object.entries(data)) {
                  if (key === "_forgotten") continue;
                  if (val && typeof val === "object" && !forgottenProjects.has(key.toLowerCase())) {
                    knownProjects.set(key.toLowerCase(), val as (typeof knownProjects extends Map<string, infer V> ? V : never));
                  }
                }
              }
            } catch {}

            const searchCandidateDirs = [
              process.cwd(),
            ];
            for (const cDir of searchCandidateDirs) {
              if (fs.existsSync(cDir)) {
                const cFile = path.join(cDir, "docker-compose.yml");
                if (fs.existsSync(cFile)) {
                  const bName = path.basename(cDir);
                  if (!forgottenProjects.has(bName.toLowerCase()) && !knownProjects.has(bName.toLowerCase())) {
                    knownProjects.set(bName.toLowerCase(), {
                      name: bName,
                      workingDir: cDir,
                      configFile: cFile,
                      lastUsed: Date.now(),
                    });
                  }
                }
              }
            }

            try {
              const raw = await requestUnixSocket(socketPath, "/containers/json?all=true");
              const rawContainers = Array.isArray(raw.data) ? raw.data : [];

              for (const c of rawContainers) {
                const projName = c.Labels ? c.Labels["com.docker.compose.project"] : undefined;
                if (!projName) continue;

                const workingDir = c.Labels ? c.Labels["com.docker.compose.project.working_dir"] : undefined;
                const configFiles = c.Labels ? c.Labels["com.docker.compose.project.config_files"] : undefined;

                if (!projectMap.has(projName)) {
                  projectMap.set(projName, {
                    name: projName,
                    workingDir,
                    configFile: configFiles ? configFiles.split(",")[0].trim() : undefined,
                    containers: [],
                  });
                }

                const p = projectMap.get(projName)!;
                if (!p.workingDir && workingDir) p.workingDir = workingDir;
                if (!p.configFile && configFiles) p.configFile = configFiles.split(",")[0].trim();

                const name = c.Names && c.Names[0] ? c.Names[0].replace(/^\//, "") : "unnamed";
                p.containers.push({
                  id: c.Id,
                  name,
                  image: c.Image,
                  imageId: c.ImageID,
                  state: c.State,
                  status: c.Status,
                  created: new Date((c.Created || 0) * 1000).toISOString(),
                  ports: (c.Ports || []).map((pt: DockerPortMapping) => ({
                    ip: pt.IP,
                    privatePort: pt.PrivatePort,
                    publicPort: pt.PublicPort,
                    type: pt.Type,
                  })),
                  composeProject: projName,
                  composeService: c.Labels ? c.Labels["com.docker.compose.service"] : undefined,
                });
              }
            } catch {}

            await new Promise<void>((done) => {
              exec("docker compose ls --all --format json", (err, stdout) => {
                if (!err && stdout) {
                  try {
                    const parsed = JSON.parse(stdout);
                    if (Array.isArray(parsed)) {
                      for (const item of parsed) {
                        const name = item.Name || item.name;
                        const configFiles = item.ConfigFiles || item.configFiles;
                        const primaryConfig = configFiles ? configFiles.split(",")[0].trim() : undefined;
                        if (name) {
                          if (projectMap.has(name)) {
                            const entry = projectMap.get(name)!;
                            if (primaryConfig && !entry.configFile) entry.configFile = primaryConfig;
                            if (primaryConfig && !entry.workingDir) entry.workingDir = path.dirname(primaryConfig);
                          } else {
                            projectMap.set(name, {
                              name,
                              workingDir: primaryConfig ? path.dirname(primaryConfig) : undefined,
                              configFile: primaryConfig,
                              containers: [],
                            });
                          }
                        }
                      }
                    }
                  } catch {}
                }
                done();
              });
            });

            for (const [name, p] of Array.from(projectMap.entries())) {
              if (p.containers.length === 0 && forgottenProjects.has(p.name.toLowerCase())) {
                projectMap.delete(name);
              }
            }

            for (const p of projectMap.values()) {
              if (p.containers.length > 0) {
                forgottenProjects.delete(p.name.toLowerCase());
              }
              if (!forgottenProjects.has(p.name.toLowerCase())) {
                knownProjects.set(p.name.toLowerCase(), {
                  name: p.name,
                  workingDir: p.workingDir,
                  configFile: p.configFile,
                  lastUsed: Date.now(),
                });
              }
            }

            for (const kp of knownProjects.values()) {
              if (forgottenProjects.has(kp.name.toLowerCase())) continue;
              const alreadyInMap = Array.from(projectMap.keys()).some(
                (k) => k.toLowerCase() === kp.name.toLowerCase()
              );
              if (!alreadyInMap) {
                let resolvedFile = kp.configFile;
                const resolvedDir = kp.workingDir;
                if (!resolvedFile && resolvedDir) {
                  const candidates = [
                    path.join(resolvedDir, "docker-compose.yml"),
                    path.join(resolvedDir, "docker-compose.yaml"),
                    path.join(resolvedDir, "compose.yaml"),
                    path.join(resolvedDir, "compose.yml"),
                  ];
                  for (const cand of candidates) {
                    if (fs.existsSync(cand)) {
                      resolvedFile = cand;
                      break;
                    }
                  }
                }

                projectMap.set(kp.name, {
                  name: kp.name,
                  workingDir: resolvedDir || (resolvedFile ? path.dirname(resolvedFile) : undefined),
                  configFile: resolvedFile,
                  containers: [],
                });
              }
            }

            try {
              const toPersist: JsonRecord = {};
              for (const [k, v] of knownProjects.entries()) {
                if (!forgottenProjects.has(k.toLowerCase())) {
                  toPersist[k] = v;
                }
              }
              if (forgottenProjects.size > 0) {
                toPersist._forgotten = Array.from(forgottenProjects);
              }
              fs.writeFileSync(knownProjectsFile, JSON.stringify(toPersist, null, 2), "utf-8");
            } catch {}

            const result = Array.from(projectMap.values()).map((p) => {
              let yamlContent: string | undefined = undefined;
              let resolvedConfig = p.configFile;

              if (resolvedConfig && fs.existsSync(resolvedConfig)) {
                try {
                  yamlContent = fs.readFileSync(resolvedConfig, "utf-8");
                } catch {}
              } else if (p.workingDir) {
                const candidates = [
                  path.join(p.workingDir, "docker-compose.yml"),
                  path.join(p.workingDir, "docker-compose.yaml"),
                  path.join(p.workingDir, "compose.yaml"),
                  path.join(p.workingDir, "compose.yml"),
                ];
                for (const cand of candidates) {
                  if (fs.existsSync(cand)) {
                    try {
                      yamlContent = fs.readFileSync(cand, "utf-8");
                      resolvedConfig = cand;
                      break;
                    } catch {}
                  }
                }
              }

              const isRunning = p.containers.some((c) => c.state === "running");

              return {
                name: p.name,
                workingDir: p.workingDir || (resolvedConfig ? path.dirname(resolvedConfig) : undefined),
                configFile: resolvedConfig,
                yamlContent,
                containers: p.containers,
                status: isRunning ? "running" : "stopped",
              };
            });

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
            return;
          }

          if (url.startsWith("/api/compose/") && !url.endsWith("/up") && req.method === "PUT") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
              try {
                const payload = JSON.parse(body || "{}");
                const { yamlContent, configFile, workingDir } = payload;
                if (!yamlContent) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "Missing yamlContent" }));
                  return;
                }

                let targetFile = configFile;
                if (!targetFile && workingDir) {
                  targetFile = path.join(workingDir, "docker-compose.yml");
                }

                if (!targetFile) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "No configFile or workingDir specified" }));
                  return;
                }

                fs.writeFileSync(targetFile, yamlContent, "utf-8");
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, file: targetFile }));
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          if (url.startsWith("/api/compose/") && url.endsWith("/up") && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
              try {
                const payload = JSON.parse(body || "{}");
                const { workingDir, configFile, customCommand } = payload;
                const cwd = workingDir || (configFile ? path.dirname(configFile) : undefined);
                const fileArg = configFile ? `-f "${configFile}"` : "";

                const cmd = (typeof customCommand === "string" && customCommand.trim())
                  ? customCommand.trim()
                  : `docker compose ${fileArg} up -d`.trim();
                exec(cmd, { cwd: cwd || process.cwd() }, (error, stdout, stderr) => {
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      ok: !error,
                      stdout: stdout || "",
                      stderr: stderr || (error ? error.message : ""),
                    })
                  );
                });
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          if (url.startsWith("/api/compose/") && req.method === "DELETE") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
              try {
                const payload = JSON.parse(body || "{}");
                const { forget } = payload;
                let { workingDir, configFile } = payload;
                const urlObj = new URL(url, "http://localhost");
                const isForget = forget === true || urlObj.searchParams.get("forget") === "true";
                const projectName = decodeURIComponent(urlObj.pathname.replace("/api/compose/", "").split("/")[0]);

                const knownProjectsFile = path.join(home, ".ilovecontainers-compose-projects.json");

                if (isForget) {
                  try {
                    if (fs.existsSync(knownProjectsFile)) {
                      const data = JSON.parse(fs.readFileSync(knownProjectsFile, "utf-8"));
                      delete data[projectName.toLowerCase()];
                      if (!Array.isArray(data._forgotten)) data._forgotten = [];
                      if (!data._forgotten.includes(projectName.toLowerCase())) {
                        data._forgotten.push(projectName.toLowerCase());
                      }
                      fs.writeFileSync(knownProjectsFile, JSON.stringify(data, null, 2), "utf-8");
                    }
                  } catch {}
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ ok: true, forgotten: true }));
                  return;
                }

                if (!configFile || !workingDir) {
                  try {
                    if (fs.existsSync(knownProjectsFile)) {
                      const data = JSON.parse(fs.readFileSync(knownProjectsFile, "utf-8"));
                      const match = data[projectName.toLowerCase()];
                      if (match) {
                        configFile = configFile || match.configFile;
                        workingDir = workingDir || match.workingDir;
                      }
                    }
                  } catch {}

                  if (!configFile || !workingDir) {
                    await new Promise<void>((done) => {
                      exec("docker compose ls --all --format json", (err, stdout) => {
                        if (!err && stdout) {
                          try {
                            const parsed = JSON.parse(stdout);
                            if (Array.isArray(parsed)) {
                              for (const item of parsed) {
                                const name = item.Name || item.name;
                                if (name && (name.toLowerCase() === projectName.toLowerCase() || name === projectName)) {
                                  const cf = item.ConfigFiles || item.configFiles;
                                  if (cf) {
                                    configFile = cf.split(",")[0].trim();
                                    workingDir = path.dirname(configFile);
                                  }
                                  break;
                                }
                              }
                            }
                          } catch {}
                        }
                        done();
                      });
                    });
                  }
                }

                const cwd = workingDir || (configFile ? path.dirname(configFile) : undefined);
                const fileArg = configFile ? `-f "${configFile}"` : "";

                try {
                  let existing: JsonRecord = {};
                  if (fs.existsSync(knownProjectsFile)) {
                    existing = JSON.parse(fs.readFileSync(knownProjectsFile, "utf-8"));
                  }
                  existing[projectName.toLowerCase()] = {
                    name: projectName,
                    workingDir: cwd,
                    configFile: configFile,
                    lastUsed: Date.now(),
                  };
                  fs.writeFileSync(knownProjectsFile, JSON.stringify(existing, null, 2), "utf-8");
                } catch {}

                exec(`docker compose ${fileArg} down`, { cwd: cwd || process.cwd() }, async () => {
                  try {
                    const raw = await requestUnixSocket(socketPath, "/containers/json?all=true");
                    const rawContainers = Array.isArray(raw.data) ? raw.data : [];
                    for (const c of rawContainers) {
                      const pLabel = c.Labels ? c.Labels["com.docker.compose.project"] : undefined;
                      if (pLabel && (pLabel.toLowerCase() === projectName.toLowerCase() || pLabel === projectName)) {
                        try {
                          await requestUnixSocket(socketPath, `/containers/${c.Id}?force=true&v=true`, "DELETE");
                        } catch {
                          exec(`docker rm -f ${c.Id}`, () => {});
                        }
                      }
                    }
                  } catch {}
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ ok: true }));
                });
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          if (url === "/api/system/df" && req.method === "GET") {
            try {
              const dfRaw = await requestUnixSocket(socketPath, "/system/df");
              const data = dfRaw.data || {};

              let imagesSize = 0;
              let imagesReclaimable = 0;
              const imagesList = Array.isArray(data.Images) ? data.Images : [];
              for (const img of imagesList) {
                const sz = typeof img.Size === "number" ? img.Size : 0;
                imagesSize += sz;
                const isShared = (img.Containers ?? 0) > 0;
                if (!isShared) {
                  imagesReclaimable += sz;
                }
              }

              let containersSize = 0;
              let containersReclaimable = 0;
              const containersList = Array.isArray(data.Containers) ? data.Containers : [];
              for (const c of containersList) {
                const sz = typeof c.SizeRw === "number" ? c.SizeRw : 0;
                containersSize += sz;
                const isRunning = c.State === "running";
                if (!isRunning) {
                  containersReclaimable += sz;
                }
              }

              let volumesSize = 0;
              let volumesReclaimable = 0;
              const volumesList = Array.isArray(data.Volumes) ? data.Volumes : [];
              for (const v of volumesList) {
                const sz = typeof v.UsageData?.Size === "number" ? v.UsageData.Size : 0;
                volumesSize += sz;
                const refCount = typeof v.UsageData?.RefCount === "number" ? v.UsageData.RefCount : 0;
                if (refCount <= 0) {
                  volumesReclaimable += sz;
                }
              }

              let buildCacheSize = 0;
              let buildCacheReclaimable = 0;
              const builderList = Array.isArray(data.BuildCache) ? data.BuildCache : [];
              for (const b of builderList) {
                const sz = typeof b.Size === "number" ? b.Size : 0;
                buildCacheSize += sz;
                if (!b.InUse) {
                  buildCacheReclaimable += sz;
                }
              }
              if (buildCacheSize === 0 && typeof data.BuilderSize === "number") {
                buildCacheSize = data.BuilderSize;
                buildCacheReclaimable = data.BuilderSize;
              }

              const totalSize = imagesSize + containersSize + volumesSize + buildCacheSize;
              const totalReclaimable = imagesReclaimable + containersReclaimable + volumesReclaimable + buildCacheReclaimable;

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                imagesSize,
                imagesReclaimable,
                imagesCount: imagesList.length,
                containersSize,
                containersReclaimable,
                containersCount: containersList.length,
                volumesSize,
                volumesReclaimable,
                volumesCount: volumesList.length,
                buildCacheSize,
                buildCacheReclaimable,
                totalSize,
                totalReclaimable,
              }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: err?.message || "Failed to retrieve disk usage" }));
            }
            return;
          }

          if (url === "/api/system/prune" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
              try {
                const options = JSON.parse(body || "{}");
                let spaceReclaimed = 0;
                let containersDeleted = 0;
                let imagesDeleted = 0;
                let volumesDeleted = 0;
                const buildCacheDeleted = 0;

                if (Array.isArray(options.containerIds) && options.containerIds.length > 0) {
                  for (const cid of options.containerIds) {
                    try {
                      await requestUnixSocket(socketPath, `/containers/${cid}?v=true&force=true`, "DELETE");
                      containersDeleted++;
                    } catch {
                      await new Promise<void>((resolve) => {
                        exec(`docker rm -f -v ${cid}`, () => resolve());
                      });
                      containersDeleted++;
                    }
                  }
                } else if (options.containers) {
                  try {
                    const cPrune = await requestUnixSocket(socketPath, "/containers/prune", "POST");
                    if (cPrune.data) {
                      spaceReclaimed += cPrune.data.SpaceReclaimed || 0;
                      containersDeleted += Array.isArray(cPrune.data.ContainersDeleted) ? cPrune.data.ContainersDeleted.length : 0;
                    }
                  } catch {
                    await new Promise<void>((resolve) => {
                      exec("docker container prune -f", () => resolve());
                    });
                  }
                }

                if (Array.isArray(options.imageIds) && options.imageIds.length > 0) {
                  for (const iid of options.imageIds) {
                    try {
                      await requestUnixSocket(socketPath, `/images/${encodeURIComponent(iid)}?force=true`, "DELETE");
                      imagesDeleted++;
                    } catch {
                      await new Promise<void>((resolve) => {
                        exec(`docker rmi -f ${iid}`, () => resolve());
                      });
                      imagesDeleted++;
                    }
                  }
                } else if (options.images) {
                  const imgFilter = options.allImages ? "?filters=%7B%22dangling%22%3A%5B%22false%22%5D%7D" : "";
                  try {
                    const iPrune = await requestUnixSocket(socketPath, `/images/prune${imgFilter}`, "POST");
                    if (iPrune.data) {
                      spaceReclaimed += iPrune.data.SpaceReclaimed || 0;
                      imagesDeleted += Array.isArray(iPrune.data.ImagesDeleted) ? iPrune.data.ImagesDeleted.length : 0;
                    }
                  } catch {
                    const flag = options.allImages ? "-a -f" : "-f";
                    await new Promise<void>((resolve) => {
                      exec(`docker image prune ${flag}`, () => resolve());
                    });
                  }
                }

                if (Array.isArray(options.volumeNames) && options.volumeNames.length > 0) {
                  for (const vname of options.volumeNames) {
                    try {
                      await requestUnixSocket(socketPath, `/volumes/${encodeURIComponent(vname)}?force=true`, "DELETE");
                      volumesDeleted++;
                    } catch {
                      await new Promise<void>((resolve) => {
                        exec(`docker volume rm -f ${vname}`, () => resolve());
                      });
                      volumesDeleted++;
                    }
                  }
                } else if (options.volumes) {
                  try {
                    const vPrune = await requestUnixSocket(socketPath, "/volumes/prune", "POST");
                    if (vPrune.data) {
                      spaceReclaimed += vPrune.data.SpaceReclaimed || 0;
                      volumesDeleted += Array.isArray(vPrune.data.VolumesDeleted) ? vPrune.data.VolumesDeleted.length : 0;
                    }
                  } catch {
                    await new Promise<void>((resolve) => {
                      exec("docker volume prune -f", () => resolve());
                    });
                  }
                }

                if (options.buildCache) {
                  try {
                    const bPrune = await requestUnixSocket(socketPath, "/build/prune", "POST");
                    if (bPrune.data) {
                      spaceReclaimed += bPrune.data.SpaceReclaimed || 0;
                    }
                  } catch {
                    await new Promise<void>((resolve) => {
                      exec("docker builder prune -f", () => resolve());
                    });
                  }
                }


                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  ok: true,
                  spaceReclaimed,
                  containersDeleted,
                  imagesDeleted,
                  volumesDeleted,
                  buildCacheDeleted,
                }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: err?.message || "Failed to prune system" }));
              }
            });
            return;
          }

          if (next) {
            return next();
          }
          res.statusCode = 404;
          res.end("Not Found");
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message || "Failed to communicate with container daemon" }));
        }
  };
}

export function attachPtyWebSocket(server: http.Server) {
  if (!server) return;

  try {
    const existing = server.rawListeners ? server.rawListeners("upgrade") : [];
    for (const listener of existing) {
      if (
        listener.__isPtyHandler ||
        (listener.toString && listener.toString().includes("/pty"))
      ) {
        server.removeListener("upgrade", listener);
      }
    }
  } catch {}

  const wss = new WebSocketServer({ noServer: true });

  const ptyUpgradeHandler = (
    req: http.IncomingMessage,
    socket: import("net").Socket,
    head: Buffer,
  ) => {
    const url = req.url || "";
    const match = url.match(/^\/api\/containers\/([a-zA-Z0-9_-]+)\/pty/);
    if (!match) {
      return;
    }

    const containerId = match[1];

    try {
      socket.setTimeout(0);
      socket.setNoDelay(true);
      socket.setKeepAlive(true, 10000);
    } catch {}

    wss.handleUpgrade(req, socket, head, async (ws: import("ws").WebSocket) => {
      try {
        const { activeEngine } = await detectEngines();
        if (!activeEngine || activeEngine.status !== "running") {
          ws.send(`\r\n\x1b[31m[Error]: Container engine is not running.\x1b[0m\r\n`);
          ws.close();
          return;
        }

        const socketPath = activeEngine.socketPath;

        let execId: string | null = null;
        try {
          const createRes = await requestUnixSocket(
            socketPath,
            `/containers/${containerId}/exec`,
            "POST",
            {
              AttachStdin: true,
              AttachStdout: true,
              AttachStderr: true,
              Tty: true,
              OpenStdin: true,
              StdinOnce: false,
              Env: [
                "TERM=xterm-256color",
                "COLORTERM=truecolor",
                "LANG=C.UTF-8",
              ],
              Cmd: [
                "sh",
                "-c",
                "export PS1='\\h:\\W\\$ '; [ -d /etc ] && echo 'export PS1=\"\\\\h:\\\\W\\\\$ \"' > /tmp/.ilc_profile 2>/dev/null; [ -f /tmp/.ilc_profile ] && export ENV=/tmp/.ilc_profile; if [ -x /bin/bash ]; then exec /bin/bash --login; elif [ -x /usr/bin/bash ]; then exec /usr/bin/bash --login; elif [ -x /bin/ash ]; then exec /bin/ash; elif [ -x /bin/sh ]; then exec /bin/sh; else exec sh; fi",
              ],
            }
          );
          if (createRes?.data?.Id) {
            execId = createRes.data.Id;
          }
        } catch {}

        if (!execId) {
          try {
            const fallbackRes = await requestUnixSocket(
              socketPath,
              `/containers/${containerId}/exec`,
              "POST",
              {
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Tty: true,
                OpenStdin: true,
                StdinOnce: false,
                Env: [
                  "TERM=xterm-256color",
                  "COLORTERM=truecolor",
                  "LANG=C.UTF-8",
                ],
                Cmd: ["/bin/sh"],
              }
            );
            if (fallbackRes?.data?.Id) {
              execId = fallbackRes.data.Id;
            }
          } catch {}
        }

        if (!execId) {
          try {
            const fallbackSh = await requestUnixSocket(
              socketPath,
              `/containers/${containerId}/exec`,
              "POST",
              {
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Tty: true,
                OpenStdin: true,
                StdinOnce: false,
                Env: [
                  "TERM=xterm-256color",
                  "COLORTERM=truecolor",
                  "LANG=C.UTF-8",
                ],
                Cmd: ["sh"],
              }
            );
            if (fallbackSh?.data?.Id) {
              execId = fallbackSh.data.Id;
            }
          } catch {}
        }

        if (!execId) {
          ws.send(`\r\n\x1b[31m[Error]: Failed to create exec instance in container.\x1b[0m\r\n`);
          ws.close();
          return;
        }

        const rawSocket = net.createConnection({ path: socketPath });
        let upgraded = false;
        let headerBuffer = Buffer.alloc(0);

        rawSocket.on("connect", () => {
          try {
            rawSocket.setTimeout(0);
            rawSocket.setNoDelay(true);
            rawSocket.setKeepAlive(true, 5000);
          } catch {}

          const execStartBody = JSON.stringify({ Detach: false, Tty: true });
          const reqLines = [
            `POST /exec/${execId}/start HTTP/1.1`,
            `Host: localhost`,
            `Connection: Upgrade`,
            `Upgrade: tcp`,
            `Content-Type: application/json`,
            `Content-Length: ${Buffer.byteLength(execStartBody)}`,
            ``,
            execStartBody,
          ];
          rawSocket.write(reqLines.join("\r\n"));
        });

        rawSocket.on("data", (chunk: Buffer) => {
          if (!upgraded) {
            headerBuffer = Buffer.concat([headerBuffer, chunk]);
            let separatorIndex = headerBuffer.indexOf("\r\n\r\n");
            let sepLen = 4;
            if (separatorIndex === -1) {
              separatorIndex = headerBuffer.indexOf("\n\n");
              sepLen = 2;
            }
            if (separatorIndex !== -1) {
              upgraded = true;
              const headerStr = headerBuffer.subarray(0, separatorIndex).toString("utf8");
              const remainder = headerBuffer.subarray(separatorIndex + sepLen);

              if (!headerStr.includes("101") && !headerStr.includes("200")) {
                if (ws.readyState === 1) {
                  ws.send(`\r\n\x1b[31m[Exec Error]: ${headerStr.split("\r\n")[0]}\x1b[0m\r\n`);
                  ws.close();
                }
                rawSocket.destroy();
                return;
              }

              requestUnixSocket(
                socketPath,
                `/exec/${execId}/resize?h=24&w=80`,
                "POST"
              ).catch(() => {});

              if (remainder.length > 0 && ws.readyState === 1) {
                ws.send(remainder);
              }
            }
            return;
          }

          if (ws.readyState === 1) {
            ws.send(chunk);
          }
        });

        rawSocket.on("end", () => {
          if (ws.readyState === 1) {
            ws.close();
          }
        });

        rawSocket.on("close", () => {
          if (ws.readyState === 1) {
            ws.close();
          }
        });

        rawSocket.on("error", (err: Error) => {
          if (ws.readyState === 1) {
            ws.send(`\r\n\x1b[31m[Exec Socket Error]: ${err.message}\x1b[0m\r\n`);
            ws.close();
          }
        });

        ws.on("message", (msg: import("ws").RawData) => {
          let str = "";
          if (typeof msg === "string") {
            str = msg;
          } else if (Buffer.isBuffer(msg)) {
            str = msg.toString("utf8");
          } else if (msg instanceof ArrayBuffer) {
            str = Buffer.from(msg).toString("utf8");
          }

          if (str.startsWith('{"type":"ping"')) {
            return;
          }
          if (str.startsWith('{"type":"resize"')) {
            try {
              const parsed = JSON.parse(str);
              if (parsed.cols && parsed.rows) {
                requestUnixSocket(
                  socketPath,
                  `/exec/${execId}/resize?h=${parsed.rows}&w=${parsed.cols}`,
                  "POST"
                ).catch(() => {});
              }
            } catch {}
            return;
          }

          if (rawSocket && rawSocket.writable) {
            const toSend = Buffer.isBuffer(msg)
              ? msg
              : msg instanceof ArrayBuffer
              ? Buffer.from(msg)
              : typeof msg === "string"
              ? Buffer.from(msg, "utf8")
              : Buffer.from(String(msg));
            rawSocket.write(toSend);
          }
        });

        ws.on("close", () => {
          try {
            rawSocket.destroy();
          } catch {}
        });

        ws.on("error", () => {
          try {
            rawSocket.destroy();
          } catch {}
        });
      } catch (err) {
        if (ws.readyState === 1) {
          ws.send(`\r\n\x1b[31m[Error]: ${err.message}\x1b[0m\r\n`);
          ws.close();
        }
      }
    });
  };

  (ptyUpgradeHandler as unknown as { __isPtyHandler?: boolean }).__isPtyHandler =
    true;
  server.on("upgrade", ptyUpgradeHandler);
}

export function createContainerEnginePlugin(): Plugin {
  const handler = createEngineHandler({ cors: false });
  return {
    name: "vite-container-engine-plugin",
    configureServer(server: ViteDevServer) {
      if (server.httpServer) {
        attachPtyWebSocket(server.httpServer);
      }
      server.middlewares.use((req, res, next) => {
        handler(req, res, next).catch(next);
      });
    },
  };
}