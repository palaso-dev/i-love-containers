import React, { useState, useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import { Trash2, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ContainerNotRunning } from "@/components/ContainerNotRunning";
import { ContainerState } from "@/types";
import { getOrCreateTerminalSession } from "@/lib/terminalSessionManager";

interface TerminalTabProps {
  containerId: string;
  containerName: string;
  containerState?: ContainerState;
  isActive?: boolean;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({
  containerId,
  containerName,
  containerState,
  isActive = true,
}) => {
  const { theme, containers, language } = useAppStore();
  const isDark = theme === "dark";
  const isEs = language === "es";

  const currentContainer = containers.find((c) => c.id === containerId);
  const state = containerState ?? currentContainer?.state;
  const isRunning = !currentContainer || state === "running";

  const terminalElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRunning || !isActive) return;
    const containerEl = terminalElementRef.current;
    if (!containerEl) return;

    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );

    if (session.wrapperEl.parentElement !== containerEl) {
      containerEl.innerHTML = "";
      containerEl.appendChild(session.wrapperEl);
    }

    const safeFit = () => {
      if (
        !containerEl ||
        containerEl.clientWidth < 100 ||
        containerEl.clientHeight < 50
      ) {
        return;
      }
      try {
        session.fitAddon.fit();
        if (session.term.cols < 30) {
          session.term.resize(80, 24);
        }
      } catch {}
    };

    const fitTimer = setTimeout(safeFit, 25);

    const handleContextMenu = (e: MouseEvent) => {
      const selection = session.term.getSelection();
      if (selection) {
        e.preventDefault();
        navigator.clipboard.writeText(selection);
      }
    };
    containerEl.addEventListener("contextmenu", handleContextMenu);

    const handleResize = () => {
      safeFit();
    };
    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(safeFit);
    });
    resizeObserver.observe(containerEl);

    return () => {
      clearTimeout(fitTimer);
      containerEl.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [containerId, containerName, isRunning, isDark, isActive]);

  useEffect(() => {
    if (!isActive || !isRunning) return;
    const containerEl = terminalElementRef.current;
    if (!containerEl) return;
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    if (session.wrapperEl.parentElement !== containerEl) {
      containerEl.innerHTML = "";
      containerEl.appendChild(session.wrapperEl);
    }
    if (!session.ws || session.ws.readyState >= WebSocket.CLOSING) {
      session.reconnect();
    }
    const timer = setTimeout(() => {
      try {
        if (containerEl.clientWidth >= 100 && containerEl.clientHeight >= 50) {
          session.fitAddon.fit();
        }
        session.term.focus();
      } catch {}
    }, 40);
    return () => clearTimeout(timer);
  }, [isActive, isRunning, containerId, containerName, isDark]);

  const handleClear = () => {
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    session.clear();
  };

  const handleReconnect = () => {
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    session.reconnect(true);
  };

  const [terminalFontSize, setTerminalFontSize] = useState<number>(() => {
    try {
      const val = localStorage.getItem("ilc_terminal_font_size");
      if (val) {
        const parsed = parseFloat(val);
        if (!isNaN(parsed) && parsed >= 8 && parsed <= 32) return parsed;
      }
    } catch {}
    return 12.5;
  });

  const handleZoomIn = () => {
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    session.zoomIn();
    setTerminalFontSize(session.fontSize);
  };

  const handleZoomOut = () => {
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    session.zoomOut();
    setTerminalFontSize(session.fontSize);
  };

  const handleResetZoom = () => {
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    session.resetZoom();
    setTerminalFontSize(session.fontSize);
  };

  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.shiftKey) {
          if (e.key === "=" || e.key === "+") {
            e.preventDefault();
            handleZoomIn();
          } else if (e.key === "-" || e.key === "_") {
            e.preventDefault();
            handleZoomOut();
          } else if (e.key === "0") {
            e.preventDefault();
            handleResetZoom();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, containerId, containerName, isDark]);

  if (!isRunning && state) {
    return (
      <ContainerNotRunning
        state={state}
        containerName={containerName}
        featureName="terminal"
      />
    );
  }

  return (
    <div
      className={`flex flex-col h-full w-full min-h-0 border border-border rounded-lg overflow-hidden shadow-inner ${
        isDark ? "bg-[#0d1117]" : "bg-white"
      }`}
    >
      <div className="h-8 px-2.5 bg-surface-secondary/70 border-b border-border flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2 text-2xs font-mono text-muted-foreground truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-status-running" />
          <span className="truncate font-medium text-foreground">
            {containerName}
          </span>
          <span className="opacity-60">({containerId.substring(0, 12)})</span>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={handleZoomOut}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
            title={isEs ? "Alejar texto (⇧⌘-)" : "Zoom out (⇧⌘-)"}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="px-1.5 py-0.5 text-2xs font-mono text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
            title={isEs ? "Restablecer texto (⇧⌘0)" : "Reset zoom (⇧⌘0)"}
          >
            {Math.round((terminalFontSize / 12.5) * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
            title={isEs ? "Acercar texto (⇧⌘+)" : "Zoom in (⇧⌘+)"}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="h-3.5 w-[1px] bg-border mx-1" />
          <button
            onClick={handleReconnect}
            className="flex items-center space-x-1 px-1.5 py-0.5 text-2xs font-mono text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
            title={isEs ? "Reconectar sesión" : "Reconnect session"}
          >
            <RefreshCw className="w-3 h-3" />
            <span>{isEs ? "Reconectar" : "Reconnect"}</span>
          </button>
          <button
            onClick={handleClear}
            className="flex items-center space-x-1 px-1.5 py-0.5 text-2xs font-mono text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
            title={isEs ? "Limpiar consola" : "Clear console"}
          >
            <Trash2 className="w-3 h-3" />
            <span>{isEs ? "Limpiar" : "Clear"}</span>
          </button>
        </div>
      </div>

      <div
        ref={terminalElementRef}
        className="flex-1 w-full min-h-0 p-2 select-text font-mono overflow-hidden"
      />
    </div>
  );
};
