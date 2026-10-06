import React from "react";
import { Translations } from "@/lib/i18n";
import {
  ChevronRight,
  ChevronDown,
  FolderGit2,
  FileText,
  Play,
  Square,
  RotateCw,
  Trash2,
} from "lucide-react";
import { ContainerDetail, ContainerState } from "@/types";
import { openRealNativeWindow } from "@/lib/nativeWindow";
import { IndeterminateCheckbox } from "./IndeterminateCheckbox";
import { ContainerRowItem } from "./ContainerRowItem";

interface ComposeGroupSectionProps {
  groupName: string;
  groupList: ContainerDetail[];
  activeContainer: ContainerDetail | null;
  selectedIds: Set<string>;
  collapsedStacks: Set<string>;
  isActionInProgress: boolean;
  t: Translations;
  getStatusDot: (state: ContainerState, size?: "sm" | "md") => string;
  toggleStackCollapse: (stackName: string) => void;
  toggleGroupSelect: (groupList: ContainerDetail[]) => void;
  toggleContainerSelect: (id: string) => void;
  onSelectContainer: (id: string) => void;
  handleStartAll: (
    name: string,
    list: ContainerDetail[],
    e: React.MouseEvent,
  ) => void;
  handleStopAll: (list: ContainerDetail[], e: React.MouseEvent) => void;
  handleRestartAll: (
    name: string,
    list: ContainerDetail[],
    e: React.MouseEvent,
  ) => void;
  setStackToDelete: (s: {
    name: string;
    containers: ContainerDetail[];
  }) => void;
  onStart: (id: string, e: React.MouseEvent) => void;
  onStop: (id: string, e: React.MouseEvent) => void;
  onPause: (id: string, e: React.MouseEvent) => void;
  onUnpause: (id: string, e: React.MouseEvent) => void;
  onRestart: (id: string, e: React.MouseEvent) => void;
  onDelete: (c: ContainerDetail, e: React.MouseEvent) => void;
}

export const ComposeGroupSection: React.FC<ComposeGroupSectionProps> = ({
  groupName,
  groupList,
  activeContainer,
  selectedIds,
  collapsedStacks,
  isActionInProgress,
  t,
  getStatusDot,
  toggleStackCollapse,
  toggleGroupSelect,
  toggleContainerSelect,
  onSelectContainer,
  handleStartAll,
  handleStopAll,
  handleRestartAll,
  setStackToDelete,
  onStart,
  onStop,
  onPause,
  onUnpause,
  onRestart,
  onDelete,
}) => {
  const isCompose = groupName !== "__standalone__";
  const runningInGroup = groupList.filter((c) => c.state === "running").length;
  const isCollapsed = isCompose && collapsedStacks.has(groupName);

  return (
    <div key={groupName} className="space-y-1">
      {isCompose ? (
        <div className="rounded-xl border border-border/80 bg-surface/50 overflow-hidden shadow-xs transition-colors">
          <div
            onClick={() => toggleStackCollapse(groupName)}
            className={`flex items-center justify-between px-3 py-2 bg-surface-secondary/70 hover:bg-surface-secondary text-xs text-foreground cursor-pointer transition-colors select-none ${
              !isCollapsed && groupList.length > 0 ? "border-b border-border/60" : ""
            }`}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStackCollapse(groupName);
                }}
                className="p-1 -ml-1 rounded hover:bg-surface/80 text-muted-foreground hover:text-foreground transition-colors"
                title={isCollapsed ? "Expand stack" : "Collapse stack"}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              <div onClick={(e) => e.stopPropagation()}>
                <IndeterminateCheckbox
                  checked={
                    groupList.length > 0 &&
                    groupList.every((c) => selectedIds.has(c.id))
                  }
                  indeterminate={
                    groupList.some((c) => selectedIds.has(c.id)) &&
                    !groupList.every((c) => selectedIds.has(c.id))
                  }
                  onChange={() => toggleGroupSelect(groupList)}
                  title="Seleccionar todo el stack"
                />
              </div>
              <FolderGit2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="font-semibold text-xs tracking-tight truncate text-foreground">
                {groupName}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground bg-surface border border-border/60 px-1.5 py-0.2 rounded-md">
                {runningInGroup}/{groupList.length}
              </span>
            </div>

            <div
              className="flex items-center space-x-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (groupList.length > 0) {
                    openRealNativeWindow({
                      id: `stack-logs-${groupName}-${Date.now()}`,
                      title: `${groupName} — Unified Logs`,
                      type: "logs",
                      composeProject: groupName,
                    });
                  }
                }}
                disabled={groupList.length === 0}
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-surface/80 transition-colors text-2xs font-mono disabled:opacity-40 disabled:pointer-events-none"
                title="Open unified live logs in native window"
              >
                <FileText className="w-3 h-3" />
                <span>Logs</span>
              </button>
              <button
                onClick={(e) => handleStartAll(groupName, groupList, e)}
                className="p-1 rounded text-muted-foreground hover:text-emerald-500 hover:bg-surface/80 transition-colors"
                title={t.containers.startAll}
              >
                <Play className="w-3 h-3 fill-current" />
              </button>
              <button
                onClick={(e) => handleStopAll(groupList, e)}
                disabled={runningInGroup === 0}
                className="p-1 rounded text-muted-foreground hover:text-amber-500 hover:bg-surface/80 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                title={t.containers.stopAll}
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
              <button
                onClick={(e) => handleRestartAll(groupName, groupList, e)}
                className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-surface/80 transition-colors"
                title={t.containers.restartAll}
              >
                <RotateCw className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setStackToDelete({ name: groupName, containers: groupList });
                }}
                className="p-1 rounded text-muted-foreground/60 hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                title={t.containers.remove}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {!isCollapsed && groupList.length > 0 && (
            <div className="divide-y divide-border/40 bg-surface/30">
              {groupList.map((container) => (
                <ContainerRowItem
                  key={container.id}
                  container={container}
                  isSelected={activeContainer?.id === container.id}
                  isActionInProgress={isActionInProgress}
                  selectedIds={selectedIds}
                  t={t}
                  getStatusDot={getStatusDot}
                  onSelectContainer={onSelectContainer}
                  onToggleSelect={toggleContainerSelect}
                  onStart={onStart}
                  onStop={onStop}
                  onPause={onPause}
                  onUnpause={onUnpause}
                  onRestart={onRestart}
                  onDelete={onDelete}
                  isNested={true}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            <div className="flex items-center space-x-2">
              <IndeterminateCheckbox
                checked={
                  groupList.length > 0 &&
                  groupList.every((c) => selectedIds.has(c.id))
                }
                indeterminate={
                  groupList.some((c) => selectedIds.has(c.id)) &&
                  !groupList.every((c) => selectedIds.has(c.id))
                }
                onChange={() => toggleGroupSelect(groupList)}
                title="Seleccionar todos los standalone"
              />
              <span>{t.containers.standalone}</span>
            </div>
            <span className="text-2xs font-mono lowercase">
              {groupList.filter((c) => c.state === "running").length}/
              {groupList.length}
            </span>
          </div>

          <div className="rounded-xl border border-border/80 bg-surface/30 divide-y divide-border/40 overflow-hidden shadow-xs">
            {groupList.map((container) => (
              <ContainerRowItem
                key={container.id}
                container={container}
                isSelected={activeContainer?.id === container.id}
                isActionInProgress={isActionInProgress}
                selectedIds={selectedIds}
                t={t}
                getStatusDot={getStatusDot}
                onSelectContainer={onSelectContainer}
                onToggleSelect={toggleContainerSelect}
                onStart={onStart}
                onStop={onStop}
                onPause={onPause}
                onUnpause={onUnpause}
                onRestart={onRestart}
                onDelete={onDelete}
                isNested={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
