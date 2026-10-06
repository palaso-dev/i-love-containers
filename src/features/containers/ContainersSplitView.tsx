import React from "react";
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Search,
  Box,
  FileText,
  Terminal,
  Activity,
  Folder,
  X,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { ActiveTab, ContainerState } from "@/types";
import { OverviewTab } from "./tabs/OverviewTab";
import { LogsTab } from "./tabs/LogsTab";
import { TerminalTab } from "./tabs/TerminalTab";
import { StatsTab } from "./tabs/StatsTab";
import { FileManagerTab } from "./tabs/FileManagerTab";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DockerDisconnected } from "@/components/DockerDisconnected";
import {
  ComposeGroupSection,
  ContainerDetailHeader,
  ContainerDeleteModals,
  PortConflictModal,
  useContainersSplitState,
} from "./split-view";


const getStatusDot = (state: ContainerState, size: "sm" | "md" = "sm") => {
  const sizeClass = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";
  switch (state) {
    case "running":
      return `${sizeClass} rounded-full shrink-0 bg-status-running`;
    case "paused":
      return `${sizeClass} rounded-full shrink-0 bg-amber-400`;
    case "restarting":
      return `${sizeClass} rounded-full shrink-0 bg-sky-400`;
    default:
      return `${sizeClass} rounded-full shrink-0 bg-status-stopped`;
  }
};

export const ContainersSplitView: React.FC = () => {
  const {
    t,
    containers,
    systemOverview,
    selectedContainerId,
    setSelectedContainerId,
    containerDetailTab,
    setContainerDetailTab,
    startContainer,
    stopContainer,
    pauseContainer,
    unpauseContainer,
    restartContainer,
    removeContainer,
    removeComposeProject,
    upComposeProject,
    composeProjects,
    refreshData,
    isActionInProgress,
    setActiveTab,
    setSelectedImageId,
  } = useAppStore();

  const {
    searchQuery,
    setSearchQuery,
    stateFilter,
    setStateFilter,
    containerToDelete,
    setContainerToDelete,
    stackToDelete,
    setStackToDelete,
    selectedIds,
    setSelectedIds,
    bulkToDelete,
    setBulkToDelete,
    isBulkOperating,
    setHiddenStacks,
    collapsedStacks,
    toggleStackCollapse,
    splitViewRef,
    leftWidth,
    handleMouseDown,
    detailPaneRef,
    isCompactDetail,
    filteredContainers,
    activeContainer,
    composeGroups,
    toggleContainerSelect,
    toggleGroupSelect,
    handleStartAll,
    handleStopAll,
    handleRestartAll,
    handleBulkStart,
    handleBulkStop,
    handleBulkRestart,
    portConflict,
    setPortConflict,
    safeStartContainer,
    confirmPortConflictStart,
  } = useContainersSplitState(

    containers,
    composeProjects,
    selectedContainerId,
    setSelectedContainerId,
    startContainer,
    stopContainer,
    unpauseContainer,
    restartContainer,
    upComposeProject,
    refreshData,
  );


  const tabs: {
    id: "overview" | "stats" | "logs" | "terminal" | "files";
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "overview", label: t.containers.tabs.overview, icon: Box },
    { id: "stats", label: t.containers.tabs.stats, icon: Activity },
    { id: "logs", label: t.containers.tabs.logs, icon: FileText },
    { id: "terminal", label: t.containers.tabs.terminal, icon: Terminal },
    { id: "files", label: t.containers.tabs.files, icon: Folder },
  ];

  const isConnected = systemOverview?.dockerConnected ?? false;

  if (!isConnected) {
    return <DockerDisconnected icon={Box} />;
  }

  return (
    <div
      ref={splitViewRef}
      className="flex-1 flex h-full overflow-hidden bg-background min-w-0"
    >
      <div
        style={{ width: `${leftWidth}px` }}
        className="border-r border-border/80 flex flex-col h-full bg-surface/30 shrink-0 min-w-0 overflow-hidden"
      >
        <div className="p-3 border-b border-border/70 space-y-2 bg-surface/50 backdrop-blur-sm">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.containers.searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all shadow-xs"
            />
          </div>

          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center bg-surface-secondary/80 border border-border/60 rounded-md p-0.5 text-2xs shrink-0">
              {(["all", "running", "paused", "stopped"] as const).map(
                (filter) => (
                  <button
                    key={filter}
                    onClick={() => setStateFilter(filter)}
                    className={`px-2 py-0.5 rounded capitalize transition-all ${
                      stateFilter === filter
                        ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.containers[filter]}
                  </button>
                ),
              )}
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap shrink-0">
                {filteredContainers.filter((c) => c.state === "running").length}
                /{filteredContainers.length} {t.containers.active}
              </span>
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="px-3 py-1.5 bg-primary-muted/70 border-b border-primary/25 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150 shrink-0">
            <div className="flex items-center space-x-2 text-xs min-w-0">
              <span className="font-semibold text-primary font-mono text-[11px] truncate">
                {selectedIds.size} seleccionados
              </span>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              <button
                disabled={isBulkOperating}
                onClick={handleBulkStart}
                className="p-1 rounded text-muted-foreground hover:text-status-running hover:bg-surface/80 transition-colors disabled:opacity-50"
                title="Iniciar seleccionados"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
              <button
                disabled={isBulkOperating}
                onClick={handleBulkStop}
                className="p-1 rounded text-muted-foreground hover:text-status-restarting hover:bg-surface/80 transition-colors disabled:opacity-50"
                title="Detener seleccionados"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
              <button
                disabled={isBulkOperating}
                onClick={handleBulkRestart}
                className="p-1 rounded text-muted-foreground hover:text-sky-400 hover:bg-surface/80 transition-colors disabled:opacity-50"
                title="Reiniciar seleccionados"
              >
                <RotateCw
                  className={`w-3.5 h-3.5 ${isBulkOperating ? "animate-spin" : ""}`}
                />
              </button>
              <button
                disabled={isBulkOperating}
                onClick={() => setBulkToDelete(Array.from(selectedIds))}
                className="p-1 rounded text-status-danger/80 hover:text-status-danger hover:bg-status-danger/15 transition-colors disabled:opacity-50"
                title="Eliminar seleccionados"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface/80 transition-colors ml-1"
                title="Deseleccionar todos"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {Object.entries(composeGroups).map(([groupName, groupList]) => (
            <ComposeGroupSection
              key={groupName}
              groupName={groupName}
              groupList={groupList}
              activeContainer={activeContainer}
              selectedIds={selectedIds}
              collapsedStacks={collapsedStacks}
              isActionInProgress={isActionInProgress}
              t={t}
              getStatusDot={getStatusDot}
              toggleStackCollapse={toggleStackCollapse}
              toggleGroupSelect={toggleGroupSelect}
              toggleContainerSelect={toggleContainerSelect}
              onSelectContainer={(id) => setSelectedContainerId(id)}
              handleStartAll={handleStartAll}
              handleStopAll={handleStopAll}
              handleRestartAll={handleRestartAll}
              setStackToDelete={setStackToDelete}
              onStart={async (id, e) => {
                e.stopPropagation();
                await safeStartContainer(id);
              }}
              onStop={async (id, e) => {

                e.stopPropagation();
                await stopContainer(id);
              }}
              onPause={async (id, e) => {
                e.stopPropagation();
                await pauseContainer(id);
              }}
              onUnpause={async (id, e) => {
                e.stopPropagation();
                await unpauseContainer(id);
              }}
              onRestart={async (id, e) => {
                e.stopPropagation();
                await restartContainer(id);
              }}
              onDelete={(c, e) => {
                e.stopPropagation();
                setContainerToDelete(c);
              }}
            />
          ))}

          {filteredContainers.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-xs">
              {t.containers.noContainers}
            </div>
          )}
        </div>
      </div>

      <div
        onMouseDown={handleMouseDown}
        className="w-[5px] hover:w-[6px] active:w-[6px] h-full cursor-col-resize hover:bg-primary/50 active:bg-primary transition-all duration-150 z-20 shrink-0 relative select-none"
        title="Arrastra para cambiar ancho del panel"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      <div
        ref={detailPaneRef}
        className="flex-1 flex flex-col h-full overflow-hidden bg-background min-w-0"
      >
        {activeContainer ? (
          <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
            <ContainerDetailHeader
              t={t}
              activeContainer={activeContainer}
              isCompactDetail={isCompactDetail}
              containerDetailTab={containerDetailTab}
              tabs={tabs}
              getStatusDot={getStatusDot}
              startContainer={safeStartContainer}
              stopContainer={stopContainer}

              pauseContainer={pauseContainer}
              unpauseContainer={unpauseContainer}
              restartContainer={restartContainer}
              setContainerToDelete={setContainerToDelete}
              setActiveTab={(tab) => setActiveTab(tab as ActiveTab)}
              setSelectedImageId={setSelectedImageId}
            />

            <div className="px-2.5 sm:px-4 py-1.5 sm:py-2 border-b border-border/70 flex items-center justify-between gap-1.5 bg-surface/20 shrink-0 overflow-x-auto">
              <div className="inline-flex items-center bg-surface-secondary/80 border border-border/60 p-0.5 rounded-lg shadow-xs shrink-0">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = containerDetailTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setContainerDetailTab(tab.id)}
                      className={`flex items-center space-x-1 sm:space-x-1.5 ${
                        isCompactDetail ? "px-2 py-1" : "px-3 py-1"
                      } rounded-md text-xs font-medium transition-all shrink-0 ${
                        isActive
                          ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                      }`}
                      title={tab.label}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                      />
                      {!isCompactDetail && <span>{tab.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className={`flex-1 ${
                containerDetailTab === "logs" ||
                containerDetailTab === "terminal" ||
                containerDetailTab === "files"
                  ? "overflow-hidden flex flex-col min-h-0"
                  : "overflow-y-auto"
              } p-4 bg-background min-h-0`}
            >
              <ErrorBoundary fallbackTitle="Error loading container tab">
                <div
                  className={
                    containerDetailTab === "overview" ||
                    containerDetailTab === "inspect"
                      ? "h-full w-full"
                      : "hidden"
                  }
                >
                  <OverviewTab container={activeContainer} />
                </div>
                <div
                  className={
                    containerDetailTab === "stats" ? "h-full w-full" : "hidden"
                  }
                >
                  <StatsTab
                    containerId={activeContainer.id}
                    containerState={activeContainer.state}
                  />
                </div>
                <div
                  className={
                    containerDetailTab === "logs"
                      ? "h-full w-full flex flex-col min-h-0"
                      : "hidden"
                  }
                >
                  <LogsTab containerId={activeContainer.id} />
                </div>
                <div
                  className={
                    containerDetailTab === "terminal"
                      ? "h-full w-full flex flex-col min-h-0"
                      : "hidden"
                  }
                >
                  <TerminalTab
                    key={activeContainer.id}
                    containerId={activeContainer.id}
                    containerName={activeContainer.name}
                    containerState={activeContainer.state}
                    isActive={containerDetailTab === "terminal"}
                  />
                </div>
                <div
                  className={
                    containerDetailTab === "files"
                      ? "h-full w-full flex flex-col min-h-0"
                      : "hidden"
                  }
                >
                  <FileManagerTab
                    containerId={activeContainer.id}
                    containerName={activeContainer.name}
                    containerState={activeContainer.state}
                  />
                </div>
              </ErrorBoundary>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground text-center">
            <Box className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-xs font-medium">
              {t.containers.selectToInspect}
            </p>
          </div>
        )}
      </div>

      <ContainerDeleteModals
        t={t}
        containerToDelete={containerToDelete}
        stackToDelete={stackToDelete}
        bulkToDelete={bulkToDelete}
        isActionInProgress={isActionInProgress}
        isBulkOperating={isBulkOperating}
        containers={containers}
        composeProjects={composeProjects}
        setContainerToDelete={setContainerToDelete}
        setStackToDelete={setStackToDelete}
        setBulkToDelete={setBulkToDelete}
        setSelectedIds={setSelectedIds}
        setHiddenStacks={setHiddenStacks}
        removeContainer={removeContainer}
        removeComposeProject={removeComposeProject}
        refreshData={refreshData}
      />

      <PortConflictModal
        t={t}
        isOpen={Boolean(portConflict)}
        targetContainer={portConflict ? portConflict.targetContainer : null}
        conflictDetails={
          portConflict
            ? {
                port: portConflict.port,
                conflictingContainer: portConflict.conflictingContainer,
              }
            : null
        }
        onClose={() => setPortConflict(null)}
        onConfirmStart={confirmPortConflictStart}
      />
    </div>
  );
};

