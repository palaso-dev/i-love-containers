import React, { useState, useEffect, useRef, useCallback } from "react";
import "@xterm/xterm/css/xterm.css";
import { Terminal as TerminalIcon, Trash2, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ContainerNotRunning } from "@/components/ContainerNotRunning";
import { getOrCreateTerminalSession } from "@/lib/terminalSessionManager";
import { getCleanContainerName } from "@/lib/utils";

interface StandaloneTerminalWindowProps {
  containerId: string;
  containerName: string;
}

export const StandaloneTerminalWindow: React.FC<
  StandaloneTerminalWindowProps
> = ({ containerId, containerName }) => {
  const {
    theme,
    containers,
    language,
    zoomInUi,
    zoomOutUi,
    resetZoomUi,
  } = useAppStore();
  const isDark = theme === "dark";
  const isEs = language === "es";

  const currentContainer = containers.find((c) => c.id === containerId);
  const state = currentContainer?.state;
  const isRunning = !currentContainer || state === "running";

  const displayName = currentContainer?.composeService ||
    getCleanContainerName(currentContainer?.name || containerName, currentContainer?.composeProject);

  const terminalElementRef = useRef<HTMLDivElement>(null);

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

  const handleZoomInText = useCallback(() => {
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    session.zoomIn();
    setTerminalFontSize(session.fontSize);
  }, [containerId, containerName, isDark]);

  const handleZoomOutText = useCallback(() => {
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    session.zoomOut();
    setTerminalFontSize(session.fontSize);
  }, [containerId, containerName, isDark]);

  const handleResetZoomText = useCallback(() => {
    const session = getOrCreateTerminalSession(
      containerId,
      containerName,
      isDark,
    );
    session.resetZoom();
    setTerminalFontSize(session.fontSize);
  }, [containerId, containerName, isDark]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          if (e.shiftKey) {
            handleZoomInText();
          } else {
            zoomInUi();
          }
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          if (e.shiftKey) {
            handleZoomOutText();
          } else {
            zoomOutUi();
          }
        } else if (e.key === "0") {
          e.preventDefault();
          if (e.shiftKey) {
            handleResetZoomText();
          } else {
            resetZoomUi();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    containerId,
    containerName,
    isDark,
    zoomInUi,
    zoomOutUi,
    resetZoomUi,
    handleResetZoomText,
    handleZoomInText,
    handleZoomOutText,
  ]);

  useEffect(() => {
    if (!isRunning) return;
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
      session.fit();
    };

    const fitTimer = setTimeout(safeFit, 20);

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
  }, [containerId, containerName, isRunning, isDark]);

  if (!isRunning && state) {
    return (
      <ContainerNotRunning
        state={state}
        containerName={displayName || containerName}
        featureName="terminal"
      />
    );
  }

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden ${
        isDark ? "bg-[#0d1117]" : "bg-white"
      }`}
    >
      <div className="h-10 px-3 bg-surface-secondary border-b border-border flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2 text-xs font-mono text-muted-foreground truncate min-w-0">
          <TerminalIcon className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate font-semibold text-foreground text-xs">
            {displayName}
          </span>
          <span className="text-muted-foreground text-2xs">({containerId.substring(0, 12)})</span>
        </div>
        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            onClick={handleZoomOutText}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md bg-surface border border-border transition-colors cursor-pointer"
            title={isEs ? "Alejar texto (⇧⌘-)" : "Zoom out text (⇧⌘-)"}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetZoomText}
            className="px-2 py-1 text-xs font-mono text-muted-foreground hover:text-foreground rounded-md bg-surface border border-border transition-colors cursor-pointer"
            title={isEs ? "Restablecer texto (⇧⌘0)" : "Reset text zoom (⇧⌘0)"}
          >
            {Math.round((terminalFontSize / 12.5) * 100)}%
          </button>
          <button
            onClick={handleZoomInText}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md bg-surface border border-border transition-colors cursor-pointer"
            title={isEs ? "Acercar texto (⇧⌘+)" : "Zoom in text (⇧⌘+)"}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-[1px] bg-border mx-1" />
          <button
            onClick={handleReconnect}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-mono text-muted-foreground hover:text-foreground rounded-md bg-surface border border-border transition-colors cursor-pointer"
            title={isEs ? "Reconectar sesión" : "Reconnect session"}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isEs ? "Reconectar" : "Reconnect"}</span>
          </button>
          <button
            onClick={handleClear}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-mono text-muted-foreground hover:text-foreground rounded-md bg-surface border border-border transition-colors cursor-pointer"
            title={isEs ? "Limpiar consola" : "Clear console"}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isEs ? "Limpiar" : "Clear"}</span>
          </button>
        </div>
      </div>
      <div
        ref={terminalElementRef}
        className="flex-1 p-2 min-h-0 select-text font-mono overflow-hidden"
      />
    </div>
  );
};

