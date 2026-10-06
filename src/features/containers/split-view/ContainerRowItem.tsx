import React from "react";
import { Translations } from "@/lib/i18n";
import {
  Play,
  Square,
  Pause,
  RotateCw,
  Trash2,
  Terminal,
} from "lucide-react";
import { ContainerDetail, ContainerState } from "@/types";

import { TechIcon } from "@/components/TechIcon";
import { formatUptime, getCleanContainerName } from "@/lib/utils";
import { openRealNativeWindow } from "@/lib/nativeWindow";
import { IndeterminateCheckbox } from "./IndeterminateCheckbox";


interface ContainerRowItemProps {
  container: ContainerDetail;
  isSelected: boolean;
  isActionInProgress: boolean;
  selectedIds: Set<string>;
  t: Translations;
  getStatusDot: (state: ContainerState, size?: "sm" | "md") => string;
  onSelectContainer: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onStart: (id: string, e: React.MouseEvent) => void;
  onStop: (id: string, e: React.MouseEvent) => void;
  onPause: (id: string, e: React.MouseEvent) => void;
  onUnpause: (id: string, e: React.MouseEvent) => void;
  onRestart: (id: string, e: React.MouseEvent) => void;
  onDelete: (c: ContainerDetail, e: React.MouseEvent) => void;
  isNested?: boolean;
}

export const ContainerRowItem: React.FC<ContainerRowItemProps> = ({
  container,
  isSelected,
  selectedIds,
  t,
  getStatusDot,
  onSelectContainer,
  onToggleSelect,
  onStart,
  onStop,
  onPause,
  onUnpause,
  onRestart,
  onDelete,
  isNested = false,
}) => {
  const isRunning = container.state === "running";
  const isPaused = container.state === "paused";

  return (
    <div
      key={container.id}
      onClick={() => onSelectContainer(container.id)}
      className={`group/row relative px-3 py-2 cursor-pointer transition-colors flex items-center justify-between gap-2 select-none ${
        isNested ? "pl-7" : "pl-3"
      } ${
        isSelected
          ? "bg-primary/10 text-foreground font-medium"
          : "hover:bg-surface-secondary/60 text-foreground/85"
      }`}
    >
      {isSelected && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r" />
      )}
      {isNested && (
        <span className="absolute left-3.5 top-0 bottom-0 w-px bg-border/40" />
      )}
      <div className="flex items-center space-x-2 min-w-0">
        <IndeterminateCheckbox
          checked={selectedIds.has(container.id)}
          onChange={() => onToggleSelect(container.id)}
          title="Seleccionar para acciones en lote"
        />
        <span className={getStatusDot(container.state)} />
        <TechIcon
          image={container.image}
          name={container.name}
          className="w-4 h-4 shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center space-x-1.5">
            <span
              className={`text-xs truncate ${
                isSelected
                  ? "text-primary font-semibold"
                  : "font-medium text-foreground"
              }`}
            >
              {container.name}
            </span>
            {(() => {
              if (!container.ports || container.ports.length === 0) return null;
              const publicPorts = Array.from(
                new Set(
                  container.ports
                    .filter((p) => p.publicPort)
                    .map((p) => p.publicPort!),
                ),
              );
              if (publicPorts.length > 0) {
                return (
                  <span className="flex items-center gap-1">
                    {publicPorts.slice(0, 2).map((port) => (
                      <span
                        key={port}
                        className="text-[10px] font-mono text-muted-foreground font-medium bg-surface-secondary border border-border/70 px-1.5 py-0.2 rounded hover:text-primary transition-colors"
                      >
                        :{port}
                      </span>
                    ))}

                    {publicPorts.length > 2 && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        +{publicPorts.length - 2}
                      </span>
                    )}
                  </span>
                );
              }
              return null;
            })()}

          </div>
          <div className="text-[11px] font-mono text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
            {isRunning ? (
              <span>{formatUptime(container.status, container.startedAt)}</span>
            ) : isPaused ? (
              <span className="text-amber-400 font-medium">
                {t.containers.paused}
              </span>
            ) : (
              <span>{container.status || container.image}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            const cleanName = container.composeService ||
              getCleanContainerName(container.name, container.composeProject);
            openRealNativeWindow({
              id: `term-${container.id}-${Date.now()}`,
              title: `${cleanName} — Terminal`,
              type: "terminal",
              containerId: container.id,
              containerName: cleanName,
            });
          }}
          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-surface transition-colors"
          title="Open terminal in native OS window"
        >
          <Terminal className="w-3 h-3" />
        </button>

        {isRunning ? (
          <>
            <button
              onClick={(e) => onStop(container.id, e)}
              className="p-1 rounded text-muted-foreground hover:text-status-restarting hover:bg-surface transition-colors"
              title={t.containers.stop}
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
            <button
              onClick={(e) => onPause(container.id, e)}
              className="p-1 rounded text-muted-foreground hover:text-amber-500 hover:bg-surface transition-colors"
              title={t.containers.pause}
            >
              <Pause className="w-3 h-3 fill-current" />
            </button>
            <button
              onClick={(e) => onRestart(container.id, e)}
              className="p-1 rounded text-muted-foreground hover:text-sky-400 hover:bg-surface transition-colors"
              title={t.containers.restart}
            >
              <RotateCw className="w-3 h-3" />
            </button>
          </>
        ) : isPaused ? (
          <>
            <button
              onClick={(e) => onUnpause(container.id, e)}
              className="p-1 rounded text-status-running hover:bg-surface transition-colors"
              title={t.containers.unpause}
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
            <button
              onClick={(e) => onStop(container.id, e)}
              className="p-1 rounded text-muted-foreground hover:text-status-restarting hover:bg-surface transition-colors"
              title={t.containers.stop}
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          </>
        ) : (
          <button
            onClick={(e) => onStart(container.id, e)}
            className="p-1 rounded text-status-running hover:bg-surface transition-colors"
            title={t.containers.start}
          >
            <Play className="w-3 h-3 fill-current" />
          </button>
        )}

        <button
          onClick={(e) => onDelete(container, e)}
          className="p-1 rounded text-muted-foreground hover:text-status-danger hover:bg-surface transition-colors opacity-0 group-hover/row:opacity-100 focus:opacity-100"
          title={t.containers.remove}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
