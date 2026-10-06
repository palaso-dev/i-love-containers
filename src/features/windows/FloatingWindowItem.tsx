import React, { useRef, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/utils";
import {
  Terminal as TerminalIcon,
  FileText,
  X,
  Minus,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Trash2,
  Play,
  Pause,
  ArrowDown,
  Clock,
  Filter,
} from "lucide-react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  FloatingWindow,
  useWindowManagerStore,
} from "@/stores/useWindowManagerStore";
import { useAppStore } from "@/stores/useAppStore";
import { executeContainerCommand, fetchContainerLogs } from "@/lib/api";
import { getTerminalTheme, formatTerminalPrompt } from "@/lib/terminalTheme";
import { setupTerminalInput, TerminalController } from "@/lib/terminalInput";
import { sanitizeLogMessage } from "@/lib/utils";

interface FloatingWindowItemProps {
  windowData: FloatingWindow;
}

export const FloatingWindowItem: React.FC<FloatingWindowItemProps> = ({
  windowData,
}) => {
  const { theme, language } = useAppStore();
  const isDark = theme === "dark";
  const isEs = language === "es";
  const {
    closeWindow,
    focusWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    updateWindowBounds,
    appendWindowLog,
    clearWindowLogs,
    toggleWindowLogPause,
    toggleWindowLogAutoScroll,
    toggleWindowLogTimestamps,
    toggleWindowServiceFilter,
    setWindowServiceFilters,
  } = useWindowManagerStore();

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstanceRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentCwdRef = useRef<string>("/");
  const controllerRef = useRef<TerminalController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (windowData.type !== "terminal") return;
    if (!terminalRef.current) return;
    if (xtermInstanceRef.current) return;

    const savedFontSize = (() => {
      try {
        const val = localStorage.getItem("ilc_terminal_font_size");
        if (val) {
          const parsed = parseFloat(val);
          if (!isNaN(parsed) && parsed >= 8 && parsed <= 32) return parsed;
        }
      } catch {}
      return 12.5;
    })();

    let currentFontSize = savedFontSize;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "SF Mono, JetBrains Mono, Menlo, Monaco, Consolas, monospace",
      fontSize: savedFontSize,
      lineHeight: 1.25,
      rightClickSelectsWord: true,
      theme: getTerminalTheme(isDark),
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    try {
      fitAddon.fit();
    } catch {}

    const applyFontSize = (newSize: number) => {
      const clamped = Math.max(9, Math.min(30, newSize));
      currentFontSize = clamped;
      term.options.fontSize = clamped;
      try {
        localStorage.setItem("ilc_terminal_font_size", String(clamped));
      } catch {}
      try {
        fitAddon.fit();
      } catch {}
    };

    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        if (event.key === "=" || event.key === "+") {
          if (event.type === "keydown") applyFontSize(currentFontSize + 1.5);
          return false;
        }
        if (event.key === "-" || event.key === "_") {
          if (event.type === "keydown") applyFontSize(currentFontSize - 1.5);
          return false;
        }
        if (event.key === "0") {
          if (event.type === "keydown") applyFontSize(12.5);
          return false;
        }
      }
      return true;
    });

    xtermInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    const cName = windowData.containerName || "container";
    const cId = windowData.containerId || "";

    term.writeln(
      `\x1b[1;38;5;205m♥ \x1b[1mI ♥ Containers\x1b[0m \x1b[90m—\x1b[0m \x1b[1;38;5;45m${cName}\x1b[0m \x1b[90m(${cId.substring(0, 12)})\x1b[0m \x1b[90m•\x1b[0m \x1b[38;5;48m● Interactive Window Ready\x1b[0m`,
    );
    term.writeln("");

    const controller = setupTerminalInput({
      term,
      getPrompt: () => formatTerminalPrompt(cName, cId, currentCwdRef.current),
      onExecute: async (command) => {
        if (windowData.containerId) {
          const isCd = command === "cd" || command.startsWith("cd ");
          if (isCd) {
            try {
              const cdCmd = `${command} && pwd`;
              const res = await executeContainerCommand(
                windowData.containerId,
                cdCmd,
                term.cols,
                term.rows,
                currentCwdRef.current,
              );
              if (res.exitCode === 0 && res.output) {
                const lines = res.output.trim().split(/\r?\n/);
                const lastLine = lines[lines.length - 1].trim();
                if (lastLine.startsWith("/")) {
                  currentCwdRef.current = lastLine;
                }
              } else if (res.output) {
                term.writeln(res.output.replace(/\r?\n/g, "\r\n"));
              }
            } catch (err) {
              term.writeln(`\x1b[31merror: ${getErrorMessage(err)}\x1b[0m`);
            }
          } else {
            try {
              const res = await executeContainerCommand(
                windowData.containerId,
                command,
                term.cols,
                term.rows,
                currentCwdRef.current,
              );
              if (res.output) {
                const formattedOutput = res.output.replace(/\r?\n/g, "\r\n");
                term.write(formattedOutput);
                if (!formattedOutput.endsWith("\r\n")) {
                  term.writeln("");
                }
              }
            } catch (err) {
              term.writeln(`\x1b[31merror: ${getErrorMessage(err)}\x1b[0m`);
            }
          }
        } else {
          term.writeln(`\x1b[33mNo container attached to this session.\x1b[0m`);
        }
      },
    });

    controllerRef.current = controller;
    controller.redraw();

    const termEl = terminalRef.current;
    const handleContextMenu = (e: MouseEvent) => {
      const selection = term.getSelection();
      if (selection) {
        e.preventDefault();
        navigator.clipboard.writeText(selection);
      }
    };
    termEl?.addEventListener("contextmenu", handleContextMenu);

    const handleWindowResize = () => {
      if (fitAddonRef.current) fitAddonRef.current.fit();
    };

    window.addEventListener("resize", handleWindowResize);
    return () => {
      controller.dispose();
      termEl?.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("resize", handleWindowResize);
      term.dispose();
      xtermInstanceRef.current = null;
    };
  }, [windowData, theme, isDark]);

  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 30);
    }
  }, [windowData.width, windowData.height, windowData.isMaximized]);

  const logs = windowData.logs || [];
  const isPaused = windowData.isPaused ?? false;
  const autoScroll = windowData.autoScroll ?? true;
  const showTimestamps = windowData.showTimestamps ?? true;
  const activeFilters = windowData.activeServiceFilters;
  const availableServices = Array.from(new Set(logs.map((l) => l.source)));

  useEffect(() => {
    if (windowData.type !== "logs" || isPaused || !windowData.containerId)
      return;
    let isMounted = true;

    const fetchLogs = async () => {
      try {
        const rawLogs = await fetchContainerLogs(windowData.containerId!);
        if (!isMounted) return;

        const serviceName = windowData.containerName || "container";
        const color = isDark ? "#38bdf8" : "#0284c7";

        rawLogs.slice(-100).forEach((line) => {
          const parts = line.split(" ");
          const hasTimestamp =
            parts.length > 1 && /^\d{4}-\d{2}-\d{2}/.test(line);
          const timestamp = hasTimestamp
            ? parts.slice(0, 2).join(" ").substring(0, 19)
            : "";
          const message = hasTimestamp ? parts.slice(2).join(" ") : line;

          appendWindowLog(windowData.id, {
            id: `${windowData.containerId}-${timestamp}-${line.substring(0, 40)}`,
            timestamp:
              timestamp ||
              new Date().toISOString().substring(0, 19).replace("T", " "),
            source: serviceName,
            color,
            message: sanitizeLogMessage(message),
          });
        });
      } catch (err) {
        console.error("Failed to fetch logs in floating window:", err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [
    windowData.id,
    windowData.type,
    windowData.containerId,
    windowData.containerName,
    isPaused,
    isDark,
    appendWindowLog,
  ]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current?.parentElement) {
      logsEndRef.current.parentElement.scrollTop =
        logsEndRef.current.parentElement.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    if (windowData.isMaximized) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - windowData.x,
      y: e.clientY - windowData.y,
    });
    focusWindow(windowData.id);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      w: windowData.width,
      h: windowData.height,
    });
    focusWindow(windowData.id);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const nextX = Math.max(
          0,
          Math.min(window.innerWidth - 200, e.clientX - dragOffset.x),
        );
        const nextY = Math.max(
          0,
          Math.min(window.innerHeight - 100, e.clientY - dragOffset.y),
        );
        updateWindowBounds(windowData.id, { x: nextX, y: nextY });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const nextW = Math.max(
          380,
          Math.min(window.innerWidth - windowData.x, resizeStart.w + deltaX),
        );
        const nextH = Math.max(
          240,
          Math.min(window.innerHeight - windowData.y, resizeStart.h + deltaY),
        );
        updateWindowBounds(windowData.id, { width: nextW, height: nextH });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    dragOffset,
    resizeStart,
    windowData.id,
    windowData.x,
    windowData.y,
    updateWindowBounds,
  ]);

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `${showTimestamps ? l.timestamp + " " : ""}[${l.source}] ${l.message}`,
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isServiceActive = (name: string) => {
    return activeFilters === undefined ? true : activeFilters.includes(name);
  };

  const activeCount =
    activeFilters === undefined
      ? availableServices.length
      : availableServices.filter((s) => activeFilters.includes(s)).length;
  const allSelected =
    activeFilters === undefined || activeCount === availableServices.length;
  const noneSelected = activeFilters !== undefined && activeCount === 0;

  const handleSelectAll = () => {
    setWindowServiceFilters(windowData.id, null);
  };

  const handleDeselectAll = () => {
    setWindowServiceFilters(windowData.id, []);
  };

  const handleInvertSelection = () => {
    if (activeFilters === undefined) {
      setWindowServiceFilters(windowData.id, []);
    } else {
      setWindowServiceFilters(
        windowData.id,
        availableServices.filter((s) => !activeFilters.includes(s)),
      );
    }
  };

  const handleToggleService = (name: string) => {
    toggleWindowServiceFilter(windowData.id, name, false, availableServices);
  };

  const handleSoloService = (name: string) => {
    toggleWindowServiceFilter(windowData.id, name, true, availableServices);
  };

  const filteredLogs = logs.filter((l) => {
    if (activeFilters !== undefined && !activeFilters.includes(l.source))
      return false;
    if (searchQuery.trim() === "") return true;
    return (
      l.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.source.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (windowData.isMinimized) return null;

  return (
    <div
      onMouseDown={() => focusWindow(windowData.id)}
      style={{
        transform: `translate3d(${windowData.x}px, ${windowData.y}px, 0px)`,
        width: `${windowData.width}px`,
        height: `${windowData.height}px`,
        zIndex: windowData.zIndex,
      }}
      className={`fixed top-0 left-0 flex flex-col bg-surface border border-border rounded-xl shadow-2xl overflow-hidden pointer-events-auto transition-[box-shadow] ${
        windowData.isMaximized ? "rounded-none border-0" : ""
      }`}
    >
      <div
        onMouseDown={handleTitleMouseDown}
        className="h-10 px-3 bg-surface-secondary/80 border-b border-border flex items-center justify-between cursor-move  shrink-0"
      >
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 mr-1">
            <button
              onClick={() => closeWindow(windowData.id)}
              className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors group"
              title="Close window"
            >
              <X className="w-2 h-2 text-rose-950 opacity-0 group-hover:opacity-100" />
            </button>
            <button
              onClick={() => minimizeWindow(windowData.id)}
              className="w-3 h-3 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center transition-colors group"
              title="Minimize window"
            >
              <Minus className="w-2 h-2 text-amber-950 opacity-0 group-hover:opacity-100" />
            </button>
            <button
              onClick={() => toggleMaximizeWindow(windowData.id)}
              className="w-3 h-3 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-colors group"
              title={
                windowData.isMaximized ? "Restore window" : "Maximize window"
              }
            >
              <Maximize2 className="w-2 h-2 text-emerald-950 opacity-0 group-hover:opacity-100" />
            </button>
          </div>

          <div className="h-3 w-[1px] bg-border mx-0.5" />

          <div className="flex items-center space-x-1.5 font-mono text-2xs">
            {windowData.type === "terminal" ? (
              <TerminalIcon className="w-3 h-3 text-primary shrink-0" />
            ) : (
              <FileText className="w-3 h-3 text-sky-400 shrink-0" />
            )}
            <span className="font-semibold text-foreground truncate max-w-[240px]">
              {windowData.title}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => toggleMaximizeWindow(windowData.id)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            title={windowData.isMaximized ? "Restore" : "Maximize"}
          >
            {windowData.isMaximized ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => closeWindow(windowData.id)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div
        className={`flex-1 overflow-hidden relative flex flex-col ${
          isDark ? "bg-[#090b10]" : "bg-[#f8fafc]"
        }`}
      >
        {windowData.type === "terminal" ? (
          <div className="flex-1 w-full h-full p-2 select-text">
            <div ref={terminalRef} className="w-full h-full" />
          </div>
        ) : (
          <div
            className={`flex-1 flex flex-col w-full h-full select-text ${
              isDark ? "text-slate-200" : "text-slate-800"
            }`}
          >
            <div className="h-9 px-3 bg-surface border-b border-border flex items-center justify-between gap-2  shrink-0">
              <div className="flex items-center space-x-2 flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter logs..."
                  className="px-2 py-0.5 text-2xs bg-surface-secondary border border-border rounded text-foreground focus:outline-none font-mono max-w-[160px]"
                />
                <button
                  onClick={() => toggleWindowLogPause(windowData.id)}
                  className={`flex items-center space-x-1 px-2 py-0.5 text-2xs font-mono rounded border transition-colors ${
                    isPaused
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                      : "bg-surface-secondary border-border text-muted-foreground"
                  }`}
                >
                  {isPaused ? (
                    <Play className="w-2.5 h-2.5 fill-current" />
                  ) : (
                    <Pause className="w-2.5 h-2.5 fill-current" />
                  )}
                  <span>{isPaused ? "Resume" : "Pause"}</span>
                </button>
                <button
                  onClick={() => toggleWindowLogAutoScroll(windowData.id)}
                  className={`flex items-center space-x-1 px-2 py-0.5 text-2xs font-mono rounded border transition-colors ${
                    autoScroll
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-surface-secondary border-border text-muted-foreground"
                  }`}
                >
                  <ArrowDown className="w-2.5 h-2.5" />
                  <span>Scroll</span>
                </button>
                <button
                  onClick={() => toggleWindowLogTimestamps(windowData.id)}
                  className={`flex items-center space-x-1 px-2 py-0.5 text-2xs font-mono rounded border transition-colors ${
                    showTimestamps
                      ? "bg-surface-secondary border-border text-foreground"
                      : "bg-surface border-border text-muted-foreground"
                  }`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>Time</span>
                </button>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => clearWindowLogs(windowData.id)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                  title="Clear"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <button
                  onClick={handleCopyLogs}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                  title="Copy"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-status-running" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>

            {availableServices.length > 1 && (
              <div className="px-3 py-1 bg-surface/50 border-b border-border flex items-center space-x-1.5 overflow-x-auto text-2xs font-mono shrink-0 select-none">
                <div className="flex items-center space-x-1 text-muted-foreground shrink-0">
                  <Filter className="w-2.5 h-2.5" />
                  <span className="font-semibold">{isEs ? "Servicios" : "Services"}</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    ({activeCount}/{availableServices.length})
                  </span>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={handleSelectAll}
                    className={`px-1.5 py-0.5 rounded text-[11px] transition-colors border ${
                      allSelected
                        ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                        : "bg-surface-secondary text-muted-foreground hover:text-foreground border-border hover:bg-surface-hover"
                    }`}
                    title={isEs ? "Seleccionar todos los servicios" : "Select all services"}
                  >
                    {isEs ? "Todos" : "All"}
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className={`px-1.5 py-0.5 rounded text-[11px] transition-colors border ${
                      noneSelected
                        ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                        : "bg-surface-secondary text-muted-foreground hover:text-foreground border-border hover:bg-surface-hover"
                    }`}
                    title={isEs ? "Deseleccionar todos los servicios" : "Deselect all services"}
                  >
                    {isEs ? "Ninguno" : "None"}
                  </button>
                  <button
                    onClick={handleInvertSelection}
                    className="px-1.5 py-0.5 rounded text-[11px] transition-colors border bg-surface-secondary text-muted-foreground hover:text-foreground border-border hover:bg-surface-hover"
                    title={isEs ? "Invertir selección actual" : "Invert current selection"}
                  >
                    {isEs ? "Invertir" : "Invert"}
                  </button>
                </div>

                <div className="h-3 w-[1px] bg-border shrink-0 mx-0.5" />

                <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5">
                  {availableServices.map((serviceName) => {
                    const active = isServiceActive(serviceName);
                    return (
                      <div
                        key={serviceName}
                        className={`group inline-flex items-center rounded transition-all font-mono text-2xs border ${
                          active
                            ? "bg-surface-secondary text-foreground font-semibold border-border shadow-xs"
                            : "text-muted-foreground opacity-50 hover:opacity-85 border-transparent hover:border-border hover:bg-surface-secondary/50"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            if (e.altKey) {
                              handleSoloService(serviceName);
                            } else {
                              handleToggleService(serviceName);
                            }
                          }}
                          className="inline-flex items-center space-x-1 pl-2 pr-1.5 py-0.5 cursor-pointer"
                          title={
                            isEs
                              ? `${serviceName}: Clic para alternar • Alt+clic para aislar`
                              : `${serviceName}: Click to toggle • Alt+click to isolate`
                          }
                        >
                          <span className={active ? "text-primary font-bold" : "text-muted-foreground"}>
                            {active ? "●" : "○"}
                          </span>
                          <span>{serviceName}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSoloService(serviceName)}
                          className="mr-1 px-1 py-0 text-[9px] uppercase tracking-wider rounded font-mono text-muted-foreground/60 hover:text-primary hover:bg-primary/20 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                          title={isEs ? `Aislar ${serviceName} (ver solo este)` : `Isolate ${serviceName} (view only this)`}
                        >
                          {isEs ? "solo" : "solo"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 font-mono text-2xs leading-relaxed space-y-0.5 select-text">
              {noneSelected ? (
                <div className="h-full flex flex-col items-center justify-center space-y-2 text-muted-foreground select-none">
                  <Filter className="w-6 h-6 opacity-30 stroke-[1.5]" />
                  <span className="text-2xs font-mono font-medium">
                    {isEs ? "Ningún servicio seleccionado" : "No services selected"}
                  </span>
                  <button
                    onClick={handleSelectAll}
                    className="mt-0.5 px-2 py-0.5 text-[10px] font-mono rounded bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
                  >
                    {isEs ? "Seleccionar todos" : "Select all"}
                  </button>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div
                  className={`h-full flex items-center justify-center  ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {isEs ? "No se encontraron registros" : "No log entries found"}
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                  className={`flex items-start px-1 py-0.2 rounded font-mono ${
                    isDark ? "hover:bg-white/5" : "hover:bg-slate-200/70"
                  }`}
                >
                  {showTimestamps && (
                    <span
                      className={`mr-2  shrink-0 ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      {log.timestamp}
                    </span>
                  )}
                  <span
                    className="font-semibold mr-2 shrink-0 "
                    style={{ color: log.color }}
                  >
                    [{log.source}]
                  </span>
                  <span
                    className={`break-all whitespace-pre-wrap ${
                      isDark ? "text-slate-200" : "text-slate-800"
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>

      {!windowData.isMaximized && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 z-30 opacity-50 hover:opacity-100"
        >
          <div className="w-2 h-2 border-r-2 border-b-2 border-muted-foreground rounded-br-xs" />
        </div>
      )}
    </div>
  );
};
