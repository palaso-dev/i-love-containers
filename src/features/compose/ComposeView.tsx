import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  FolderGit2,
  Play,
  Square,
  RotateCw,
  FileText,
  Terminal,
  Layers,
  Code2,
  ListFilter,
  ChevronDown,
  Trash2,
  Edit2,
  Check,
  Plus,
  FileUp,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { openRealNativeWindow } from "@/lib/nativeWindow";
import { parseComposeYaml } from "@/lib/composeParser";
import * as api from "@/lib/api";
import {
  getCustomComposeConfig,
  getSavedStackProjects,
  saveStackProject,
  SavedStackProject,
  getProjectDisplayName,
  getHiddenComposeProjects,
  unhideComposeProject,
} from "@/lib/composeCustomStorage";
import { ComposeDiagramCanvas } from "./ComposeDiagramCanvas";
import { ComposeYamlViewer } from "./ComposeYamlViewer";
import { ComposeStackManagerModal } from "./ComposeStackManagerModal";
import { DockerDisconnected } from "@/components/DockerDisconnected";

export const ComposeView: React.FC = () => {
  const {
    t,
    containers,
    composeProjects,
    systemOverview,
    setActiveTab,
    setSelectedContainerId,
    startContainer,
    stopContainer,
    unpauseContainer,
    restartContainer,
    refreshData,
  } = useAppStore();

  const isConnected = systemOverview?.dockerConnected ?? false;

  const [activeTabMode, setActiveTabMode] = useState<
    "diagram" | "yaml" | "services"
  >("diagram");
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);

  const [savedStacks, setSavedStacks] = useState<SavedStackProject[]>(() =>
    getSavedStackProjects(),
  );
  const [aliasesVersion, setAliasesVersion] = useState(0);
  const [isStackModalOpen, setIsStackModalOpen] = useState(false);
  const [editingStack, setEditingStack] = useState<SavedStackProject | null>(
    null,
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshSavedStacks = () => {
    setSavedStacks(getSavedStackProjects());
    setAliasesVersion((v) => v + 1);
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const mergedProjects = useMemo(() => {
    let hidden = getHiddenComposeProjects();

    const activeProjectNames = new Set(
      containers
        .map((c) => {
          if (c.composeProject) return c.composeProject.toLowerCase();
          const parts = c.name.split(/[-_]/);
          if (parts.length >= 3) return parts[0].toLowerCase();
          return undefined;
        })
        .filter((name): name is string => Boolean(name)),
    );

    if (activeProjectNames.size > 0 && hidden.some((h) => activeProjectNames.has(h))) {
      hidden = hidden.filter((h) => !activeProjectNames.has(h));
      try {
        localStorage.setItem("ilc_compose_hidden_projects_v1", JSON.stringify(hidden));
      } catch {}
    }

    const list = composeProjects.filter(
      (p) => !hidden.includes(p.name.toLowerCase()),
    );

    const containersByProject = new Map<string, typeof containers>();
    for (const c of containers) {
      let projName = c.composeProject;
      if (!projName) {
        const parts = c.name.split(/[-_]/);
        if (parts.length >= 3) {
          projName = parts[0];
        }
      }
      if (!projName) continue;
      if (hidden.includes(projName.toLowerCase())) continue;
      const existing = containersByProject.get(projName.toLowerCase()) || [];
      existing.push(c);
      containersByProject.set(projName.toLowerCase(), existing);
    }

    for (const p of list) {
      if (!p.containers || p.containers.length === 0) {
        const found = containersByProject.get(p.name.toLowerCase());
        if (found && found.length > 0) {
          p.containers = [...found];
          if (found.some((c) => c.state === "running")) {
            p.status = "running";
          }
        }
      }
    }

    for (const [projKey, projContainers] of containersByProject.entries()) {
      const exists = list.some(
        (p) => p.name.toLowerCase() === projKey,
      );
      if (!exists) {
        const displayName = projContainers[0]?.composeProject || projKey;
        const isRunning = projContainers.some((c) => c.state === "running");
        list.push({
          name: displayName,
          containers: [...projContainers],
          status: isRunning ? "running" : "stopped",
        });
      }
    }

    for (const s of savedStacks) {
      if (hidden.includes(s.name.toLowerCase())) continue;
      const exists = list.some(
        (p) => p.name.toLowerCase() === s.name.toLowerCase(),
      );
      if (!exists) {
        list.push({
          name: s.name,
          workingDir: s.workingDir,
          configFile: s.configFile,
          containers: containersByProject.get(s.name.toLowerCase()) || [],
          status: "stopped",
        });
      }
    }
    return list;
  }, [composeProjects, savedStacks, aliasesVersion, containers]);

  const activeProject = mergedProjects[selectedProjectIndex] ||
    mergedProjects[0] || {
      name: "compose",
      containers: [],
    };
  const projectName = activeProject?.name || "compose";

  const [composeYaml, setComposeYaml] = useState<string>(() => {
    if (activeProject?.yamlContent) {
      return activeProject.yamlContent;
    }
    try {
      const saved =
        localStorage.getItem(`ilc-compose-yaml-${projectName}`) ||
        localStorage.getItem("ilc-compose-yaml-last");
      return saved || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (activeProject?.yamlContent) {
      setComposeYaml(activeProject.yamlContent);
    } else if (activeProject?.name) {
      try {
        const saved =
          localStorage.getItem(`ilc-compose-yaml-${activeProject.name}`) ||
          localStorage.getItem("ilc-compose-yaml-last");
        if (saved) {
          setComposeYaml(saved);
        }
      } catch {}
    }
  }, [activeProject?.name, activeProject?.yamlContent]);

  const topology = useMemo(() => {
    return parseComposeYaml(composeYaml, activeProject?.containers || []);
  }, [composeYaml, activeProject]);

  if (!isConnected) {
    return <DockerDisconnected icon={FolderGit2} />;
  }

  const handleYamlChange = (newYaml: string) => {
    setComposeYaml(newYaml);
    const pName = activeProject?.name || "compose";
    try {
      localStorage.setItem(`ilc-compose-yaml-${pName}`, newYaml);
      localStorage.setItem("ilc-compose-yaml-last", newYaml);
    } catch {}

    if (activeProject?.configFile || activeProject?.workingDir) {
      api.saveComposeProjectYaml(
        pName,
        newYaml,
        activeProject.workingDir,
        activeProject.configFile,
      );
    }
  };

  const handleDeploy = async () => {
    if (!activeProject || isDeploying) return;
    setIsDeploying(true);
    setDeploySuccess(false);
    try {
      const customCfg = getCustomComposeConfig(activeProject.name);
      const customCommand =
        customCfg.useAsDefault && customCfg.command.trim()
          ? customCfg.command.trim()
          : undefined;
      const res = await api.upComposeProject(
        activeProject.name,
        activeProject.workingDir,
        activeProject.configFile,
        customCommand,
      );
      if (res.ok) {
        setDeploySuccess(true);
        setTimeout(() => setDeploySuccess(false), 3000);
      }
      await refreshData();
    } catch {
    } finally {
      setIsDeploying(false);
    }
  };

  const handleForget = async () => {
    if (!activeProject || composeProjects.length === 0) return;
    if (
      window.confirm(
        `¿Quitar "${activeProject.name}" del historial de stacks guardados?`,
      )
    ) {
      await api.forgetComposeProject(activeProject.name);
      await refreshData();
      if (selectedProjectIndex > 0) {
        setSelectedProjectIndex(selectedProjectIndex - 1);
      }
    }
  };

  const handleStopAll = async (containerIds: string[]) => {
    for (const id of containerIds) {
      const c = containers.find((item) => item.id === id);
      if (c?.state === "paused") {
        await unpauseContainer(id);
      }
      await stopContainer(id);
    }
    await refreshData();
  };

  const handleStartStack = async () => {
    if (!activeProject) return;
    let success = false;
    const saved = savedStacks.find(
      (s) => s.name.toLowerCase() === activeProject.name.toLowerCase(),
    );
    const customCfg = getCustomComposeConfig(activeProject.name);
    const customCommand =
      (saved?.command && saved.command.trim()) ||
      (customCfg.useAsDefault && customCfg.command.trim()
        ? customCfg.command.trim()
        : undefined);
    const effectiveWorkingDir = saved?.workingDir || activeProject.workingDir;
    const effectiveConfigFile = saved?.configFile || activeProject.configFile;

    if (effectiveConfigFile || effectiveWorkingDir || customCommand) {
      const res = await api.upComposeProject(
        activeProject.name,
        effectiveWorkingDir,
        effectiveConfigFile,
        customCommand,
      );
      success = res.ok;
    }
    if (!success && activeContainerIds.length > 0) {
      for (const id of activeContainerIds) {
        const c = containers.find((item) => item.id === id);
        if (c?.state === "paused") {
          await unpauseContainer(id);
        } else if (c?.state !== "running") {
          await startContainer(id);
        }
      }
    }
    await refreshData();
  };

  const handleRestartAll = async (containerIds: string[]) => {
    if (activeProject) {
      const saved = savedStacks.find(
        (s) => s.name.toLowerCase() === activeProject.name.toLowerCase(),
      );
      const customCfg = getCustomComposeConfig(activeProject.name);
      const customCommand =
        (saved?.command && saved.command.trim()) ||
        (customCfg.useAsDefault && customCfg.command.trim()
          ? customCfg.command.trim()
          : undefined);
      const effectiveWorkingDir = saved?.workingDir || activeProject.workingDir;
      const effectiveConfigFile = saved?.configFile || activeProject.configFile;

      if (customCommand || effectiveConfigFile || effectiveWorkingDir) {
        await api.upComposeProject(
          activeProject.name,
          effectiveWorkingDir,
          effectiveConfigFile,
          customCommand,
        );
        await refreshData();
        return;
      }
    }
    for (const id of containerIds) {
      const c = containers.find((item) => item.id === id);
      if (c?.state === "paused") {
        await unpauseContainer(id);
      }
      await restartContainer(id);
    }
    await refreshData();
  };

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const processDroppedYaml = async (filePath?: string, content?: string) => {
    let text = content || "";
    if (!text && filePath) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        text = await invoke<string>("read_host_text_file", { path: filePath });
      } catch {}
    }
    if (!text && !filePath) return;

    let derivedName = "compose-stack";
    if (filePath) {
      const parts = filePath.replace(/\\/g, "/").split("/");
      const fileName = parts.pop() || "";
      const parentDir = parts.pop();
      if (fileName.toLowerCase().startsWith("docker-compose") || fileName.toLowerCase().startsWith("compose")) {
        derivedName = parentDir || "compose-stack";
      } else {
        derivedName = fileName.replace(/\.(ya?ml)$/i, "") || parentDir || "compose-stack";
      }
    } else if (text) {
      const match = text.match(/name:\s*([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        derivedName = match[1].trim();
      }
    }

    let workingDir = "";
    if (filePath) {
      const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
      if (lastSlash > 0) {
        workingDir = filePath.substring(0, lastSlash);
      }
    }

    unhideComposeProject(derivedName);
    saveStackProject({
      name: derivedName,
      configFile: filePath || undefined,
      workingDir: workingDir || "",
      command: "docker compose up -d",
      useAsDefault: true,
    });

    if (text) {
      setComposeYaml(text);
      try {
        localStorage.setItem(`ilc-compose-yaml-${derivedName}`, text);
        localStorage.setItem("ilc-compose-yaml-last", text);
      } catch {}
    }

    refreshSavedStacks();
    await refreshData();
    setSelectedProjectIndex(0);
  };

  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | null = null;

    const initTauriDrag = async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const webview = getCurrentWebview();
        const unlistenFn = await webview.onDragDropEvent(async (event) => {
          if (!isMounted) return;
          if (event.payload.type === "over" || event.payload.type === "enter") {
            setIsDraggingOver(true);
          } else if (event.payload.type === "drop") {
            setIsDraggingOver(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              const yamlPath = paths.find((p) => p.endsWith(".yml") || p.endsWith(".yaml")) || paths[0];
              if (yamlPath) {
                await processDroppedYaml(yamlPath);
              }
            }
          } else {
            setIsDraggingOver(false);
          }
        });
        if (isMounted) {
          unlisten = unlistenFn;
        } else {
          unlistenFn();
        }
      } catch {}
    };

    initTauriDrag();
    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;

    const targetFile = files.find(
      (f) => f.name.endsWith(".yml") || f.name.endsWith(".yaml") || f.name.includes("compose"),
    ) || files[0];

    if (!targetFile) return;

    const filePath = (targetFile as any).path || "";
    const text = await targetFile.text();
    await processDroppedYaml(filePath || undefined, text);
  };

  const activeContainerIds = activeProject
    ? activeProject.containers.map((c) => c.id)
    : [];
  const runningCount = activeProject
    ? activeProject.containers.filter((c) => c.state === "running").length
    : 0;
  const isInactive = runningCount === 0;

  if (mergedProjects.length === 0) {
    return (
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex-1 h-full flex flex-col items-center justify-center p-8 bg-background select-none relative"
      >
        {isDraggingOver && (
          <div className="absolute inset-4 rounded-3xl border-2 border-dashed border-primary/60 bg-primary/10 backdrop-blur-xs flex flex-col items-center justify-center z-50 animate-in fade-in zoom-in-95 pointer-events-none">
            <FileUp className="w-12 h-12 text-primary animate-bounce mb-3" />
            <p className="text-sm font-semibold text-primary">
              Suelta tu archivo compose.yml aquí
            </p>
          </div>
        )}

        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-secondary/80 border border-border/80 flex items-center justify-center shadow-xs">
            <FolderGit2 className="w-8 h-8 text-muted-foreground/60" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Sin stacks de Compose
            </h3>
            <p className="text-xs text-muted-foreground">
              Arrastra y suelta tu archivo YAML aquí o agrega un nuevo stack.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingStack(null);
              setIsStackModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Stack</span>
          </button>
        </div>

        <ComposeStackManagerModal
          isOpen={isStackModalOpen}
          onClose={() => {
            setIsStackModalOpen(false);
            setEditingStack(null);
          }}
          onSuccess={() => {
            refreshSavedStacks();
            refreshData();
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col h-full overflow-hidden bg-background relative"
    >
      {isDraggingOver && (
        <div className="absolute inset-4 rounded-3xl border-2 border-dashed border-primary/60 bg-primary/10 backdrop-blur-xs flex flex-col items-center justify-center z-50 animate-in fade-in zoom-in-95 pointer-events-none">
          <FileUp className="w-12 h-12 text-primary animate-bounce mb-3" />
          <p className="text-sm font-semibold text-primary">
            Suelta tu archivo compose.yml aquí para cargarlo
          </p>
        </div>
      )}
      <div className="relative z-30 px-5 py-3 border-b border-border/70 bg-surface/90 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl border flex items-center justify-center shadow-xs shrink-0 ${
              isInactive
                ? "bg-muted/20 border-border text-muted-foreground"
                : "bg-primary/15 border-primary/30 text-primary"
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 shrink-0">
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    className="flex items-center space-x-2 bg-surface-secondary/90 hover:bg-surface-secondary border border-border/80 text-foreground text-sm font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none transition-colors max-w-[220px] shadow-xs cursor-pointer"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        !isInactive
                          ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.7)]"
                          : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="truncate">
                      {getProjectDisplayName(activeProject.name)}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 shrink-0 ${
                        isDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-popover-border rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-none">
                      {mergedProjects.map((p, idx) => {
                        const pActive = p.containers.some(
                          (c) => c.state === "running",
                        );
                        const isSelected = idx === selectedProjectIndex;
                        const displayName = getProjectDisplayName(p.name);
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => {
                              setSelectedProjectIndex(idx);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                              isSelected
                                ? "bg-primary/15 text-primary font-medium"
                                : "text-foreground hover:bg-surface-hover"
                            }`}
                          >
                            <div className="flex items-center space-x-2 truncate mr-2">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  pActive
                                    ? "bg-status-running shadow-[0_0_5px_rgba(48,209,88,0.7)]"
                                    : "bg-muted-foreground/40"
                                }`}
                              />
                              <span className="truncate">{displayName}</span>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    const saved = savedStacks.find(
                      (s) => s.name.toLowerCase() === activeProject.name.toLowerCase(),
                    );
                    setEditingStack(
                      saved || {
                        id: "",
                        name: getProjectDisplayName(activeProject.name),
                        workingDir: activeProject.workingDir || "",
                        configFile: activeProject.configFile || "",
                        command: getCustomComposeConfig(activeProject.name).command || "docker compose up -d",
                        useAsDefault: true,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                      },
                    );
                    setIsStackModalOpen(true);
                  }}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
                  title="Editar Configuración del Stack"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p
              className="text-[11px] font-mono text-muted-foreground select-text cursor-text break-all"
              title={
                activeProject?.configFile ||
                activeProject?.workingDir ||
                "/workspace"
              }
            >
              {activeProject?.configFile ||
                activeProject?.workingDir ||
                "/workspace"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="inline-flex items-center bg-surface-secondary/80 border border-border/70 p-0.5 rounded-lg shadow-xs">
            <button
              onClick={() => setActiveTabMode("diagram")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTabMode === "diagram"
                  ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>{t.compose.diagramView}</span>
            </button>

            <button
              onClick={() => setActiveTabMode("yaml")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTabMode === "yaml"
                  ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-sky-400" />
              <span>{t.compose.yamlView}</span>
            </button>

            <button
              onClick={() => setActiveTabMode("services")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                activeTabMode === "services"
                  ? "bg-surface text-foreground font-semibold shadow-mac-segment"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.compose.servicesView}</span>
            </button>
          </div>

          <div className="h-4 w-[1px] bg-border/80 hidden sm:block" />

          <div className="flex items-center space-x-1.5">

            <button
              onClick={() =>
                openRealNativeWindow({
                  id: `stack-logs-${activeProject.name}-${Date.now()}`,
                  title: `${activeProject.name} — Unified Logs`,
                  type: "logs",
                  composeProject: activeProject.name,
                })
              }
              className="p-1.5 rounded-lg text-muted-foreground hover:text-sky-400 bg-surface border border-border/70 hover:border-sky-400/40 transition-colors shadow-xs"
              title={t.compose.stackLogs}
            >
              <FileText className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleStartStack}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-status-running bg-surface border border-border/70 hover:border-status-running/40 transition-colors shadow-xs"
              title={t.compose.startStack}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              onClick={() => handleStopAll(activeContainerIds)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-status-restarting bg-surface border border-border/70 hover:border-status-restarting/40 transition-colors shadow-xs"
              title={t.compose.stopStack}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              onClick={() => handleRestartAll(activeContainerIds)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-sky-400 bg-surface border border-border/70 hover:border-sky-400/40 transition-colors shadow-xs"
              title={t.compose.restartStack}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-[1px] bg-border/80 hidden sm:block" />

            {isInactive && composeProjects.length > 0 && (
              <button
                onClick={handleForget}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-status-danger bg-surface border border-border/70 hover:border-status-danger/40 transition-colors shadow-xs"
                title="Olvidar stack"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTabMode === "diagram" && (
          <ComposeDiagramCanvas
            topology={topology}
            projectName={activeProject.name}
          />
        )}

        {activeTabMode === "yaml" && (
          <div className="p-4 h-full">
            <ComposeYamlViewer
              yamlContent={composeYaml}
              onYamlChange={handleYamlChange}
              projectName={activeProject.name}
              configFile={activeProject.configFile}
              workingDir={activeProject.workingDir}
              onDeploy={handleDeploy}
              isDeploying={isDeploying}
              deploySuccess={deploySuccess}
            />
          </div>
        )}

        {activeTabMode === "services" && (
          <div className="p-5 overflow-y-auto h-full space-y-3">
            {activeProject.containers.length === 0 ? (
              <div className="bg-surface/50 border border-border/60 rounded-xl p-8 text-center shadow-xs">
                <FolderGit2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  0 servicios en ejecución
                </h4>
              </div>
            ) : (
              <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl overflow-hidden shadow-xs">
                <div className="divide-y divide-border/60">
                  {activeProject.containers.map((container) => {
                    const isRunning = container.state === "running";
                    return (
                      <div
                        key={container.id}
                        className="px-4 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors text-xs group"
                      >
                        <div
                          className="flex items-center space-x-3 cursor-pointer truncate flex-1 mr-4"
                          onClick={() => {
                            setActiveTab("containers");
                            setSelectedContainerId(container.id);
                          }}
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              isRunning
                                ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.7)]"
                                : "bg-status-stopped"
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-foreground group-hover:text-primary transition-colors text-xs truncate">
                                {container.composeService || container.name}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground bg-surface-secondary px-1.5 py-0.2 rounded border border-border/50">
                                {container.id.substring(0, 10)}
                              </span>
                            </div>
                            <p className="text-2xs font-mono text-muted-foreground mt-0.5 truncate">
                              {container.image} • {container.status}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          {container.ports &&
                            container.ports.length > 0 &&
                            container.ports[0].publicPort && (
                              <span className="text-[10px] font-mono text-primary bg-primary-muted border border-primary/20 px-2 py-0.5 rounded-full">
                                :{container.ports[0].publicPort}
                              </span>
                            )}

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() =>
                                openRealNativeWindow({
                                  id: `term-${container.id}-${Date.now()}`,
                                  title: `${container.name} — Terminal`,
                                  type: "terminal",
                                  containerId: container.id,
                                  containerName: container.name,
                                })
                              }
                              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-surface-secondary transition-colors"
                              title="Open terminal in native window"
                            >
                              <Terminal className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                openRealNativeWindow({
                                  id: `logs-${container.id}-${Date.now()}`,
                                  title: `${container.name} — Logs`,
                                  type: "logs",
                                  containerId: container.id,
                                  containerName: container.name,
                                })
                              }
                              className="p-1.5 rounded-md text-muted-foreground hover:text-sky-400 hover:bg-surface-secondary transition-colors"
                              title="Open logs in native window"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            {isRunning ? (
                              <button
                                onClick={() => stopContainer(container.id)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-status-restarting hover:bg-surface-secondary transition-colors"
                                title={t.containers.stop}
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                              </button>
                            ) : (
                              <button
                                onClick={() => startContainer(container.id)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-status-running hover:bg-surface-secondary transition-colors"
                                title={t.containers.start}
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ComposeStackManagerModal
        isOpen={isStackModalOpen}
        onClose={() => {
          setIsStackModalOpen(false);
          setEditingStack(null);
        }}
        currentProject={
          activeProject
            ? {
                name: getProjectDisplayName(activeProject.name),
                originalName: activeProject.name,
                workingDir: activeProject.workingDir,
                configFile: activeProject.configFile,
              }
            : undefined
        }
        editingStack={editingStack}
        onSuccess={() => {
          refreshSavedStacks();
          refreshData();
        }}
        onDelete={async () => {
          if (activeProject?.name) {
            await api.forgetComposeProject(activeProject.name);
          }
          refreshSavedStacks();
          await refreshData();
          if (selectedProjectIndex > 0) {
            setSelectedProjectIndex(selectedProjectIndex - 1);
          }
        }}
      />
    </div>
  );
};
