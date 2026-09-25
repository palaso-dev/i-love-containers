import React, { useEffect } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { OverviewView } from "@/features/overview/OverviewView";
import { ContainersSplitView } from "@/features/containers/ContainersSplitView";
import { ImagesView } from "@/features/images/ImagesView";
import { VolumesView } from "@/features/volumes/VolumesView";
import { NetworksView } from "@/features/networks/NetworksView";
import { ComposeView } from "@/features/compose/ComposeView";
import { SettingsView } from "@/features/settings/SettingsView";
import { FleetView } from "@/features/fleet/FleetView";
import { useAppStore } from "@/stores/useAppStore";

export const App: React.FC = () => {
  const {
    viewMode,
    activeTab,
    setActiveTab,
    selectedContainerId,
    containerDetailTab,
    setContainerDetailTab,
    refreshData,
    isInitialLoading,
    toggleViewMode,
    isSidebarOpen,
    toggleSidebar,
    goBack,
    goForward,
    zoomInUi,
    zoomOutUi,
    resetZoomUi,
  } = useAppStore();

  useEffect(() => {
    const handleGlobalShortcuts = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        if (!event.shiftKey) {
          if (event.key === "=" || event.key === "+") {
            event.preventDefault();
            zoomInUi();
            return;
          } else if (event.key === "-" || event.key === "_") {
            event.preventDefault();
            zoomOutUi();
            return;
          } else if (event.key === "0") {
            event.preventDefault();
            resetZoomUi();
            return;
          }
        }
      }

      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (
        (event.key === "[" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "ArrowLeft" && event.altKey)
      ) {
        event.preventDefault();
        goBack();
      } else if (
        (event.key === "]" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "ArrowRight" && event.altKey)
      ) {
        event.preventDefault();
        goForward();
      } else if (
        event.key.toLowerCase() === "b" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      } else if (
        event.key.toLowerCase() === "r" &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        refreshData();
      } else if (
        event.key.toLowerCase() === "m" &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        toggleViewMode();
      } else if (
        event.key.toLowerCase() === "l" &&
        !event.metaKey &&
        !event.ctrlKey &&
        selectedContainerId
      ) {
        event.preventDefault();
        setContainerDetailTab("logs");
      } else if (
        event.key.toLowerCase() === "t" &&
        !event.metaKey &&
        !event.ctrlKey &&
        selectedContainerId
      ) {
        event.preventDefault();
        setContainerDetailTab("terminal");
      } else if (
        event.key.toLowerCase() === "s" &&
        !event.metaKey &&
        !event.ctrlKey &&
        selectedContainerId
      ) {
        event.preventDefault();
        setContainerDetailTab("stats");
      } else if (
        event.key.toLowerCase() === "f" &&
        !event.metaKey &&
        !event.ctrlKey &&
        selectedContainerId
      ) {
        event.preventDefault();
        setActiveTab("containers");
        setContainerDetailTab("files");
      } else if (
        event.key.toLowerCase() === "o" &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        if (
          selectedContainerId &&
          activeTab === "containers" &&
          containerDetailTab !== "overview"
        ) {
          setContainerDetailTab("overview");
        } else {
          setActiveTab("overview");
        }
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [
    selectedContainerId,
    containerDetailTab,
    activeTab,
    setActiveTab,
    setContainerDetailTab,
    refreshData,
    toggleViewMode,
    toggleSidebar,
    goBack,
    goForward,
    zoomInUi,
    zoomOutUi,
    resetZoomUi,
  ]);

  if (isInitialLoading) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center font-sans">
        <div className="flex items-center space-x-2 text-primary animate-pulse mb-2">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            I <span className="text-primary">♥</span> Containers
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Checking local container engine...
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden font-sans  antialiased">
      {isSidebarOpen && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          {activeTab === "overview" &&
            (viewMode === "minimal" ? <FleetView /> : <OverviewView />)}
          <div
            className={
              activeTab === "containers"
                ? "flex-1 flex flex-col min-w-0 h-full overflow-hidden"
                : "hidden"
            }
          >
            <ContainersSplitView />
          </div>
          {activeTab === "images" && <ImagesView />}
          {activeTab === "volumes" && <VolumesView />}
          {activeTab === "networks" && <NetworksView />}
          {activeTab === "compose" && <ComposeView />}
          {activeTab === "settings" && <SettingsView />}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
};
