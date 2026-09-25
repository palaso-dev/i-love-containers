import { useState, useEffect, useRef, useMemo } from "react";
import { ContainerDetail, ContainerState, ComposeProject } from "@/types";

export function useContainersSplitState(
  containers: ContainerDetail[],
  composeProjects: ComposeProject[],
  selectedContainerId: string | null,
  setSelectedContainerId: (id: string | null) => void,
  startContainer: (id: string) => Promise<boolean | void>,
  stopContainer: (id: string) => Promise<boolean | void>,
  unpauseContainer: (id: string) => Promise<boolean | void>,
  restartContainer: (id: string) => Promise<boolean | void>,
  upComposeProject: (name: string, dir?: string, file?: string) => Promise<any>,
  refreshData: () => Promise<void>,
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | ContainerState>("all");
  const [containerToDelete, setContainerToDelete] =
    useState<ContainerDetail | null>(null);
  const [stackToDelete, setStackToDelete] = useState<{
    name: string;
    containers: ContainerDetail[];
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkToDelete, setBulkToDelete] = useState<string[] | null>(null);
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  const [portConflict, setPortConflict] = useState<{
    targetContainer: ContainerDetail;
    conflictingContainer: ContainerDetail;
    port: number;
  } | null>(null);


  const [hiddenStacks, setHiddenStacks] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("ilc_hidden_container_stacks");
      return saved
        ? new Set(JSON.parse(saved).map((s: string) => s.toLowerCase()))
        : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    const activeStacks = new Set(
      containers
        .map((c) => c.composeProject?.toLowerCase())
        .filter((name): name is string => Boolean(name)),
    );
    if (activeStacks.size > 0) {
      setHiddenStacks((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const stack of activeStacks) {
          if (next.has(stack)) {
            next.delete(stack);
            changed = true;
          }
        }
        if (changed) {
          try {
            localStorage.setItem(
              "ilc_hidden_container_stacks",
              JSON.stringify(Array.from(next)),
            );
          } catch {}
          return next;
        }
        return prev;
      });
    }
  }, [containers]);

  const [collapsedStacks, setCollapsedStacks] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("ilc_collapsed_stacks");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleStackCollapse = (stackName: string) => {
    setCollapsedStacks((prev) => {
      const next = new Set(prev);
      if (next.has(stackName)) {
        next.delete(stackName);
      } else {
        next.add(stackName);
      }
      try {
        localStorage.setItem(
          "ilc_collapsed_stacks",
          JSON.stringify(Array.from(next)),
        );
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (containerToDelete) setContainerToDelete(null);
        if (stackToDelete) setStackToDelete(null);
        if (bulkToDelete) setBulkToDelete(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [containerToDelete, stackToDelete, bulkToDelete]);

  const splitViewRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [leftWidth, setLeftWidth] = useState(() => {
    try {
      const saved = localStorage.getItem("ilc_containers_split_width");
      const parsed = saved ? parseInt(saved, 10) : 410;
      return parsed <= 280 ? 410 : Math.max(280, Math.min(650, parsed));
    } catch {
      return 410;
    }
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !splitViewRef.current) return;
      const rect = splitViewRef.current.getBoundingClientRect();
      const maxW = Math.max(360, rect.width - 320);
      const newWidth = Math.max(280, Math.min(maxW, ev.clientX - rect.left));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = (ev: MouseEvent) => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (splitViewRef.current) {
        const rect = splitViewRef.current.getBoundingClientRect();
        const maxW = Math.max(360, rect.width - 320);
        const finalWidth = Math.max(
          280,
          Math.min(maxW, ev.clientX - rect.left),
        );
        try {
          localStorage.setItem(
            "ilc_containers_split_width",
            String(finalWidth),
          );
        } catch {}
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const detailPaneRef = useRef<HTMLDivElement>(null);
  const [detailWidth, setDetailWidth] = useState(600);

  useEffect(() => {
    if (!detailPaneRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDetailWidth(entry.contentRect.width);
      }
    });
    ro.observe(detailPaneRef.current);
    return () => ro.disconnect();
  }, []);

  const isCompactDetail = detailWidth < 520;
  const isUltraCompact = detailWidth < 380;

  const filteredContainers = containers.filter((container) => {
    const matchesSearch =
      container.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      container.image.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (container.composeProject &&
        container.composeProject
          .toLowerCase()
          .includes(searchQuery.toLowerCase()));

    const matchesState =
      stateFilter === "all" || container.state === stateFilter;
    return matchesSearch && matchesState;
  });

  useEffect(() => {
    if (containers.length === 0) return;

    const existsInAll = containers.some((c) => c.id === selectedContainerId);

    if (!selectedContainerId || !existsInAll) {
      if (filteredContainers.length > 0) {
        setSelectedContainerId(filteredContainers[0].id);
      } else if (containers.length > 0) {
        setSelectedContainerId(containers[0].id);
      }
    }
  }, [containers, filteredContainers, selectedContainerId, setSelectedContainerId]);

  const activeContainer =
    containers.find((c) => c.id === selectedContainerId) ||
    filteredContainers[0];

  const composeGroups = useMemo(() => {
    const groups: Record<string, ContainerDetail[]> = {};

    for (const proj of composeProjects) {
      if (hiddenStacks.has(proj.name.toLowerCase())) {
        continue;
      }
      const matchesSearch =
        !searchQuery ||
        proj.name.toLowerCase().includes(searchQuery.toLowerCase());
      const shouldIncludeForFilter =
        stateFilter === "all" || stateFilter === "stopped";

      if (matchesSearch && shouldIncludeForFilter) {
        groups[proj.name] = [];
      }
    }

    for (const c of filteredContainers) {
      const rawGroupName = c.composeProject || "__standalone__";
      const existingKey = Object.keys(groups).find(
        (k) => k.toLowerCase() === rawGroupName.toLowerCase(),
      );
      const targetKey = existingKey || rawGroupName;
      if (!groups[targetKey]) groups[targetKey] = [];
      groups[targetKey].push(c);
    }

    return groups;
  }, [
    composeProjects,
    filteredContainers,
    searchQuery,
    stateFilter,
    hiddenStacks,
  ]);

  const handleStopAll = async (
    groupContainers: ContainerDetail[],
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    for (const c of groupContainers) {
      if (c.state === "paused") {
        await unpauseContainer(c.id);
      }
      if (c.state === "running" || c.state === "paused") {
        await stopContainer(c.id);
      }
    }
    await refreshData();
  };

  const handleStartAll = async (
    groupName: string,
    groupContainers: ContainerDetail[],
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setHiddenStacks((prev) => {
      if (prev.has(groupName.toLowerCase())) {
        const next = new Set(prev);
        next.delete(groupName.toLowerCase());
        try {
          localStorage.setItem(
            "ilc_hidden_container_stacks",
            JSON.stringify(Array.from(next)),
          );
        } catch {}
        return next;
      }
      return prev;
    });

    const proj = composeProjects.find(
      (p) => p.name.toLowerCase() === groupName.toLowerCase(),
    );
    if (groupContainers.length === 0 && proj) {
      await upComposeProject(proj.name, proj.workingDir, proj.configFile);
      return;
    }
    for (const c of groupContainers) {
      if (c.state === "paused") {
        await unpauseContainer(c.id);
      } else if (c.state !== "running") {
        await startContainer(c.id);
      }
    }
    await refreshData();
  };

  const handleRestartAll = async (
    groupName: string,
    groupContainers: ContainerDetail[],
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setHiddenStacks((prev) => {
      if (prev.has(groupName.toLowerCase())) {
        const next = new Set(prev);
        next.delete(groupName.toLowerCase());
        try {
          localStorage.setItem(
            "ilc_hidden_container_stacks",
            JSON.stringify(Array.from(next)),
          );
        } catch {}
        return next;
      }
      return prev;
    });

    const proj = composeProjects.find(
      (p) => p.name.toLowerCase() === groupName.toLowerCase(),
    );
    if (groupContainers.length === 0 && proj) {
      await upComposeProject(proj.name, proj.workingDir, proj.configFile);
      return;
    }
    for (const c of groupContainers) {
      if (c.state === "paused") {
        await unpauseContainer(c.id);
      }
      await restartContainer(c.id);
    }
    await refreshData();
  };

  useEffect(() => {
    const containerIdSet = new Set(containers.map((c) => c.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (containerIdSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [containers]);

  const toggleContainerSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroupSelect = (groupContainers: ContainerDetail[]) => {
    const groupIds = groupContainers.map((c) => c.id);
    const allInGroupSelected =
      groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allInGroupSelected) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkStart = async () => {
    setIsBulkOperating(true);
    try {
      for (const id of selectedIds) {
        const c = containers.find((item) => item.id === id);
        if (c && c.state !== "running") {
          await startContainer(id);
        }
      }
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkStop = async () => {
    setIsBulkOperating(true);
    try {
      for (const id of selectedIds) {
        const c = containers.find((item) => item.id === id);
        if (c && (c.state === "running" || c.state === "paused")) {
          await stopContainer(id);
        }
      }
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkRestart = async () => {
    setIsBulkOperating(true);
    try {
      for (const id of selectedIds) {
        await restartContainer(id);
      }
    } finally {
      setIsBulkOperating(false);
    }
  };

  const checkPortConflict = (target: ContainerDetail) => {


    if (!target.ports || target.ports.length === 0) return null;
    const targetPublicPorts = new Set(
      target.ports.filter((p) => p.publicPort).map((p) => p.publicPort!),
    );
    if (targetPublicPorts.size === 0) return null;

    const running = containers.filter(
      (c) => c.state === "running" && c.id !== target.id,
    );
    for (const other of running) {
      if (!other.ports) continue;
      for (const p of other.ports) {
        if (p.publicPort && targetPublicPorts.has(p.publicPort)) {
          return {
            targetContainer: target,
            conflictingContainer: other,
            port: p.publicPort,
          };
        }
      }
    }
    return null;
  };

  const safeStartContainer = async (id: string) => {
    const target = containers.find((c) => c.id === id);
    if (target) {
      const conflict = checkPortConflict(target);
      if (conflict) {
        setPortConflict(conflict);
        return;
      }
    }
    await startContainer(id);
  };

  const confirmPortConflictStart = async () => {
    if (!portConflict) return;
    const id = portConflict.targetContainer.id;
    setPortConflict(null);
    await startContainer(id);
  };


  return {
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
    hiddenStacks,
    setHiddenStacks,
    collapsedStacks,
    toggleStackCollapse,
    splitViewRef,
    leftWidth,
    handleMouseDown,
    detailPaneRef,
    isCompactDetail,
    isUltraCompact,
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
  };
}

