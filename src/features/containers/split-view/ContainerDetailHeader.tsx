import React from "react";
import { NativeWindowOptions } from "@/lib/nativeWindow";
import { Translations } from "@/lib/i18n";
import {
  Play,
  Square,
  Pause,
  RotateCw,
  Trash2,
  AppWindow,
  Layers,
} from "lucide-react";
import { ContainerDetail, ContainerState } from "@/types";

import { TechIcon } from "@/components/TechIcon";
import { openRealNativeWindow } from "@/lib/nativeWindow";
import { formatUptime, getCleanContainerName } from "@/lib/utils";
import { useAppStore } from "@/stores/useAppStore";


interface ContainerDetailHeaderProps {
  t: Translations;
  activeContainer: ContainerDetail;
  isCompactDetail: boolean;
  containerDetailTab: string;
  tabs: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
  getStatusDot: (state: ContainerState, size?: "sm" | "md") => string;
  startContainer: (id: string) => Promise<boolean | void>;
  stopContainer: (id: string) => Promise<boolean | void>;
  pauseContainer: (id: string) => Promise<boolean | void>;
  unpauseContainer: (id: string) => Promise<boolean | void>;
  restartContainer: (id: string) => Promise<boolean | void>;
  setContainerToDelete: (c: ContainerDetail) => void;
  setActiveTab: (tab: string) => void;
  setSelectedImageId: (id: string | null) => void;
}

export const ContainerDetailHeader: React.FC<ContainerDetailHeaderProps> = ({
  t,
  activeContainer,
  isCompactDetail,
  containerDetailTab,
  tabs,
  getStatusDot,
  startContainer,
  stopContainer,
  pauseContainer,
  unpauseContainer,
  restartContainer,
  setContainerToDelete,
  setActiveTab,
  setSelectedImageId,
}) => {
  const { language } = useAppStore();

  return (

    <div className="p-3 sm:p-4 border-b border-border/80 flex flex-col gap-3 bg-surface/30 shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-xl bg-surface border border-border/80 shadow-xs shrink-0">
            <TechIcon
              name={activeContainer.name}
              image={activeContainer.image}
              className="w-5 h-5 sm:w-6 sm:h-6"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground truncate tracking-tight">
                {activeContainer.name}
              </h2>
              <div
                className={getStatusDot(activeContainer.state, "md")}
                title={activeContainer.state}
              />
            </div>
            <div className="flex items-center space-x-2 text-2xs font-mono text-muted-foreground mt-0.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("images");
                  setSelectedImageId(activeContainer.imageId || null);
                }}
                className="hover:text-primary hover:underline transition-colors flex items-center space-x-1 truncate max-w-[240px] text-left cursor-pointer"
                title={`Inspeccionar imagen ${activeContainer.image}`}
              >
                <Layers className="w-2.5 h-2.5 shrink-0 opacity-70" />
                <span className="truncate">{activeContainer.image}</span>
              </button>
              <span>•</span>
              <span className="shrink-0">
                {activeContainer.id.slice(0, 12)}
              </span>
              {activeContainer.status && (
                <>
                  <span>•</span>
                  <span className="shrink-0 text-foreground/80">
                    {formatUptime(activeContainer.status, activeContainer.startedAt)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
        <div className="flex items-center space-x-1.5">
          {activeContainer.state === "running" ? (
            <>
              <button
                onClick={() => stopContainer(activeContainer.id)}
                className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-border/80 text-status-restarting hover:bg-status-restarting/10 hover:border-status-restarting/40 transition-colors shadow-xs"
                title={t.containers.stop}
              >
                <Square className="w-3 h-3 fill-current" />
                {!isCompactDetail && <span>{t.containers.stop}</span>}
              </button>
              <button
                onClick={() => pauseContainer(activeContainer.id)}
                className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-border/80 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/40 transition-colors shadow-xs"
                title={t.containers.pause}
              >
                <Pause className="w-3 h-3 fill-current" />
                {!isCompactDetail && <span>{t.containers.pause}</span>}
              </button>
              <button
                onClick={() => restartContainer(activeContainer.id)}
                className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-border/80 text-foreground hover:bg-surface-secondary transition-colors shadow-xs"
                title={t.containers.restart}
              >
                <RotateCw className="w-3 h-3" />
                {!isCompactDetail && <span>{t.containers.restart}</span>}
              </button>
            </>
          ) : activeContainer.state === "paused" ? (
            <>
              <button
                onClick={() => unpauseContainer(activeContainer.id)}
                className="flex items-center space-x-1 px-2 sm:px-3 py-1 rounded-md text-xs font-medium bg-status-running text-white hover:opacity-90 transition-opacity shadow-xs"
                title={t.containers.unpause}
              >
                <Play className="w-3 h-3 fill-current" />
                {!isCompactDetail && <span>{t.containers.unpause}</span>}
              </button>
              <button
                onClick={() => stopContainer(activeContainer.id)}
                className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-border/80 text-status-restarting hover:bg-status-restarting/10 hover:border-status-restarting/40 transition-colors shadow-xs"
                title={t.containers.stop}
              >
                <Square className="w-3 h-3 fill-current" />
                {!isCompactDetail && <span>{t.containers.stop}</span>}
              </button>
            </>
          ) : (
            <button
              onClick={() => startContainer(activeContainer.id)}
              className="flex items-center space-x-1 px-2.5 sm:px-3.5 py-1 rounded-md text-xs font-medium bg-status-running text-white hover:opacity-90 transition-opacity shadow-xs"
              title={t.containers.start}
            >
              <Play className="w-3 h-3 fill-current" />
              {!isCompactDetail && <span>{t.containers.start}</span>}
            </button>
          )}

          <div className="h-4 w-[1px] bg-border/80 mx-0.5 hidden sm:block" />

          <button
            onClick={() => setContainerToDelete(activeContainer)}
            className="p-1.5 rounded-md bg-surface border border-border/80 text-muted-foreground hover:text-status-danger hover:bg-status-danger/10 hover:border-status-danger/40 transition-colors shadow-xs"
            title={t.containers.remove}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => {
              const tabType = containerDetailTab;
              const tabTitle =
                tabs.find((t) => t.id === tabType)?.label || tabType;
              const cleanName = activeContainer.composeService ||
                getCleanContainerName(activeContainer.name, activeContainer.composeProject);
              openRealNativeWindow({
                id: `${tabType}-${activeContainer.id}-${Date.now()}`,
                title: `${cleanName} — ${tabTitle}`,
                type: tabType as NativeWindowOptions["type"],
                containerId: activeContainer.id,
                containerName: cleanName,
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
    </div>
  );
};
