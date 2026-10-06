import React, { useState, useEffect, useRef } from "react";
import {
  Trash2,
  Download,
  Search,
  Clock,
  ChevronsDown,
  Filter,
  WrapText,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  WorkspaceSession,
  useWorkspaceStore,
} from "@/stores/useWorkspaceStore";
import { useAppStore } from "@/stores/useAppStore";
import * as api from "@/lib/api";
import { sanitizeLogMessage } from "@/lib/utils";

interface UnifiedLogsViewerProps {
  session: WorkspaceSession;
  isActive: boolean;
}

export const UnifiedLogsViewer: React.FC<UnifiedLogsViewerProps> = ({
  session,
  isActive,
}) => {
  const { theme, language, zoomInUi, zoomOutUi, resetZoomUi } = useAppStore();
  const isDark = theme === "dark";
  const isEs = language === "es";

  const {
    appendLog,
    clearSessionLogs,
    toggleSessionAutoScroll,
    toggleSessionTimestamps,
    toggleServiceFilter,
    setServiceFilters,
  } = useWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [fontSize, setFontSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("ilc_logs_font_size");
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 8 && parsed <= 30) return parsed;
      }
    } catch {}
    return 11;
  });
  const [wrapLines, setWrapLines] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    setFontSize((prev) => {
      const next = Math.min(26, prev + 1);
      try {
        localStorage.setItem("ilc_logs_font_size", String(next));
      } catch {}
      return next;
    });
  };

  const handleZoomOut = () => {
    setFontSize((prev) => {
      const next = Math.max(9, prev - 1);
      try {
        localStorage.setItem("ilc_logs_font_size", String(next));
      } catch {}
      return next;
    });
  };

  const handleResetZoom = () => {
    setFontSize(11);
    try {
      localStorage.setItem("ilc_logs_font_size", "11");
    } catch {}
  };

  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          if (e.shiftKey) {
            handleZoomIn();
          } else {
            zoomInUi();
          }
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          if (e.shiftKey) {
            handleZoomOut();
          } else {
            zoomOutUi();
          }
        } else if (e.key === "0") {
          e.preventDefault();
          if (e.shiftKey) {
            handleResetZoom();
          } else {
            resetZoomUi();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, zoomInUi, zoomOutUi, resetZoomUi]);

  const logs = session.logs || [];
  const autoScroll = session.autoScroll ?? true;
  const showTimestamps = session.showTimestamps ?? true;
  const activeFilters = session.activeServiceFilters;

  const availableServices = Array.from(new Set(logs.map((l) => l.source)));

  useEffect(() => {
    if (!isActive) return;
    let isMounted = true;

    const fetchRealLogs = async () => {
      try {
        if (session.composeProject) {
          const containers = await api.fetchContainers();
          const projectContainers = containers.filter(
            (c) => c.composeProject === session.composeProject,
          );
          if (projectContainers.length === 0) return;

          const colorPaletteDark = [
            "#38bdf8",
            "#a78bfa",
            "#34d399",
            "#f472b6",
            "#fbbf24",
            "#fb7185",
          ];
          const colorPaletteLight = [
            "#0284c7",
            "#7c3aed",
            "#059669",
            "#db2777",
            "#d97706",
            "#e11d48",
          ];

          const logsByContainer = await Promise.all(
            projectContainers.map(async (c, idx) => {
              const rawLogs = await api.fetchContainerLogs(c.id);
              const serviceName = c.composeService || c.name;
              const color = isDark
                ? colorPaletteDark[idx % colorPaletteDark.length]
                : colorPaletteLight[idx % colorPaletteLight.length];

              return rawLogs.map((line) => {
                const firstSpace = line.indexOf(" ");
                const firstToken = firstSpace > 0 ? line.slice(0, firstSpace) : line;
                const hasTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(firstToken);
                const rawTimestamp = hasTimestamp ? firstToken : "";
                const displayTimestamp = hasTimestamp
                  ? rawTimestamp.substring(0, 19).replace("T", " ")
                  : "";
                const message = hasTimestamp ? line.slice(firstSpace + 1) : line;
                const timestampMs = hasTimestamp ? new Date(rawTimestamp).getTime() : 0;

                return {
                  id: `${c.id}-${rawTimestamp}-${line.substring(0, 40)}`,
                  timestamp:
                    displayTimestamp ||
                    new Date().toISOString().substring(0, 19).replace("T", " "),
                  timestampMs,
                  source: serviceName,
                  color,
                  message: sanitizeLogMessage(message),
                };
              });
            }),
          );

          const combined = logsByContainer
            .flat()
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          if (isMounted && combined.length > 0) {
            combined
              .slice(-100)
              .forEach((entry) => appendLog(session.id, entry));
          }
        } else if (session.containerId) {
          const rawLogs = await api.fetchContainerLogs(session.containerId);
          if (!isMounted) return;

          const serviceName = session.containerName || "container";
          const color = isDark ? "#38bdf8" : "#0284c7";

          rawLogs.slice(-100).forEach((line) => {
            const firstSpace = line.indexOf(" ");
            const firstToken = firstSpace > 0 ? line.slice(0, firstSpace) : line;
            const hasTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(firstToken);
            const rawTimestamp = hasTimestamp ? firstToken : "";
            const displayTimestamp = hasTimestamp
              ? rawTimestamp.substring(0, 19).replace("T", " ")
              : "";
            const message = hasTimestamp ? line.slice(firstSpace + 1) : line;
            const timestampMs = hasTimestamp ? new Date(rawTimestamp).getTime() : 0;

            appendLog(session.id, {
              id: `${session.containerId}-${rawTimestamp}-${line.substring(0, 40)}`,
              timestamp:
                displayTimestamp ||
                new Date().toISOString().substring(0, 19).replace("T", " "),
              timestampMs,
              source: serviceName,
              color,
              message: sanitizeLogMessage(message),
            });
          });
        }
      } catch (err) {
        console.error("Failed to fetch logs in dock:", err);
      }
    };

    fetchRealLogs();
    const interval = setInterval(fetchRealLogs, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [
    session.id,
    session.containerId,
    session.containerName,
    session.composeProject,
    isActive,
    isDark,
    appendLog,
  ]);

  useEffect(() => {
    if (autoScroll && isActive && logsEndRef.current?.parentElement) {
      logsEndRef.current.parentElement.scrollTop =
        logsEndRef.current.parentElement.scrollHeight;
    }
  }, [logs.length, autoScroll, isActive]);

  const handleDownload = () => {
    const text = logs
      .map((l) => `${l.timestamp} [${l.source}] ${l.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${session.title.toLowerCase().replace(/\s+/g, "-")}-logs.txt`;
    link.click();
    URL.revokeObjectURL(url);
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
    setServiceFilters(session.id, null);
  };

  const handleDeselectAll = () => {
    setServiceFilters(session.id, []);
  };

  const handleInvertSelection = () => {
    if (activeFilters === undefined) {
      setServiceFilters(session.id, []);
    } else {
      setServiceFilters(
        session.id,
        availableServices.filter((s) => !activeFilters.includes(s)),
      );
    }
  };

  const handleToggleService = (name: string) => {
    toggleServiceFilter(session.id, name, false, availableServices);
  };

  const handleSoloService = (name: string) => {
    toggleServiceFilter(session.id, name, true, availableServices);
  };

  const filteredLogs = logs.filter((l) => {
    if (activeFilters !== undefined && !activeFilters.includes(l.source)) {
      return false;
    }
    if (searchQuery.trim() === "") return true;
    const query = searchQuery.toLowerCase();
    return (
      l.message.toLowerCase().includes(query) ||
      l.source.toLowerCase().includes(query)
    );
  });

  return (
    <div
      className={`w-full h-full flex flex-col select-text ${
        isDark ? "bg-[#090b10] text-slate-200" : "bg-[#f8fafc] text-slate-800"
      }`}
      style={{ display: isActive ? "flex" : "none" }}
    >
      <div className="h-9 px-3 bg-surface border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-2 flex-1">
          <div className="relative flex-1 max-w-xs flex items-center">
            <Search className="w-3 h-3 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEs ? "Buscar en registros..." : "Search in log stream..."}
              className="w-full pl-7 pr-2.5 py-1 text-2xs bg-surface-secondary border border-border rounded text-foreground focus:outline-none font-mono"
            />
          </div>

          <button
            onClick={() => toggleSessionAutoScroll(session.id)}
            title={
              isEs
                ? autoScroll
                  ? "Seguir registros (Auto-scroll): ACTIVADO"
                  : "Seguir registros (Auto-scroll): DESACTIVADO"
                : autoScroll
                  ? "Follow logs (Auto-scroll): ON"
                  : "Follow logs (Auto-scroll): OFF"
            }
            className={`p-1 rounded border transition-colors ${
              autoScroll
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <ChevronsDown className="w-2.5 h-2.5" />
          </button>

          <button
            onClick={() => toggleSessionTimestamps(session.id)}
            title={
              isEs
                ? showTimestamps
                  ? "Hora / Marcas de tiempo: ACTIVADO"
                  : "Hora / Marcas de tiempo: DESACTIVADO"
                : showTimestamps
                  ? "Time / Timestamps: ON"
                  : "Time / Timestamps: OFF"
            }
            className={`p-1 rounded border transition-colors ${
              showTimestamps
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-2.5 h-2.5" />
          </button>

          <button
            onClick={() => setWrapLines(!wrapLines)}
            title={
              isEs
                ? wrapLines
                  ? "Ajuste de línea: ACTIVADO (clic para activar desplazamiento horizontal)"
                  : "Ajuste de línea: DESACTIVADO (desplazamiento horizontal activo)"
                : wrapLines
                  ? "Word wrap: ON (click to scroll horizontally)"
                  : "Word wrap: OFF (horizontal scroll enabled)"
            }
            className={`p-1.5 rounded border transition-colors ${
              wrapLines
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <WrapText className="w-2.5 h-2.5" />
          </button>

          <div className="h-4 w-[1px] bg-border mx-0.5" />

          <button
            onClick={handleZoomOut}
            className="p-1 rounded border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Alejar (⌘-)" : "Zoom out (⌘-)"}
          >
            <ZoomOut className="w-2.5 h-2.5" />
          </button>

          <button
            onClick={handleResetZoom}
            className="px-1.5 py-0.5 text-2xs font-mono rounded border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Restablecer zoom (⌘0)" : "Reset zoom (⌘0)"}
          >
            {Math.round((fontSize / 11) * 100)}%
          </button>

          <button
            onClick={handleZoomIn}
            className="p-1 rounded border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Acercar (⌘+)" : "Zoom in (⌘+)"}
          >
            <ZoomIn className="w-2.5 h-2.5" />
          </button>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => clearSessionLogs(session.id)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Limpiar registros" : "Clear logs"}
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Descargar registros" : "Download logs"}
          >
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      {availableServices.length > 1 && (
        <div className="px-3 py-1.5 bg-surface/50 border-b border-border flex items-center space-x-2 overflow-x-auto text-2xs font-mono shrink-0 select-none">
          <div className="flex items-center space-x-1.5 text-muted-foreground shrink-0">
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

      <div
        ref={scrollContainerRef}
        style={{ fontSize: `${fontSize}px` }}
        className="flex-1 overflow-y-auto overflow-x-auto p-3 font-mono select-text leading-relaxed space-y-0.5 min-h-0 visible-scrollbar"
      >
        {noneSelected ? (
          <div className="h-full flex flex-col items-center justify-center space-y-2.5 text-muted-foreground select-none">
            <Filter className="w-8 h-8 opacity-30 stroke-[1.5]" />
            <span className="text-xs font-mono font-medium">
              {isEs ? "Ningún servicio seleccionado" : "No services selected"}
            </span>
            <span className="text-2xs text-muted-foreground/70">
              {isEs
                ? "Elige uno o más servicios en la barra superior o pulsa «Todos»"
                : "Choose one or more services above or click 'All'"}
            </span>
            <button
              onClick={handleSelectAll}
              className="mt-1 px-3 py-1 text-2xs font-mono rounded bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
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
                wrapLines ? "w-full" : "w-max min-w-full"
              } ${isDark ? "hover:bg-white/5" : "hover:bg-slate-200/70"}`}
            >
              {showTimestamps && (
                <span
                  className={`mr-2 shrink-0 ${
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
                className={`${
                  wrapLines
                    ? "break-all whitespace-pre-wrap flex-1 min-w-0"
                    : "whitespace-pre shrink-0"
                } ${isDark ? "text-slate-200" : "text-slate-800"}`}
              >
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
