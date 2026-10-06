import React from "react";
import { Translations } from "@/lib/i18n";
import {
  X,
  Play,
  Square,
  RotateCw,
  Terminal,
  FileText,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { ComposeServiceNode } from "@/lib/composeParser";
import { TechIcon, getTechBadgeInfo } from "@/components/TechIcon";
import { openRealNativeWindow } from "@/lib/nativeWindow";

interface ComposeServiceDrawerProps {
  selectedService: ComposeServiceNode;
  actionLoading: boolean;
  t: Translations;
  onClose: () => void;
  handleServiceAction: (
    serviceId: string,
    containerId: string,
    action: "start" | "stop" | "restart",
  ) => Promise<void>;
}

export const ComposeServiceDrawer: React.FC<ComposeServiceDrawerProps> = ({
  selectedService,
  actionLoading,
  t,
  onClose,
  handleServiceAction,
}) => {
  return (
    <div className="absolute top-3 right-3 bottom-3 w-80 max-w-[calc(100%-24px)] bg-popover border border-popover-border rounded-2xl shadow-2xl shadow-black/80 flex flex-col z-30 animate-in slide-in-from-right duration-200 canvas-interactive">
      <div className="p-3.5 border-b border-border/70 flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              selectedService.state === "running"
                ? "bg-status-running shadow-[0_0_8px_rgba(48,209,88,0.8)]"
                : selectedService.state === "paused"
                  ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                  : "bg-status-stopped"
            }`}
          />
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <TechIcon
                image={selectedService.image}
                name={selectedService.name}
                role={selectedService.role}
                className="w-4 h-4"
              />
              <h3 className="text-sm font-semibold text-foreground truncate">
                {selectedService.name}
              </h3>
            </div>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span
                className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full border shrink-0 ${
                  getTechBadgeInfo(
                    selectedService.image,
                    selectedService.name,
                    selectedService.role,
                  ).badgeStyle
                }`}
              >
                {
                  getTechBadgeInfo(
                    selectedService.image,
                    selectedService.name,
                    selectedService.role,
                  ).label
                }
              </span>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                • {selectedService.state}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        <div className="flex items-center space-x-2">
          {selectedService.state === "running" ? (
            <>
              <button
                disabled={actionLoading}
                onClick={() =>
                  selectedService.containerId &&
                  handleServiceAction(
                    selectedService.id,
                    selectedService.containerId,
                    "stop",
                  )
                }
                className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-surface border border-border text-status-restarting hover:bg-status-restarting/10 transition-colors shadow-xs disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Square className="w-3 h-3 fill-current" />
                )}
                <span>{t.containers.stop}</span>
              </button>
              <button
                disabled={actionLoading}
                onClick={() =>
                  selectedService.containerId &&
                  handleServiceAction(
                    selectedService.id,
                    selectedService.containerId,
                    "restart",
                  )
                }
                className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-surface border border-border text-sky-400 hover:bg-sky-400/10 transition-colors shadow-xs disabled:opacity-50"
              >
                <RotateCw
                  className={`w-3 h-3 ${actionLoading ? "animate-spin" : ""}`}
                />
                <span>{t.containers.restart}</span>
              </button>
            </>
          ) : (
            <button
              disabled={actionLoading}
              onClick={() =>
                selectedService.containerId &&
                handleServiceAction(
                  selectedService.id,
                  selectedService.containerId,
                  "start",
                )
              }
              className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-status-running text-white hover:opacity-90 transition-opacity shadow-xs disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>{t.containers.start}</span>
            </button>
          )}

          {selectedService.containerId && (
            <>
              <button
                onClick={() =>
                  openRealNativeWindow({
                    id: `term-${selectedService.containerId}-${Date.now()}`,
                    title: `${selectedService.name} — Terminal`,
                    type: "terminal",
                    containerId: selectedService.containerId,
                    containerName: selectedService.name,
                  })
                }
                className="p-1.5 rounded-lg bg-surface border border-border text-foreground hover:text-primary transition-colors shadow-xs"
                title="Open terminal window"
              >
                <Terminal className="w-3.5 h-3.5 text-primary" />
              </button>
              <button
                onClick={() =>
                  openRealNativeWindow({
                    id: `logs-${selectedService.containerId}-${Date.now()}`,
                    title: `${selectedService.name} — Logs`,
                    type: "logs",
                    containerId: selectedService.containerId,
                    containerName: selectedService.name,
                  })
                }
                className="p-1.5 rounded-lg bg-surface border border-border text-foreground hover:text-sky-400 transition-colors shadow-xs"
                title="Open logs window"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
              </button>
            </>
          )}
        </div>

        <div className="bg-surface-secondary/50 rounded-xl p-3 border border-border/60 space-y-2">
          <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
            Image
          </div>
          <div className="font-mono text-xs text-foreground break-all">
            {selectedService.image}
          </div>
          {selectedService.command && (
            <>
              <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold pt-1">
                {t.compose.command}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground bg-surface p-1.5 rounded border border-border/50 break-all">
                {selectedService.command}
              </div>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
            {t.compose.ports} ({selectedService.ports.length})
          </div>
          {selectedService.ports.length > 0 ? (
            <div className="space-y-1">
              {selectedService.ports.map((p, idx) => (
                <div
                  key={idx}
                  className="bg-surface-secondary/60 px-2 py-1 rounded-md border border-border/60 font-mono text-[11px] flex items-center justify-between"
                >
                  <span className="text-foreground">:{p}</span>
                  <a
                    href={`http://localhost:${p.split(":")[0] || p}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline flex items-center space-x-1"
                  >
                    <span>open</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground/70 italic text-[11px]">
              No exposed ports
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
            {t.compose.networks}
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedService.networks.map((net, idx) => (
              <span
                key={idx}
                className="bg-surface px-2 py-0.5 rounded-md border border-border font-mono text-[10px] text-foreground"
              >
                {net}
              </span>
            ))}
          </div>
        </div>

        {selectedService.volumes.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
              {t.compose.volumes} ({selectedService.volumes.length})
            </div>
            <div className="space-y-1 font-mono text-[10px]">
              {selectedService.volumes.map((v, idx) => (
                <div
                  key={idx}
                  className="bg-surface-secondary/50 p-1.5 rounded-md border border-border/60 text-muted-foreground break-all"
                >
                  {v}
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedService.environment &&
          selectedService.environment.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                {t.compose.environment} ({selectedService.environment.length})
              </div>
              <div className="space-y-1 font-mono text-[10px] max-h-36 overflow-y-auto">
                {selectedService.environment.map((env, idx) => (
                  <div
                    key={idx}
                    className="bg-surface-secondary/50 p-1.5 rounded-md border border-border/60 text-foreground break-all"
                  >
                    {env}
                  </div>
                ))}
              </div>
            </div>
          )}

        {selectedService.dependsOn.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
              {t.compose.dependsOn}
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedService.dependsOn.map((dep, idx) => (
                <span
                  key={idx}
                  className="bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-md font-mono text-[10px]"
                >
                  {dep}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
