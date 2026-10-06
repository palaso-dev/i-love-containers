import React, { useState } from "react";
import { NativeWindowOptions } from "@/lib/nativeWindow";
import {
  ArrowLeft,
  Play,
  Square,
  RotateCw,
  Trash2,
  Box,
  FileText,
  Terminal,
  Activity,
  AppWindow,
  Folder,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { openRealNativeWindow } from "@/lib/nativeWindow";
import { OverviewTab } from "./tabs/OverviewTab";
import { LogsTab } from "./tabs/LogsTab";
import { TerminalTab } from "./tabs/TerminalTab";
import { StatsTab } from "./tabs/StatsTab";
import { FileManagerTab } from "./tabs/FileManagerTab";
import { TechIcon } from "@/components/TechIcon";

export const ContainerDetailView: React.FC = () => {
  const {
    selectedContainerId,
    setSelectedContainerId,
    containerDetailTab,
    setContainerDetailTab,
    language,
    containers,
    startContainer,
    stopContainer,
    restartContainer,
    removeContainer,
  } = useAppStore();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const container = containers.find((c) => c.id === selectedContainerId);

  if (!container) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center text-center bg-background">
        <Box className="w-10 h-10 text-muted-foreground mb-3" />
        <h2 className="text-xs font-semibold text-foreground">
          Container not found
        </h2>
        <button
          onClick={() => setSelectedContainerId(null)}
          className="mt-3 px-3 py-1.5 text-xs bg-surface-secondary rounded text-foreground hover:bg-surface-hover"
        >
          Back to list
        </button>
      </div>
    );
  }

  const isRunning = container.state === "running";

  const tabs: {
    id: "overview" | "logs" | "terminal" | "stats" | "files";
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "overview", label: "Overview", icon: Box },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "terminal", label: "Terminal", icon: Terminal },
    { id: "stats", label: "Stats", icon: Activity },
    { id: "files", label: "Files", icon: Folder },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3.5">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            onClick={() => setSelectedContainerId(null)}
            className="flex items-center space-x-1 px-2 py-1 rounded-md bg-surface border border-border/70 text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors shadow-xs text-xs font-medium"
            title="Back to containers list"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Containers</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isRunning
                    ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.6)]"
                    : "bg-status-stopped"
                }`}
              />
              <TechIcon
                image={container.image}
                name={container.name}
                className="w-4 h-4 shrink-0"
              />
              <h1 className="text-sm font-semibold text-foreground tracking-tight truncate">
                {container.name}
              </h1>
              <span className="text-2xs font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-surface-secondary/70 border border-border/60">
                {container.id.substring(0, 12)}
              </span>
            </div>
            <p className="text-2xs text-muted-foreground font-mono mt-0.5 truncate">
              {container.image} • {container.status}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-1.5 shrink-0">
          <div className="flex items-center space-x-2">
            {isRunning ? (
              <>
                <button
                  onClick={() => stopContainer(container.id)}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-border/70 text-status-restarting hover:bg-status-restarting/10 hover:border-status-restarting/40 transition-colors shadow-xs"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop</span>
                </button>
                <button
                  onClick={() => restartContainer(container.id)}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-border/70 text-sky-500 hover:bg-sky-500/10 hover:border-sky-500/40 transition-colors shadow-xs"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Restart</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => startContainer(container.id)}
                className="flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium bg-status-running text-white hover:opacity-90 transition-opacity shadow-xs"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Start</span>
              </button>
            )}

            <div className="h-4 w-[1px] bg-border/80 mx-0.5 hidden sm:block" />

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-md bg-surface border border-border/70 text-muted-foreground hover:text-status-danger hover:bg-status-danger/10 hover:border-status-danger/40 transition-colors shadow-xs"
              title="Remove container"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => {
              const tabType = containerDetailTab;
              const tabTitle =
                tabs.find((t) => t.id === tabType)?.label || tabType;
              openRealNativeWindow({
                id: `${tabType}-${container.id}-${Date.now()}`,
                title: `${container.name} — ${tabTitle}`,
                type: tabType as NativeWindowOptions["type"],
                containerId: container.id,
                containerName: container.name,
              });
            }}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-surface border border-border/70 text-foreground hover:text-primary hover:border-primary/40 transition-colors shadow-xs shrink-0 cursor-pointer text-xs font-medium"
            title={
              language === "es"
                ? `Desacoplar ${tabs.find((t) => t.id === containerDetailTab)?.label} a una ventana independiente`
                : `Detach ${tabs.find((t) => t.id === containerDetailTab)?.label} into a separate window`
            }
          >
            <AppWindow className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{language === "es" ? "Desacoplar" : "Detach"}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center">
        <div className="inline-flex items-center bg-surface-secondary/70 border border-border/60 p-0.5 rounded-lg shadow-xs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = containerDetailTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setContainerDetailTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-1">
        <div
          className={
            containerDetailTab === "overview" ||
            containerDetailTab === "inspect"
              ? "h-full w-full"
              : "hidden"
          }
        >
          <OverviewTab container={container} />
        </div>
        <div
          className={
            containerDetailTab === "stats" ? "h-full w-full" : "hidden"
          }
        >
          <StatsTab
            containerId={container.id}
            containerState={container.state}
          />
        </div>
        <div
          className={containerDetailTab === "logs" ? "h-full w-full" : "hidden"}
        >
          <LogsTab containerId={container.id} />
        </div>
        <div
          className={
            containerDetailTab === "terminal"
              ? "h-[calc(100vh-210px)] min-h-[500px] w-full flex flex-col min-h-0"
              : "hidden"
          }
        >
          <TerminalTab
            key={container.id}
            containerId={container.id}
            containerName={container.name}
            containerState={container.state}
            isActive={containerDetailTab === "terminal"}
          />
        </div>
        <div
          className={
            containerDetailTab === "files"
              ? "h-[600px] border border-border/70 rounded-xl overflow-hidden flex flex-col"
              : "hidden"
          }
        >
          <FileManagerTab
            containerId={container.id}
            containerName={container.name}
            containerState={container.state}
          />
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-popover border border-popover-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-black/70 animate-in zoom-in-95 duration-100">
            <h3 className="text-sm font-semibold text-foreground">
              Remove Container?
            </h3>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              Are you sure you want to permanently remove container{" "}
              <span className="font-mono text-status-danger font-medium">
                {container.name}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 rounded-md text-xs font-medium text-foreground bg-surface border border-border/80 hover:bg-surface-secondary transition-colors shadow-xs"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await removeContainer(container.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-3 py-1 rounded-md text-xs font-medium bg-status-danger hover:bg-status-danger/90 text-white shadow-xs transition-opacity"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
