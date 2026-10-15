import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { getTerminalTheme } from "@/lib/terminalTheme";
import { getTerminalWsUrl, getAlternateTerminalWsUrl } from "@/lib/api/client";

export interface TerminalSession {
  containerId: string;
  containerName: string;
  term: XTerm;
  fitAddon: FitAddon;
  ws: WebSocket | null;
  wrapperEl: HTMLDivElement;
  isDark: boolean;
  isConnected: boolean;
  fontSize: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  reconnect: (force?: boolean) => void;
  clear: () => void;
  fit: () => void;
  dispose?: () => void;
}

const sessions = new Map<string, TerminalSession>();

function getSavedTerminalFontSize(): number {
  try {
    const val = localStorage.getItem("ilc_terminal_font_size");
    if (val) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed >= 8 && parsed <= 32) {
        return parsed;
      }
    }
  } catch {}
  return 12.5;
}

function saveTerminalFontSize(size: number) {
  try {
    localStorage.setItem("ilc_terminal_font_size", String(size));
  } catch {}
}

export function getOrCreateTerminalSession(
  containerId: string,
  containerName: string,
  isDark: boolean,
): TerminalSession {
  const existing = sessions.get(containerId);
  if (existing) {
    if (existing.isDark !== isDark) {
      existing.isDark = isDark;
      existing.term.options.theme = getTerminalTheme(isDark);
    }
    existing.containerName = containerName;
    if (!existing.ws || existing.ws.readyState >= WebSocket.CLOSING) {
      existing.reconnect();
    }
    return existing;
  }

  const initialFontSize = getSavedTerminalFontSize();

  const wrapperEl = document.createElement("div");
  wrapperEl.className = "w-full h-full min-h-0 select-text font-mono";
  wrapperEl.style.height = "100%";
  wrapperEl.style.width = "100%";

  const term = new XTerm({
    cursorBlink: true,
    fontFamily: "SF Mono, JetBrains Mono, Menlo, Monaco, Consolas, monospace",
    fontSize: initialFontSize,
    lineHeight: 1.25,
    rightClickSelectsWord: true,
    theme: getTerminalTheme(isDark),
    convertEol: true,
    cols: 80,
    rows: 24,
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(wrapperEl);

  let ws: WebSocket | null = null;
  let isConnected = false;
  let triedFallback = false;

  const fit = () => {
    try {
      if (wrapperEl.clientWidth > 50 && wrapperEl.clientHeight > 30) {
        fitAddon.fit();
      }
      const cols = Math.max(term.cols || 80, 20);
      const rows = Math.max(term.rows || 24, 5);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    } catch {}
  };

  const connectWs = (useFallback = false) => {
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {}
      ws = null;
    }

    term.write("\x1b[90mConnecting to container terminal...\x1b[0m\r\n");

    const currentCols = Math.max(term.cols || 80, 20);
    const currentRows = Math.max(term.rows || 24, 5);
    const url = useFallback
      ? getAlternateTerminalWsUrl(containerId, currentCols, currentRows)
      : getTerminalWsUrl(containerId, undefined, currentCols, currentRows);

    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    socket.onopen = () => {
      isConnected = true;
      session.isConnected = true;
      term.clear();
      pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: "ping" }));
          } catch {}
        } else if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
      }, 10000);
      fit();
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        if (event.data.startsWith('{"type":"pty-ready"')) {
          fit();
          return;
        }
        term.write(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data));
      }
    };

    socket.onclose = () => {
      if (pingTimer) clearInterval(pingTimer);
      const wasConnected = isConnected;
      isConnected = false;
      session.isConnected = false;
      if (wasConnected) {
        term.writeln("\r\n\x1b[90m[Terminal session disconnected]\x1b[0m\r\n");
      }
    };

    socket.onerror = () => {
      if (!isConnected && !triedFallback) {
        triedFallback = true;
        connectWs(true);
        return;
      }
      if (!isConnected) {
        term.writeln(
          "\r\n\x1b[31m[Connection error: Container engine unreachable]\x1b[0m\r\n",
        );
      }
    };

    ws = socket;
    session.ws = socket;
  };

  const disposables = [
    term.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      } else if (!isConnected) {
        session.reconnect();
      }
    }),
    term.onResize(({ cols, rows }) => {
      if (ws && ws.readyState === WebSocket.OPEN && cols >= 20 && rows >= 5) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    }),
  ];

  const handlePaste = (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData("text");
    if (text && ws && ws.readyState === WebSocket.OPEN) {
      e.preventDefault();
      ws.send(text);
    }
  };
  let currentFontSize = initialFontSize;

  const applyFontSize = (newSize: number) => {
    const clamped = Math.max(9, Math.min(30, newSize));
    currentFontSize = clamped;
    session.fontSize = clamped;
    term.options.fontSize = clamped;
    saveTerminalFontSize(clamped);
    fit();
  };

  const zoomIn = () => applyFontSize(currentFontSize + 1.5);
  const zoomOut = () => applyFontSize(currentFontSize - 1.5);
  const resetZoom = () => applyFontSize(12.5);

  term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey) {
      if (event.key === "=" || event.key === "+") {
        if (event.type === "keydown") {
          zoomIn();
        }
        return false;
      }
      if (event.key === "-" || event.key === "_") {
        if (event.type === "keydown") {
          zoomOut();
        }
        return false;
      }
      if (event.key === "0") {
        if (event.type === "keydown") {
          resetZoom();
        }
        return false;
      }
    }
    return true;
  });

  const session: TerminalSession = {
    containerId,
    containerName,
    term,
    fitAddon,
    ws: null,
    wrapperEl,
    isDark,
    isConnected: false,
    fontSize: currentFontSize,
    zoomIn,
    zoomOut,
    resetZoom,
    reconnect: (force = false) => {
      if (!force && ws && ws.readyState < WebSocket.CLOSING) {
        return;
      }
      triedFallback = false;
      connectWs(false);
    },
    clear: () => {
      term.clear();
    },
    fit,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      wrapperEl.removeEventListener("paste", handlePaste);
    },
  };

  wrapperEl.addEventListener("paste", handlePaste);
  sessions.set(containerId, session);
  connectWs(false);
  return session;
}

export function destroyTerminalSession(containerId: string): void {
  const session = sessions.get(containerId);
  if (!session) return;

  try {
    session.dispose?.();
    if (session.ws) {
      session.ws.close();
    }
    session.term.dispose();
    session.wrapperEl.remove();
  } catch {}

  sessions.delete(containerId);
}

export function clearAllTerminalSessions(): void {
  for (const containerId of sessions.keys()) {
    destroyTerminalSession(containerId);
  }
}
