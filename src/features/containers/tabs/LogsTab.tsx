import React, { useState, useEffect, useRef } from "react";
import {
  Trash2,
  Download,
  Search,
  Clock,
  ChevronsDown,
  Tag,
  WrapText,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as api from "@/lib/api";
import { useAppStore } from "@/stores/useAppStore";
import { sanitizeLogMessage } from "@/lib/utils";

interface LogsTabProps {
  containerId: string;
  containerName?: string;
}

export const LogsTab: React.FC<LogsTabProps> = ({ containerId, containerName }) => {
  const { theme, containers, language } = useAppStore();
  const isDark = theme === "dark";
  const isEs = language === "es";
  const [logs, setLogs] = useState<string[]>([]);
  const [clearedTimestamp, setClearedTimestamp] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [showTag, setShowTag] = useState(() => {
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
  const [searchQuery, setSearchQuery] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, []);

  const resolvedContainer = containers.find((c) => c.id === containerId);
  const rawName = containerName || resolvedContainer?.name || "container";
  let displayName = rawName.replace(/^\//, "");
  const composeProj = resolvedContainer?.composeProject;
  if (composeProj) {
    if (displayName.toLowerCase().startsWith(`${composeProj.toLowerCase()}-`)) {
      displayName = displayName.slice(composeProj.length + 1);
    } else if (displayName.toLowerCase().startsWith(`${composeProj.toLowerCase()}_`)) {
      displayName = displayName.slice(composeProj.length + 1);
    }
    displayName = displayName.replace(/[-_]\d+$/, "");
  }
  const tagText = displayName || rawName.replace(/^\//, "");

  useEffect(() => {
    setLogs([]);
    setClearedTimestamp(null);
  }, [containerId]);

  useEffect(() => {
    let isMounted = true;

    const fetchLogs = async () => {
      try {
        const realLogs = await api.fetchContainerLogs(containerId);
        if (isMounted && Array.isArray(realLogs)) {
          if (!clearedTimestamp) {
            setLogs(realLogs);
          } else {
            const newerLogs = realLogs.filter((log) => {
              const firstSpace = log.indexOf(" ");
              const logTime = firstSpace > 0 ? log.slice(0, firstSpace) : log;
              return logTime > clearedTimestamp;
            });
            setLogs(newerLogs);
          }
        }
      } catch (err) {
        console.error("Failed to fetch container logs:", err);
      }
    };

    fetchLogs();
    const streamInterval = setInterval(fetchLogs, 2500);

    return () => {
      isMounted = false;
      clearInterval(streamInterval);
    };
  }, [containerId, clearedTimestamp]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  };

  const handleDownloadLogs = () => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const blob = new Blob([safeLogs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `container-${containerId}-logs.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const safeLogs = Array.isArray(logs) ? logs : [];
  const filteredLogs = safeLogs.filter(
    (log) =>
      typeof log === "string" &&
      log.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      className={`flex flex-col h-full border border-border rounded-lg overflow-hidden shadow-inner min-h-0 ${
        isDark ? "bg-[#090b10] text-slate-200" : "bg-white text-slate-800"
      }`}
    >
      <div className="h-10 px-3 bg-surface border-b border-border flex items-center justify-between gap-2 text-xs shrink-0">
        <div className="relative flex-1 max-w-xs min-w-[90px] flex items-center">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isEs ? "Buscar..." : "Find..."}
            className="w-full pl-8 pr-2.5 py-1 text-2xs bg-surface-secondary border border-border rounded text-foreground focus:outline-none font-mono placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => {
              const next = !autoScroll;
              setAutoScroll(next);
              if (next && containerRef.current) {
                containerRef.current.scrollTop =
                  containerRef.current.scrollHeight;
              }
            }}
            title={
              isEs
                ? autoScroll
                  ? "Seguir registros (Auto-scroll): ACTIVADO"
                  : "Seguir registros (Auto-scroll): DESACTIVADO"
                : autoScroll
                  ? "Follow logs (Auto-scroll): ON"
                  : "Follow logs (Auto-scroll): OFF"
            }
            className={`p-1.5 rounded border transition-colors ${
              autoScroll
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <ChevronsDown className="w-3.5 h-3.5" />
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
            className={`p-1.5 rounded border transition-colors ${
              showTimestamps
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              const next = !showTag;
              setShowTag(next);
              try {
                localStorage.setItem("ilc_logs_show_service_tags", String(next));
              } catch {}
            }}
            title={
              isEs
                ? showTag
                  ? "Etiqueta (Tag): ACTIVADO"
                  : "Etiqueta (Tag): DESACTIVADO"
                : showTag
                  ? "Tag: ON"
                  : "Tag: OFF"
            }
            className={`p-1.5 rounded border transition-colors ${
              showTag
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
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
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-surface-secondary border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <WrapText className="w-3 h-3" />
          </button>

          <div className="h-4 w-[1px] bg-border mx-0.5" />

          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Alejar (⌘-)" : "Zoom out (⌘-)"}
          >
            <ZoomOut className="w-3 h-3" />
          </button>

          <button
            onClick={handleResetZoom}
            className="px-1.5 py-1 text-2xs font-mono rounded border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Restablecer zoom (⌘0)" : "Reset zoom (⌘0)"}
          >
            {Math.round((fontSize / 11) * 100)}%
          </button>

          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded border border-border bg-surface-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Acercar (⌘+)" : "Zoom in (⌘+)"}
          >
            <ZoomIn className="w-3 h-3" />
          </button>

          <div className="h-4 w-[1px] bg-border mx-0.5" />

          <button
            onClick={() => {
              setLogs([]);
              setClearedTimestamp(new Date().toISOString());
            }}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Limpiar registros" : "Clear logs"}
          >
            <Trash2 className="w-3 h-3" />
          </button>

          <button
            onClick={handleDownloadLogs}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={isEs ? "Descargar registros" : "Download logs"}
          >
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ fontSize: `${fontSize}px` }}
        className={`flex-1 overflow-y-auto overflow-x-auto p-3 font-mono select-text leading-relaxed space-y-0.5 min-h-0 visible-scrollbar ${
          isDark ? "bg-[#090b10] text-slate-200" : "bg-[#f8fafc] text-slate-800"
        }`}
      >
        {filteredLogs.length === 0 ? (
          <div
            className={`h-full flex items-center justify-center  ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            {isEs ? "No hay registros que coincidan con el criterio" : "No log entries match criteria"}
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const firstSpace = log.indexOf(" ");
            const firstToken = firstSpace > 0 ? log.slice(0, firstSpace) : log;
            const hasIsoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(firstToken);

            let displayTimestamp = "";
            let messageContent = log;

            if (hasIsoTimestamp) {
              displayTimestamp = firstToken.substring(0, 19).replace("T", " ");
              messageContent = log.slice(firstSpace + 1);
            } else {
              const parts = log.split(" ");
              displayTimestamp = parts.slice(0, 2).join(" ");
              messageContent = parts.slice(2).join(" ");
            }

            return (
              <div
                key={index}
                className={`flex items-start px-1 py-0.5 rounded ${
                  wrapLines ? "w-full" : "w-max min-w-full"
                } ${isDark ? "hover:bg-white/[0.06]" : "hover:bg-slate-200/70"}`}
              >
                {showTimestamps && (
                  <span
                    className={`mr-2.5 shrink-0 font-mono ${
                      isDark ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    {displayTimestamp}
                  </span>
                )}
                {showTag && (
                  <span
                    className="font-semibold mr-2 shrink-0 truncate max-w-[140px] text-sky-400 dark:text-sky-300"
                    title={tagText}
                  >
                    [{tagText}]
                  </span>
                )}
                <span
                  className={`${
                    wrapLines
                      ? "break-all whitespace-pre-wrap flex-1 min-w-0"
                      : "whitespace-pre shrink-0"
                  } ${isDark ? "text-slate-200" : "text-slate-800"}`}
                >
                  {sanitizeLogMessage(messageContent)}
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
