import React, { createContext, useContext, useState, useCallback } from "react";

export type WindowType = "terminal" | "logs";

export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  color: string;
  message: string;
}

export interface FloatingWindow {
  id: string;
  type: WindowType;
  title: string;
  containerId?: string;
  containerName?: string;
  composeProject?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  prevBounds?: { x: number; y: number; width: number; height: number };
  createdAt: number;
  logs?: LogEntry[];
  activeServiceFilters?: string[];
  isPaused?: boolean;
  autoScroll?: boolean;
  showTimestamps?: boolean;
}

interface WindowManagerContextValue {
  windows: FloatingWindow[];
  highestZIndex: number;
  openTerminalWindow: (containerId: string, containerName: string) => string;
  openLogsWindow: (containerId: string, containerName: string) => string;
  openStackLogsWindow: (
    composeProject: string,
    serviceContainers: Array<{ id: string; name: string }>,
  ) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  updateWindowBounds: (
    id: string,
    bounds: { x?: number; y?: number; width?: number; height?: number },
  ) => void;
  tileWindows: () => void;
  minimizeAllWindows: () => void;
  closeAllWindows: () => void;
  appendWindowLog: (windowId: string, entry: LogEntry) => void;
  clearWindowLogs: (windowId: string) => void;
  toggleWindowLogPause: (windowId: string) => void;
  toggleWindowLogAutoScroll: (windowId: string) => void;
  toggleWindowLogTimestamps: (windowId: string) => void;
  toggleWindowServiceFilter: (
    windowId: string,
    serviceName: string,
    solo?: boolean,
    allAvailable?: string[],
  ) => void;
  setWindowServiceFilters: (windowId: string, filters: string[] | null) => void;
  setWindowLogs: (windowId: string, logs: LogEntry[]) => void;
}

const WindowManagerContext = createContext<
  WindowManagerContextValue | undefined
>(undefined);

const SERVICE_COLORS = [
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#fb923c",
  "#4ade80",
  "#e879f9",
];

const getSourceColor = (index: number) =>
  SERVICE_COLORS[index % SERVICE_COLORS.length];

export const WindowManagerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [windows, setWindows] = useState<FloatingWindow[]>([]);
  const [highestZIndex, setHighestZIndex] = useState(100);
  const [terminalCounters, setTerminalCounters] = useState<
    Record<string, number>
  >({});

  const openTerminalWindow = useCallback(
    (containerId: string, containerName: string) => {
      const count = (terminalCounters[containerId] || 0) + 1;
      setTerminalCounters((prev) => ({ ...prev, [containerId]: count }));
      const windowId = `win-term-${containerId}-${Date.now()}`;
      const nextZ = highestZIndex + 1;
      setHighestZIndex(nextZ);

      const offsetStep = (windows.length % 6) * 32;
      const initialX = Math.max(
        20,
        Math.min(window.innerWidth - 680, 70 + offsetStep),
      );
      const initialY = Math.max(
        20,
        Math.min(window.innerHeight - 500, 60 + offsetStep),
      );

      const newWindow: FloatingWindow = {
        id: windowId,
        type: "terminal",
        title: `${containerName} — Shell #${count}`,
        containerId,
        containerName,
        x: initialX,
        y: initialY,
        width: 680,
        height: 440,
        zIndex: nextZ,
        isMinimized: false,
        isMaximized: false,
        createdAt: Date.now(),
      };

      setWindows((prev) => [...prev, newWindow]);
      return windowId;
    },
    [highestZIndex, terminalCounters, windows.length],
  );

  const openLogsWindow = useCallback(
    (containerId: string, containerName: string) => {
      const windowId = `win-logs-${containerId}-${Date.now()}`;
      const nextZ = highestZIndex + 1;
      setHighestZIndex(nextZ);

      const offsetStep = (windows.length % 6) * 32;
      const initialX = Math.max(
        20,
        Math.min(window.innerWidth - 680, 100 + offsetStep),
      );
      const initialY = Math.max(
        20,
        Math.min(window.innerHeight - 500, 80 + offsetStep),
      );

      const initialTimestamp = new Date()
        .toISOString()
        .replace("T", " ")
        .substring(0, 19);
      const initialLogs: LogEntry[] = [
        {
          id: "l-1",
          timestamp: initialTimestamp,
          source: containerName,
          color: "#38bdf8",
          message: `Connected to live log stream for ${containerName} (${containerId.substring(0, 12)})`,
        },
        {
          id: "l-2",
          timestamp: initialTimestamp,
          source: containerName,
          color: "#38bdf8",
          message: `HTTP Service listening and accepting socket traffic`,
        },
      ];

      const newWindow: FloatingWindow = {
        id: windowId,
        type: "logs",
        title: `${containerName} — Live Logs`,
        containerId,
        containerName,
        x: initialX,
        y: initialY,
        width: 680,
        height: 440,
        zIndex: nextZ,
        isMinimized: false,
        isMaximized: false,
        createdAt: Date.now(),
        logs: initialLogs,
        activeServiceFilters: [containerName],
        isPaused: false,
        autoScroll: true,
        showTimestamps: true,
      };

      setWindows((prev) => [...prev, newWindow]);
      return windowId;
    },
    [highestZIndex, windows.length],
  );

  const openStackLogsWindow = useCallback(
    (
      composeProject: string,
      serviceContainers: Array<{ id: string; name: string }>,
    ) => {
      const windowId = `win-stack-logs-${composeProject}-${Date.now()}`;
      const nextZ = highestZIndex + 1;
      setHighestZIndex(nextZ);

      const offsetStep = (windows.length % 6) * 32;
      const initialX = Math.max(
        20,
        Math.min(window.innerWidth - 740, 80 + offsetStep),
      );
      const initialY = Math.max(
        20,
        Math.min(window.innerHeight - 500, 70 + offsetStep),
      );

      const initialTimestamp = new Date()
        .toISOString()
        .replace("T", " ")
        .substring(0, 19);
      const initialLogs: LogEntry[] = serviceContainers.map((s, index) => ({
        id: `init-${s.id}`,
        timestamp: initialTimestamp,
        source: s.name,
        color: getSourceColor(index),
        message: `Attached to unified live stream for ${s.name}`,
      }));

      const newWindow: FloatingWindow = {
        id: windowId,
        type: "logs",
        title: `${composeProject} — Stack Logs (${serviceContainers.length} services)`,
        composeProject,
        x: initialX,
        y: initialY,
        width: 740,
        height: 460,
        zIndex: nextZ,
        isMinimized: false,
        isMaximized: false,
        createdAt: Date.now(),
        logs: initialLogs,
        activeServiceFilters: undefined,
        isPaused: false,
        autoScroll: true,
        showTimestamps: true,
      };

      setWindows((prev) => [...prev, newWindow]);
      return windowId;
    },
    [highestZIndex, windows.length],
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setHighestZIndex((prevZ) => {
      const nextZ = prevZ + 1;
      setWindows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, zIndex: nextZ } : w)),
      );
      return nextZ;
    });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)),
    );
  }, []);

  const restoreWindow = useCallback((id: string) => {
    setHighestZIndex((prevZ) => {
      const nextZ = prevZ + 1;
      setWindows((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, isMinimized: false, zIndex: nextZ } : w,
        ),
      );
      return nextZ;
    });
  }, []);

  const toggleMaximizeWindow = useCallback((id: string) => {
    setHighestZIndex((prevZ) => {
      const nextZ = prevZ + 1;
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          if (w.isMaximized) {
            const pb = w.prevBounds || {
              x: 70,
              y: 70,
              width: 680,
              height: 440,
            };
            return {
              ...w,
              isMaximized: false,
              x: pb.x,
              y: pb.y,
              width: pb.width,
              height: pb.height,
              zIndex: nextZ,
            };
          } else {
            return {
              ...w,
              prevBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
              isMaximized: true,
              x: 0,
              y: 0,
              width: window.innerWidth,
              height: window.innerHeight - 48,
              zIndex: nextZ,
            };
          }
        }),
      );
      return nextZ;
    });
  }, []);

  const updateWindowBounds = useCallback(
    (
      id: string,
      bounds: { x?: number; y?: number; width?: number; height?: number },
    ) => {
      setWindows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...bounds } : w)),
      );
    },
    [],
  );

  const tileWindows = useCallback(() => {
    setWindows((prev) => {
      const openWindows = prev.filter((w) => !w.isMinimized);
      if (openWindows.length === 0) return prev;

      const availableWidth = window.innerWidth;
      const availableHeight = window.innerHeight - 48;

      let cols = 1;
      let rows = 1;

      if (openWindows.length === 2) {
        cols = 2;
        rows = 1;
      } else if (openWindows.length >= 3 && openWindows.length <= 4) {
        cols = 2;
        rows = 2;
      } else if (openWindows.length > 4) {
        cols = 3;
        rows = 2;
      }

      const cellWidth = Math.floor(availableWidth / cols);
      const cellHeight = Math.floor(availableHeight / rows);

      return prev.map((w) => {
        const index = openWindows.findIndex((ow) => ow.id === w.id);
        if (index === -1) return w;
        const col = index % cols;
        const row = Math.floor(index / cols);
        return {
          ...w,
          isMaximized: false,
          x: col * cellWidth,
          y: row * cellHeight,
          width: cellWidth,
          height: cellHeight,
        };
      });
    });
  }, []);

  const minimizeAllWindows = useCallback(() => {
    setWindows((prev) => prev.map((w) => ({ ...w, isMinimized: true })));
  }, []);

  const closeAllWindows = useCallback(() => {
    setWindows([]);
  }, []);

  const appendWindowLog = useCallback((windowId: string, entry: LogEntry) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId || !w.logs) return w;
        if (w.isPaused) return w;
        return {
          ...w,
          logs: w.logs.length >= 10000 ? [...w.logs.slice(-9999), entry] : [...w.logs, entry],
        };
      }),
    );
  }, []);

  const setWindowLogs = useCallback((windowId: string, newLogs: LogEntry[]) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w;
        if (w.isPaused) return w;
        return {
          ...w,
          logs: newLogs.length > 10000 ? newLogs.slice(-10000) : newLogs,
        };
      }),
    );
  }, []);

  const clearWindowLogs = useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w;
        return {
          ...w,
          logs: [],
        };
      }),
    );
  }, []);

  const toggleWindowLogPause = useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w;
        return {
          ...w,
          isPaused: !w.isPaused,
        };
      }),
    );
  }, []);

  const toggleWindowLogAutoScroll = useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w;
        return {
          ...w,
          autoScroll: !w.autoScroll,
        };
      }),
    );
  }, []);

  const toggleWindowLogTimestamps = useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w;
        return {
          ...w,
          showTimestamps: !w.showTimestamps,
        };
      }),
    );
  }, []);

  const toggleWindowServiceFilter = useCallback(
    (
      windowId: string,
      serviceName: string,
      solo?: boolean,
      allAvailable?: string[],
    ) => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== windowId) return w;
          if (solo) {
            return {
              ...w,
              activeServiceFilters: [serviceName],
            };
          }
          const filters = w.activeServiceFilters;
          const effectiveFilters =
            filters === undefined ? (allAvailable || []) : filters;
          const exists = effectiveFilters.includes(serviceName);
          const updated = exists
            ? effectiveFilters.filter((name) => name !== serviceName)
            : [...effectiveFilters, serviceName];
          return {
            ...w,
            activeServiceFilters: updated,
          };
        }),
      );
    },
    [],
  );

  const setWindowServiceFilters = useCallback(
    (windowId: string, filters: string[] | null) => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== windowId) return w;
          return {
            ...w,
            activeServiceFilters: filters === null ? undefined : filters,
          };
        }),
      );
    },
    [],
  );

  const value: WindowManagerContextValue = {
    windows,
    highestZIndex,
    openTerminalWindow,
    openLogsWindow,
    openStackLogsWindow,
    closeWindow,
    focusWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    restoreWindow,
    updateWindowBounds,
    tileWindows,
    minimizeAllWindows,
    closeAllWindows,
    appendWindowLog,
    clearWindowLogs,
    toggleWindowLogPause,
    toggleWindowLogAutoScroll,
    toggleWindowLogTimestamps,
    toggleWindowServiceFilter,
    setWindowServiceFilters,
    setWindowLogs,
  };

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
};

export const useWindowManagerStore = (): WindowManagerContextValue => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error(
      "useWindowManagerStore must be used within WindowManagerProvider",
    );
  }
  return context;
};
