import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  ActiveTab,
  AppTheme,
  AccentColor,
  ColorMode,
  Language,
  ContainerDetail,
  ComposeProject,
  DockerImage,
  DockerNetwork,
  DockerVolume,
  SystemOverview,
  ContainerEngineInfo,
  NavigationEntry,
  ContainerDetailTab,
  CONTAINER_DETAIL_TABS,
} from "@/types";

function parseContainerDetailTab(value: string | null): ContainerDetailTab {
  if (value && (CONTAINER_DETAIL_TABS as string[]).includes(value)) {
    return value as ContainerDetailTab;
  }
  return "overview";
}

declare global {
  interface Window {
    __applyIlcSettings?: (data: {
      appTheme?: AppTheme;
      colorMode?: ColorMode;
      accentColor?: AccentColor;
      language?: Language;
    }) => void;
  }
}
import * as api from "@/lib/api";
import { translations } from "@/lib/i18n";

interface AppState {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => void;
  accentColor: AccentColor;
  setAccentColor: (accent: AccentColor) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  uiZoom: number;
  zoomInUi: () => void;
  zoomOutUi: () => void;
  resetZoomUi: () => void;
  setUiZoom: (zoom: number) => void;
  t: (typeof translations)["en"];
  viewMode: "minimal" | "detailed";
  toggleViewMode: () => void;
  setViewMode: (mode: "minimal" | "detailed") => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  activeTab: ActiveTab;
  selectedContainerId: string | null;
  containerDetailTab: ContainerDetailTab;
  selectedImageId: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  systemOverview: SystemOverview | null;
  detectedEngines: ContainerEngineInfo[];
  activeEngine: ContainerEngineInfo | null;
  switchEngine: (engineId: string) => Promise<void>;
  rescanEngines: () => Promise<void>;
  containers: ContainerDetail[];
  images: DockerImage[];
  volumes: DockerVolume[];
  networks: DockerNetwork[];
  composeProjects: ComposeProject[];
  isCommandPaletteOpen: boolean;
  searchFilter: string;
  isInitialLoading: boolean;
  isActionInProgress: boolean;
  statusMessage: string | null;
  selectedHost: string;
  setActiveTab: (tab: ActiveTab) => void;
  setSelectedContainerId: (id: string | null) => void;
  setContainerDetailTab: (
    tab: "overview" | "logs" | "terminal" | "stats" | "inspect" | "files",
  ) => void;
  setSelectedImageId: (id: string | null) => void;
  setIsCommandPaletteOpen: (open: boolean) => void;
  setSearchFilter: (query: string) => void;
  setSelectedHost: (host: string) => void;
  refreshData: () => Promise<void>;
  startContainer: (id: string) => Promise<void>;
  stopContainer: (id: string) => Promise<void>;
  pauseContainer: (id: string) => Promise<void>;
  unpauseContainer: (id: string) => Promise<void>;
  restartContainer: (id: string) => Promise<void>;
  removeContainer: (id: string) => Promise<void>;
  removeComposeProject: (
    projectName: string,
    workingDir?: string,
    configFile?: string,
  ) => Promise<void>;
  upComposeProject: (
    projectName: string,
    workingDir?: string,
    configFile?: string,
    customCommand?: string,
  ) => Promise<{ ok: boolean; stdout?: string; stderr?: string }>;
  forgetComposeProject: (projectName: string) => Promise<void>;
  removeImage: (id: string) => Promise<void>;
  removeVolume: (name: string) => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

const broadcastSettings = (settings: {
  appTheme?: AppTheme;
  colorMode?: ColorMode;
  accentColor?: AccentColor;
  language?: Language;
}) => {
  try {
    const bc = new BroadcastChannel("ilc-settings-sync");
    bc.postMessage(settings);
    bc.close();
  } catch {}

  try {
    if (
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    ) {
      import("@tauri-apps/api/core").then(({ invoke }) => {
        const payload = JSON.stringify(settings);
        const js = `window.__applyIlcSettings && window.__applyIlcSettings(${payload});`;
        invoke("broadcast_theme_settings", { jsCode: js }).catch(() => {});
      });
    }
  } catch {}
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [appTheme, setAppThemeState] = useState<AppTheme>(() => {
    const urlParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const urlTheme = urlParams?.get("theme") as AppTheme | null;
    const validThemes: AppTheme[] = [
      "liquid-glass",
      "retro-console",
      "neo-brutalist",
      "material-flow",
      "pixel-arcade",
    ];
    if (urlTheme && validThemes.includes(urlTheme)) {
      return urlTheme;
    }
    const saved = localStorage.getItem("ilc-app-theme") as AppTheme | null;
    if (saved && validThemes.includes(saved)) {
      return saved;
    }
    return "liquid-glass";
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    const urlParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const urlAccent = urlParams?.get("accent") as AccentColor | null;
    const validAccents: AccentColor[] = [
      "blue",
      "sky",
      "mint",
      "orange",
      "pink",
      "purple",
      "graphite",
    ];
    if (urlAccent && validAccents.includes(urlAccent)) {
      return urlAccent;
    }
    const saved = localStorage.getItem("ilc-app-accent") as AccentColor | null;
    return saved || "blue";
  });

  const [language, setLanguageState] = useState<Language>(() => {
    const urlParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const urlLang = urlParams?.get("lang") as Language | null;
    if (urlLang === "en" || urlLang === "es") return urlLang;
    const saved = localStorage.getItem("ilc-language") as Language | null;
    return saved || "en";
  });

  const [uiZoom, setUiZoomState] = useState<number>(() => {
    const urlParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const urlZoom = urlParams?.get("zoom");
    if (urlZoom) {
      const parsed = parseFloat(urlZoom);
      if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 1.8) return parsed;
    }
    const saved = localStorage.getItem("ilc-ui-zoom");
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 1.8) return parsed;
    }
    return 1;
  });

  const isStandaloneWindow =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("window");

  const applyZoomStyle = useCallback(
    (zoomVal: number) => {
      const clamped =
        Math.round(Math.max(0.7, Math.min(1.8, zoomVal)) * 100) / 100;
      document.documentElement.style.zoom = `${clamped}`;
      if (!isStandaloneWindow) {
        localStorage.setItem("ilc-ui-zoom", String(clamped));
      }
    },
    [isStandaloneWindow],
  );

  const setUiZoom = useCallback(
    (newZoom: number) => {
      const clamped =
        Math.round(Math.max(0.7, Math.min(1.8, newZoom)) * 100) / 100;
      setUiZoomState(clamped);
      applyZoomStyle(clamped);
    },
    [applyZoomStyle],
  );

  const zoomInUi = useCallback(() => {
    setUiZoomState((prev) => {
      const next = Math.round(Math.min(1.8, prev + 0.1) * 100) / 100;
      applyZoomStyle(next);
      return next;
    });
  }, [applyZoomStyle]);

  const zoomOutUi = useCallback(() => {
    setUiZoomState((prev) => {
      const next = Math.round(Math.max(0.7, prev - 0.1) * 100) / 100;
      applyZoomStyle(next);
      return next;
    });
  }, [applyZoomStyle]);

  const resetZoomUi = useCallback(() => {
    setUiZoomState(1);
    applyZoomStyle(1);
  }, [applyZoomStyle]);

  useEffect(() => {
    applyZoomStyle(uiZoom);
  }, [uiZoom, applyZoomStyle]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("ilc-language", lang);
    broadcastSettings({ language: lang });
  }, []);

  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    const urlParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const urlMode = urlParams?.get("mode") as ColorMode | null;
    if (urlMode === "light" || urlMode === "dark" || urlMode === "system") {
      return urlMode;
    }
    const saved = localStorage.getItem("ilc-color-mode") as ColorMode | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
    return "system";
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const theme: "dark" | "light" = useMemo(() => {
    if (colorMode === "dark") return "dark";
    if (colorMode === "light") return "light";
    return systemIsDark ? "dark" : "light";
  }, [colorMode, systemIsDark]);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    localStorage.setItem("ilc-color-mode", mode);
    broadcastSettings({ colorMode: mode });
  }, []);

  const toggleTheme = useCallback(() => {
    setColorModeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("ilc-color-mode", next);
      broadcastSettings({ colorMode: next });
      return next;
    });
  }, []);

  useEffect(() => {
    const applyIncoming = (data: {
      appTheme?: AppTheme;
      colorMode?: ColorMode;
      accentColor?: AccentColor;
      language?: Language;
    }) => {
      if (data.appTheme) {
        setAppThemeState(data.appTheme);
        localStorage.setItem("ilc-app-theme", data.appTheme);
      }
      if (data.colorMode) {
        setColorModeState(data.colorMode);
        localStorage.setItem("ilc-color-mode", data.colorMode);
      }
      if (data.accentColor) {
        setAccentColorState(data.accentColor);
        localStorage.setItem("ilc-app-accent", data.accentColor);
      }
      if (data.language) {
        setLanguageState(data.language);
        localStorage.setItem("ilc-language", data.language);
      }
    };

    window.__applyIlcSettings = applyIncoming;

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("ilc-settings-sync");
      bc.onmessage = (ev) => {
        if (ev.data) applyIncoming(ev.data);
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "ilc-app-theme" && e.newValue) {
        setAppThemeState(e.newValue as AppTheme);
      } else if (e.key === "ilc-color-mode" && e.newValue) {
        setColorModeState(e.newValue as ColorMode);
      } else if (e.key === "ilc-app-accent" && e.newValue) {
        setAccentColorState(e.newValue as AccentColor);
      } else if (e.key === "ilc-language" && e.newValue) {
        setLanguageState(e.newValue as Language);
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorage);
      delete window.__applyIlcSettings;
    };
  }, [applyZoomStyle]);

  useEffect(() => {
    const themes: string[] = [
      "liquid-glass",
      "retro-console",
      "neo-brutalist",
      "material-flow",
      "pixel-arcade",
      "cyberpunk-neon",
      "blueprint-cad",
      "synthwave-80s",
      "manga-ink",
      "desert-warmth",
      "space-charcoal",
      "studio-silver",
      "midnight-nebula",
      "transparent",
      "sonoma-dark",
      "cupertino-light",
      "midnight",
      "sunset",
      "navy",
      "purple",
      "graphite",
      "light",
    ];
    themes.forEach((t) =>
      document.documentElement.classList.remove(`theme-${t}`),
    );
    document.documentElement.classList.add(`theme-${appTheme}`);
    localStorage.setItem("ilc-app-theme", appTheme);

    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [appTheme, theme]);

  useEffect(() => {
    const accents: AccentColor[] = [
      "blue",
      "sky",
      "mint",
      "orange",
      "pink",
      "purple",
      "graphite",
    ];
    accents.forEach((a) =>
      document.documentElement.classList.remove(`accent-${a}`),
    );
    document.documentElement.classList.add(`accent-${accentColor}`);
    localStorage.setItem("ilc-app-accent", accentColor);
  }, [accentColor]);

  const setAppTheme = useCallback((newTheme: AppTheme) => {
    setAppThemeState(newTheme);
    localStorage.setItem("ilc-app-theme", newTheme);
    broadcastSettings({ appTheme: newTheme });
  }, []);

  const setAccentColor = useCallback((newAccent: AccentColor) => {
    setAccentColorState(newAccent);
    localStorage.setItem("ilc-app-accent", newAccent);
    broadcastSettings({ accentColor: newAccent });
  }, []);

  const [viewMode, setViewModeState] = useState<"minimal" | "detailed">(() => {
    const saved = localStorage.getItem("ilc-view-mode") as
      "minimal" | "detailed" | null;
    return saved || "detailed";
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem("ilc-sidebar-open");
    return saved !== null ? saved === "true" : true;
  });

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem("ilc-sidebar-open", String(next));
      return next;
    });
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>("containers");
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(
    () => {
      try {
        return localStorage.getItem("ilc-selected-container-id") || null;
      } catch {
        return null;
      }
    },
  );
  const [containerDetailTab, setContainerDetailTab] =
    useState<ContainerDetailTab>(() => {
      try {
        return parseContainerDetailTab(
          localStorage.getItem("ilc-container-detail-tab"),
        );
      } catch {
        return "overview";
      }
    });
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const [navigationHistory, setNavigationHistory] = useState<NavigationEntry[]>([
    {
      activeTab: "containers",
      selectedContainerId: (() => {
        try {
          return localStorage.getItem("ilc-selected-container-id") || null;
        } catch {
          return null;
        }
      })(),
      containerDetailTab: (() => {
        try {
          return parseContainerDetailTab(
            localStorage.getItem("ilc-container-detail-tab"),
          );
        } catch {
          return "overview";
        }
      })(),
      selectedImageId: null,
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const historyIndexRef = useRef(0);
  const navigationHistoryRef = useRef<NavigationEntry[]>([
    {
      activeTab: "containers",
      selectedContainerId: null,
      containerDetailTab: "overview",
      selectedImageId: null,
    },
  ]);
  const isNavigatingHistoryRef = useRef(false);

  const pushHistory = useCallback((newEntry: Partial<NavigationEntry>) => {
    if (isNavigatingHistoryRef.current) return;

    const currentHistory = navigationHistoryRef.current;
    const currentIndex = historyIndexRef.current;
    const current = currentHistory[currentIndex] || {
      activeTab: "containers",
      selectedContainerId: null,
      containerDetailTab: "overview",
      selectedImageId: null,
    };

    const nextEntry: NavigationEntry = {
      activeTab: newEntry.activeTab ?? current.activeTab,
      selectedContainerId:
        newEntry.selectedContainerId !== undefined
          ? newEntry.selectedContainerId
          : current.selectedContainerId,
      containerDetailTab:
        newEntry.containerDetailTab ?? current.containerDetailTab,
      selectedImageId:
        newEntry.selectedImageId !== undefined
          ? newEntry.selectedImageId
          : current.selectedImageId,
    };

    if (
      nextEntry.activeTab === current.activeTab &&
      nextEntry.selectedContainerId === current.selectedContainerId &&
      nextEntry.containerDetailTab === current.containerDetailTab &&
      nextEntry.selectedImageId === current.selectedImageId
    ) {
      return;
    }

    const sliced = currentHistory.slice(0, currentIndex + 1);
    sliced.push(nextEntry);
    const newIdx = sliced.length - 1;

    navigationHistoryRef.current = sliced;
    historyIndexRef.current = newIdx;

    setNavigationHistory(sliced);
    setHistoryIndex(newIdx);
  }, []);

  const handleSetActiveTab = useCallback(
    (tab: ActiveTab) => {
      setActiveTab(tab);
      pushHistory({ activeTab: tab });
    },
    [pushHistory],
  );

  const handleSetSelectedContainerId = useCallback(
    (id: string | null) => {
      setSelectedContainerId(id);
      try {
        if (id) {
          localStorage.setItem("ilc-selected-container-id", id);
        } else {
          localStorage.removeItem("ilc-selected-container-id");
        }
      } catch {}
      pushHistory({ selectedContainerId: id });
    },
    [pushHistory],
  );

  const handleSetContainerDetailTab = useCallback(
    (tab: "overview" | "logs" | "terminal" | "stats" | "inspect" | "files") => {
      setContainerDetailTab(tab);
      try {
        localStorage.setItem("ilc-container-detail-tab", tab);
      } catch {}
      pushHistory({ containerDetailTab: tab });
    },
    [pushHistory],
  );

  const handleSetSelectedImageId = useCallback(
    (id: string | null) => {
      setSelectedImageId(id);
      pushHistory({ selectedImageId: id });
    },
    [pushHistory],
  );

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < navigationHistory.length - 1;

  const goBack = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    if (currentIdx <= 0) return;
    const prevIdx = currentIdx - 1;
    const target = navigationHistoryRef.current[prevIdx];
    if (!target) return;

    isNavigatingHistoryRef.current = true;
    historyIndexRef.current = prevIdx;
    setHistoryIndex(prevIdx);

    setActiveTab(target.activeTab);
    setSelectedContainerId(target.selectedContainerId);
    setContainerDetailTab(target.containerDetailTab);
    setSelectedImageId(target.selectedImageId);

    setTimeout(() => {
      isNavigatingHistoryRef.current = false;
    }, 100);
  }, []);

  const goForward = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    if (currentIdx >= navigationHistoryRef.current.length - 1) return;
    const nextIdx = currentIdx + 1;
    const target = navigationHistoryRef.current[nextIdx];
    if (!target) return;

    isNavigatingHistoryRef.current = true;
    historyIndexRef.current = nextIdx;
    setHistoryIndex(nextIdx);

    setActiveTab(target.activeTab);
    setSelectedContainerId(target.selectedContainerId);
    setContainerDetailTab(target.containerDetailTab);
    setSelectedImageId(target.selectedImageId);

    setTimeout(() => {
      isNavigatingHistoryRef.current = false;
    }, 100);
  }, []);

  const [systemOverview, setSystemOverview] = useState<SystemOverview | null>(
    null,
  );
  const [detectedEngines, setDetectedEngines] = useState<ContainerEngineInfo[]>(
    [],
  );
  const [activeEngine, setActiveEngine] = useState<ContainerEngineInfo | null>(
    null,
  );
  const [containers, setContainers] = useState<ContainerDetail[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [composeProjects, setComposeProjects] = useState<ComposeProject[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedHost, setSelectedHost] = useState("localhost");

  const setViewMode = useCallback((mode: "minimal" | "detailed") => {
    setViewModeState(mode);
    localStorage.setItem("ilc-view-mode", mode);
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewModeState((prev) => {
      const next = prev === "minimal" ? "detailed" : "minimal";
      localStorage.setItem("ilc-view-mode", next);
      return next;
    });
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [
        overviewData,
        containersData,
        imagesData,
        volumesData,
        networksData,
        composeData,
        enginesData,
      ] = await Promise.all([
        api.fetchSystemOverview(),
        api.fetchContainers(),
        api.fetchImages(),
        api.fetchVolumes(),
        api.fetchNetworks(),
        api.fetchComposeProjects(),
        api.fetchDetectedEngines(),
      ]);

      setSystemOverview(overviewData);
      setDetectedEngines(
        enginesData.engines || overviewData.detectedEngines || [],
      );
      setActiveEngine(
        enginesData.activeEngine || overviewData.activeEngine || null,
      );
      setContainers(containersData);
      if (containersData.length > 0) {
        setSelectedContainerId((prev) =>
          containersData.some((c) => c.id === prev)
            ? prev
            : containersData[0].id,
        );
      } else {
        setSelectedContainerId(null);
      }
      setImages(
        [...imagesData].sort((a, b) =>
          (a.repository + a.tag).localeCompare(b.repository + b.tag),
        ),
      );
      setVolumes(
        [...volumesData].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        ),
      );
      setNetworks(
        [...networksData].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setComposeProjects(composeData);
    } catch {
      setStatusMessage("Failed to sync container data");
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  const switchEngine = useCallback(
    async (engineId: string) => {
      setIsActionInProgress(true);
      try {
        const result = await api.selectContainerEngine(engineId);
        setDetectedEngines(result.engines);
        setActiveEngine(result.activeEngine);
        await refreshData();
      } catch {
        setStatusMessage("Failed to switch container engine");
      } finally {
        setIsActionInProgress(false);
      }
    },
    [refreshData],
  );

  const rescanEngines = useCallback(async () => {
    setIsActionInProgress(true);
    try {
      const result = await api.rescanContainerEngines();
      setDetectedEngines(result.engines);
      setActiveEngine(result.activeEngine);
      await refreshData();
    } catch {
      setStatusMessage("Failed to rescan engines");
    } finally {
      setIsActionInProgress(false);
    }
  }, [refreshData]);

  useEffect(() => {
    refreshData();
    const timer = setInterval(() => {
      refreshData();
    }, 4000);
    return () => clearInterval(timer);
  }, [refreshData]);

  const handleStartContainer = async (id: string) => {
    setIsActionInProgress(true);
    await api.startContainer(id);
    await refreshData();
    setIsActionInProgress(false);
  };

  const handleStopContainer = async (id: string) => {
    setIsActionInProgress(true);
    await api.stopContainer(id);
    await refreshData();
    setIsActionInProgress(false);
  };

  const handlePauseContainer = async (id: string) => {
    setIsActionInProgress(true);
    await api.pauseContainer(id);
    await refreshData();
    setIsActionInProgress(false);
  };

  const handleUnpauseContainer = async (id: string) => {
    setIsActionInProgress(true);
    await api.unpauseContainer(id);
    await refreshData();
    setIsActionInProgress(false);
  };

  const handleRestartContainer = async (id: string) => {
    setIsActionInProgress(true);
    await api.restartContainer(id);
    await refreshData();
    setIsActionInProgress(false);
  };

  const handleRemoveContainer = async (id: string) => {
    setIsActionInProgress(true);
    try {
      await api.removeContainer(id);
      if (selectedContainerId === id) {
        setSelectedContainerId(null);
      }
      await refreshData();
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleRemoveComposeProject = async (
    projectName: string,
    workingDir?: string,
    configFile?: string,
  ) => {
    setIsActionInProgress(true);
    try {
      await api.removeComposeProject(projectName, workingDir, configFile);
      await refreshData();
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleUpComposeProject = async (
    projectName: string,
    workingDir?: string,
    configFile?: string,
    customCommand?: string,
  ) => {
    setIsActionInProgress(true);
    try {
      const res = await api.upComposeProject(
        projectName,
        workingDir,
        configFile,
        customCommand,
      );
      await refreshData();
      return res;
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleForgetComposeProject = async (projectName: string) => {
    setIsActionInProgress(true);
    try {
      await api.forgetComposeProject(projectName);
      setComposeProjects((prev) =>
        prev.filter((p) => p.name.toLowerCase() !== projectName.toLowerCase()),
      );
      await refreshData();
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleRemoveImage = async (id: string) => {
    setIsActionInProgress(true);
    try {
      await api.removeImage(id);
      await refreshData();
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleRemoveVolume = async (name: string) => {
    setIsActionInProgress(true);
    try {
      await api.removeVolume(name);
      await refreshData();
    } finally {
      setIsActionInProgress(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        colorMode,
        setColorMode,
        theme,
        toggleTheme,
        appTheme,
        setAppTheme,
        accentColor,
        setAccentColor,
        language,
        setLanguage,
        uiZoom,
        zoomInUi,
        zoomOutUi,
        resetZoomUi,
        setUiZoom,
        t: translations[language],
        viewMode,
        toggleViewMode,
        setViewMode,
        isSidebarOpen,
        toggleSidebar,
        activeTab,
        selectedContainerId,
        containerDetailTab,
        selectedImageId,
        canGoBack,
        canGoForward,
        goBack,
        goForward,
        systemOverview,
        detectedEngines,
        activeEngine,
        switchEngine,
        rescanEngines,
        containers,
        images,
        volumes,
        networks,
        composeProjects,
        isCommandPaletteOpen,
        searchFilter,
        isInitialLoading,
        isActionInProgress,
        statusMessage,
        selectedHost,
        setActiveTab: handleSetActiveTab,
        setSelectedContainerId: handleSetSelectedContainerId,
        setContainerDetailTab: handleSetContainerDetailTab,
        setSelectedImageId: handleSetSelectedImageId,
        setIsCommandPaletteOpen,
        setSearchFilter,
        setSelectedHost,
        refreshData,
        startContainer: handleStartContainer,
        stopContainer: handleStopContainer,
        pauseContainer: handlePauseContainer,
        unpauseContainer: handleUnpauseContainer,
        restartContainer: handleRestartContainer,
        removeContainer: handleRemoveContainer,
        removeComposeProject: handleRemoveComposeProject,
        upComposeProject: handleUpComposeProject,
        forgetComposeProject: handleForgetComposeProject,
        removeImage: handleRemoveImage,
        removeVolume: handleRemoveVolume,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useAppStore(): AppState {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppStore must be used within an AppProvider");
  }
  return context;
}
