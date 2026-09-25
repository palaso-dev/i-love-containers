import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Search,
  ChevronsDown,
  Clock,
  Tag,
  Trash2,
  Download,
  Filter,
  WrapText,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { useAppStore } from "@/stores/useAppStore";
import * as api from "@/lib/api";
import { sanitizeLogMessage, getCleanContainerName } from "@/lib/utils";

interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  color: string;
  message: string;
}

interface StandaloneLogsWindowProps {
  containerId?: string;
  containerName?: string;
  composeProject?: string;
}

export const StandaloneLogsWindow: React.FC<StandaloneLogsWindowProps> = ({
  containerId,
  containerName,
  composeProject,
}) => {
  const { theme, language, zoomInUi, zoomOutUi, resetZoomUi } = useAppStore();
  const isDark = theme === "dark";
  const isEs = language === "es";

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clearedAt, setClearedAt] = useState<number>(0);
  const clearedAtRef = useRef<number>(0);
  clearedAtRef.current = clearedAt;
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [showServiceTags, setShowServiceTags] = useState(() => {
    try {
      const saved = localStorage.getItem("ilc_logs_show_service_tags");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
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
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const handleZoomInText = () => {
    setFontSize((prev) => {
      const next = Math.min(26, prev + 1);
      try {
        localStorage.setItem("ilc_logs_font_size", String(next));
      } catch {}
      return next;
    });
  };

  const handleZoomOutText = () => {
    setFontSize((prev) => {
      const next = Math.max(9, prev - 1);
      try {
        localStorage.setItem("ilc_logs_font_size", String(next));
      } catch {}
      return next;
    });
  };

  const handleResetZoomText = () => {
    setFontSize(11);
    try {
      localStorage.setItem("ilc_logs_font_size", "11");
    } catch {}
  };

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
  }, [zoomInUi, zoomOutUi, resetZoomUi]);

  const availableServices = Array.from(new Set(logs.map((l) => l.source)));

  useEffect(() => {
    let isMounted = true;

    const fetchRealLogs = async () => {
      try {
        if (composeProject) {
          const containers = await api.fetchContainers();
          const projectContainers = containers.filter(
            (c) => c.composeProject === composeProject,
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
              let serviceName = c.composeService;
              if (!serviceName) {
                let name = c.name.replace(/^\//, "");
                if (composeProject && name.toLowerCase().startsWith(`${composeProject.toLowerCase()}-`)) {
                  name = name.slice(composeProject.length + 1);
                } else if (composeProject && name.toLowerCase().startsWith(`${composeProject.toLowerCase()}_`)) {
                  name = name.slice(composeProject.length + 1);
                }
                name = name.replace(/[-_]\d+$/, "");
                serviceName = name || c.name;
              }
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
                  timestamp: displayTimestamp || new Date().toISOString().substring(0, 19).replace("T", " "),
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
          if (isMounted) {
            const cutoff = clearedAtRef.current;
            const filtered = cutoff > 0
              ? combined.filter((l) => l.timestampMs > cutoff)
              : combined;
            setLogs(filtered.slice(-1000));
          }
        } else if (containerId) {
          const rawLogs = await api.fetchContainerLogs(containerId);
          if (!isMounted) return;

          const serviceName = getCleanContainerName(containerName || "container", composeProject);
          const color = isDark ? "#38bdf8" : "#0284c7";

          const parsed = rawLogs.map((line) => {
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
              id: `${containerId}-${rawTimestamp}-${line.substring(0, 40)}`,
              timestamp: displayTimestamp || new Date().toISOString().substring(0, 19).replace("T", " "),
              timestampMs,
              source: serviceName,
              color,
              message: sanitizeLogMessage(message),
            };
          });

          if (isMounted) {
            const cutoff = clearedAtRef.current;
            const filtered = cutoff > 0
              ? parsed.filter((l) => l.timestampMs > cutoff)
              : parsed;
            setLogs(filtered.slice(-1000));
          }
        }
      } catch (err) {
        console.error("Failed to load logs:", err);
      }
    };

    fetchRealLogs();
    const interval = setInterval(fetchRealLogs, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [containerId, containerName, composeProject, isDark]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current?.parentElement) {
      logsEndRef.current.parentElement.scrollTop =
        logsEndRef.current.parentElement.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  const handleDownload = () => {
    const text = logs
      .map((l) => `${l.timestamp} [${l.source}] ${l.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(composeProject || containerName || "logs").toLowerCase()}-stream.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleServiceFilter = (name: string) => {
    setActiveFilters((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  };

  const filteredLogs = logs.filter((l) => {
    if (activeFilters.length > 0 && !activeFilters.includes(l.source))
      return false;
    if (searchQuery.trim() === "") return true;
    return (
      l.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.source.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden ${
        isDark ? "bg-[#090b10] text-slate-200" : "bg-background text-slate-800"
      }`}
    >
      <div
        data-tauri-drag-region
        className="h-11 px-4 bg-surface border-b border-border flex items-center justify-between font-mono text-xs shrink-0 gap-3"
      >
        <div className="flex items-center space-x-2 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-status-running shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <FileText className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-foreground text-xs">
            {composeProject
              ? `${composeProject} ${isEs ? "(Registros unificados)" : "(Unified Logs)"}`
              : getCleanContainerName(containerName || "", composeProject) || (isEs ? "Registros de contenedor" : "Container Logs")}
          </span>
          {containerId && (
            <span className="text-muted-foreground text-2xs hidden sm:inline">
              ({containerId.substring(0, 12)})
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 flex-1 justify-end">
          <div className="relative max-w-xs w-full flex items-center">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEs ? "Buscar en registros..." : "Search log stream..."}
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-surface-secondary border border-border rounded-md text-foreground focus:outline-none font-mono"
            />
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title={
              isEs
                ? autoScroll
                  ? "Seguir registros (Auto-scroll): ACTIVADO"
                  : "Seguir registros (Auto-scroll): DESACTIVADO"
                : autoScroll
                  ? "Follow logs (Auto-scroll): ON"
                  : "Follow logs (Auto-scroll): OFF"
            }
            className={`p-1.5 rounded-md border transition-colors ${
              autoScroll
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <ChevronsDown className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowTimestamps(!showTimestamps)}
            title={
              isEs
                ? showTimestamps
                  ? "Hora / Marcas de tiempo: ACTIVADO"
                  : "Hora / Marcas de tiempo: DESACTIVADO"
                : showTimestamps
                  ? "Time / Timestamps: ON"
                  : "Time / Timestamps: OFF"
            }
            className={`p-1.5 rounded-md border transition-colors ${
              showTimestamps
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              const next = !showServiceTags;
              setShowServiceTags(next);
              try {
                localStorage.setItem("ilc_logs_show_service_tags", String(next));
              } catch {}
            }}
            className={`p-1.5 rounded-md border transition-colors ${
              showServiceTags
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
            title={
              isEs
                ? showServiceTags
                  ? "Etiqueta (Tag): ACTIVADO"
                  : "Etiqueta (Tag): DESACTIVADO"
                : showServiceTags
                  ? "Tag: ON"
                  : "Tag: OFF"
            }
          >
            <Tag className="w-4 h-4" />
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
            className={`p-1.5 rounded-md border transition-colors ${
              wrapLines
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <WrapText className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-border mx-0.5" />

          <button
            onClick={handleZoomOutText}
            className="p-1.5 rounded-md border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Alejar texto (⇧⌘-)" : "Zoom out text (⇧⌘-)"}
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            onClick={handleResetZoomText}
            className="px-2 py-1 text-xs font-mono rounded-md border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Restablecer texto (⇧⌘0)" : "Reset text zoom (⇧⌘0)"}
          >
            {Math.round((fontSize / 11) * 100)}%
          </button>

          <button
            onClick={handleZoomInText}
            className="p-1.5 rounded-md border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Acercar texto (⇧⌘+)" : "Zoom in text (⇧⌘+)"}
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-border mx-0.5" />

          <button
            onClick={() => {
              const now = Date.now();
              clearedAtRef.current = now;
              setClearedAt(now);
              setLogs([]);
            }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-secondary"
            title={isEs ? "Limpiar registros" : "Clear logs"}
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-secondary"
            title={isEs ? "Descargar archivo de registro" : "Download log file"}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {availableServices.length > 1 && (
        <div className="px-4 py-1.5 bg-surface/60 border-b border-border flex items-center space-x-2 font-mono text-2xs shrink-0 overflow-x-auto">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground mr-1">{isEs ? "Servicios:" : "Services:"}</span>
          {availableServices.map((name) => {
            const active =
              activeFilters.length === 0 || activeFilters.includes(name);
            return (
              <button
                key={name}
                onClick={() => toggleServiceFilter(name)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  active
                    ? "bg-surface-secondary text-foreground font-semibold border border-border"
                    : "text-muted-foreground opacity-50 hover:opacity-100 hover:bg-surface-secondary"
                }`}
              >
                {active ? "● " : "○ "}
                {name}
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{ fontSize: `${fontSize}px` }}
        className={`flex-1 overflow-y-auto overflow-x-auto p-4 select-text font-mono leading-relaxed space-y-0.5 min-h-0 visible-scrollbar ${
          isDark ? "bg-[#090b10] text-slate-200" : "bg-[#f8fafc] text-slate-800"
        }`}
      >
        {filteredLogs.length === 0 ? (
          <div
            className={`h-full flex items-center justify-center  ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            {isEs ? "No se encontraron registros" : "No log entries found"}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const shouldShowTag = showServiceTags;

            return (
              <div
                key={log.id}
                className={`flex items-start px-1 py-0.5 rounded font-mono ${
                  wrapLines ? "w-full" : "w-max min-w-full"
                } ${isDark ? "hover:bg-white/5" : "hover:bg-slate-200/70"}`}
              >
                {showTimestamps && (
                  <span
                    className={`mr-2.5 shrink-0 font-mono ${
                      isDark ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    {log.timestamp}
                  </span>
                )}
                {shouldShowTag && (
                  <span
                    className="font-semibold mr-2 shrink-0 truncate max-w-[280px]"
                    style={{ color: log.color }}
                    title={log.source}
                  >
                    [{log.source}]
                  </span>
                )}
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
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
