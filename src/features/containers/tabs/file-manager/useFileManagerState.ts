import { useState, useEffect, useCallback, useRef } from "react";
import { Translations } from "@/lib/i18n";
import { ContainerFileItem, ContainerState } from "@/types";
import {
  fetchContainerFiles,
  saveContainerFile,
  renameContainerFile,
  deleteContainerFiles,
  copyContainerFile,
  uploadContainerFile,
  copyHostFileToContainer,
  fetchFileContent,
} from "@/lib/api";
import {
  getFileManagerCache,
  setFileManagerCache,
} from "@/lib/fileManagerCache";
import { getUniqueDuplicateName } from "./fileTypes";
import { ViewerModalState } from "./FileViewerModal";

interface TauriDragDropPayload {
  type: string;
  paths: string[];
}

export function useFileManagerState(
  containerId: string,
  state: ContainerState,
  fm: Translations["containers"]["fileManager"],
) {
  const isRunning = state === "running";
  const cached = getFileManagerCache(containerId);

  const [currentPath, setCurrentPath] = useState<string>(
    cached?.currentPath || "/",
  );
  const [defaultPath, setDefaultPath] = useState<string>("/");
  const [history, setHistory] = useState<string[]>(cached?.history || ["/"]);
  const [historyIdx, setHistoryIdx] = useState<number>(cached?.historyIdx || 0);
  const [files, setFiles] = useState<ContainerFileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">(
    cached?.viewMode || "grid",
  );
  const [sortField, setSortField] = useState<"name" | "size" | "mtime">(
    cached?.sortField || "name",
  );
  const [sortAsc, setSortAsc] = useState<boolean>(cached?.sortAsc ?? true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isEditingPath, setIsEditingPath] = useState<boolean>(false);
  const [pathInput, setPathInput] = useState<string>(
    cached?.currentPath || "/",
  );
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const [dropStatus, setDropStatus] = useState<{
    type: "loading" | "success" | "error";
    message: string;
  } | null>(null);

  const [dropTarget, setDropTarget] = useState<ContainerFileItem | null>(null);

  const lastProcessedPathsRef = useRef<{ timestamp: number; key: string }>({
    timestamp: 0,
    key: "",
  });

  const [clipboard, setClipboard] = useState<{
    action: "copy" | "cut";
    items: ContainerFileItem[];
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item?: ContainerFileItem;
  } | null>(null);

  const [viewerModal, setViewerModal] = useState<ViewerModalState | null>(null);

  const [renameModal, setRenameModal] = useState<{
    item: ContainerFileItem;
    newName: string;
  } | null>(null);

  const [newFolderModal, setNewFolderModal] = useState<{ name: string } | null>(
    null,
  );
  const [newFileModal, setNewFileModal] = useState<{ name: string } | null>(
    null,
  );
  const [deleteModal, setDeleteModal] = useState<{
    items: ContainerFileItem[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const lastClickedIndexRef = useRef<number>(-1);
  const shiftAnchorIndexRef = useRef<number>(-1);
  const cursorIndexRef = useRef<number>(-1);
  const isDraggingInternalRef = useRef<boolean>(false);
  const lastOperationRef = useRef<
    | { type: "move"; items: { from: string; to: string }[] }
    | { type: "copy"; items: { to: string }[] }
    | null
  >(null);

  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  const fmRef = useRef(fm);
  fmRef.current = fm;

  const loadFiles = useCallback(
    async (path?: string) => {
      setIsLoading(true);
      try {
        const res = await fetchContainerFiles(containerId, path);
        const resolvedPath = res.currentPath || path || "/";
        setFiles(res.entries || []);
        setCurrentPath(resolvedPath);
        setPathInput(resolvedPath);
        if (res.defaultWorkingDir) {
          setDefaultPath(res.defaultWorkingDir);
        }
        setSelectedPaths(new Set());
        return resolvedPath;
      } catch {
        setFiles([]);
        return path || "/";
      } finally {
        setIsLoading(false);
      }
    },
    [containerId],
  );

  useEffect(() => {
    if (!isRunning) return;
    let isMounted = true;
    (async () => {
      const cachedState = getFileManagerCache(containerId);
      const pathToLoad = cachedState?.currentPath || undefined;
      const resolved = await loadFiles(pathToLoad);
      if (isMounted && resolved) {
        if (!cachedState) {
          setHistory([resolved]);
          setHistoryIdx(0);
          setFileManagerCache(containerId, {
            currentPath: resolved,
            history: [resolved],
            historyIdx: 0,
          });
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [containerId, isRunning, loadFiles]);

  useEffect(() => {
    setFileManagerCache(containerId, {
      currentPath,
      history,
      historyIdx,
      viewMode,
      sortField,
      sortAsc,
    });
  }, [
    containerId,
    currentPath,
    history,
    historyIdx,
    viewMode,
    sortField,
    sortAsc,
  ]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isMounted = true;

    async function handleTauriDrop(paths: string[]) {
      if (!isMounted || !paths || paths.length === 0) return;
      const dedupeKey = paths.slice().sort().join("|");
      lastProcessedPathsRef.current = { timestamp: Date.now(), key: dedupeKey };

      const targetDir = currentPathRef.current;
      const count = paths.length;
      setDropStatus({
        type: "loading",
        message: `${fmRef.current.uploading} (${count})`,
      });

      let anyError = "";
      let successCount = 0;

      for (const hostPath of paths) {
        try {
          const res = await copyHostFileToContainer(
            containerId,
            targetDir,
            hostPath,
          );
          if (res.ok) {
            successCount++;
          } else {
            anyError = res.error || fmRef.current.uploadFailed;
          }
        } catch (e) {
          anyError = String(e);
        }
      }

      await loadFiles(targetDir);

      if (anyError && successCount === 0) {
        setDropStatus({ type: "error", message: anyError });
      } else if (anyError) {
        setDropStatus({
          type: "error",
          message: `${fmRef.current.uploadSuccess} (${successCount}/${count}) - ${anyError}`,
        });
      } else {
        setDropStatus({
          type: "success",
          message: fmRef.current.uploadSuccess,
        });
      }

      setTimeout(() => {
        if (isMounted) setDropStatus(null);
      }, 4000);
    }

    async function initTauriDragDrop() {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const currentWebview = getCurrentWebview();
        const unlistenFn = await currentWebview.onDragDropEvent(
          async (event) => {
            if (!isMounted) return;
            if (isDraggingInternalRef.current) return;
            if (
              event.payload.type === "over" ||
              event.payload.type === "enter"
            ) {
              setIsDraggingOver(true);
            } else if (event.payload.type === "drop") {
              setIsDraggingOver(false);
              await handleTauriDrop(event.payload.paths);
            } else {
              setIsDraggingOver(false);
            }
          },
        );
        if (isMounted) {
          unlisten = unlistenFn;
        } else {
          unlistenFn();
        }
        return;
      } catch {}

      try {
        const { listen } = await import("@tauri-apps/api/event");
        const unlistenFn = await listen<TauriDragDropPayload>(
          "tauri://drag-drop",
          async (event) => {
            if (!isMounted) return;
            if (isDraggingInternalRef.current) return;
            const payload = event.payload;
            if (payload.type === "over" || payload.type === "enter") {
              setIsDraggingOver(true);
            } else if (payload.type === "drop") {
              setIsDraggingOver(false);
              await handleTauriDrop(payload.paths);
            } else {
              setIsDraggingOver(false);
            }
          },
        );
        if (isMounted) {
          unlisten = unlistenFn;
        } else {
          unlistenFn();
        }
      } catch {}
    }

    initTauriDragDrop();

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [containerId, loadFiles]);

  useEffect(() => {
    let dragEnterCount = 0;

    const hasExternalFiles = (e: DragEvent): boolean => {
      if (isDraggingInternalRef.current) return false;
      if (!e.dataTransfer) return false;
      const types = Array.from(e.dataTransfer.types || []);
      return types.includes("Files") && !types.includes("application/json");
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasExternalFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
      setIsDraggingOver(true);
    };

    const onDragEnter = (e: DragEvent) => {
      if (!hasExternalFiles(e)) return;
      e.preventDefault();
      dragEnterCount++;
      setIsDraggingOver(true);
    };

    const onDragLeave = () => {
      dragEnterCount--;
      if (dragEnterCount <= 0) {
        dragEnterCount = 0;
        setIsDraggingOver(false);
      }
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragEnterCount = 0;
      setIsDraggingOver(false);

      if (Date.now() - lastProcessedPathsRef.current.timestamp < 1500) {
        return;
      }

      const droppedFiles = e.dataTransfer?.files;
      if (!droppedFiles || droppedFiles.length === 0) return;

      const filesList = Array.from(droppedFiles);
      const targetDir = currentPathRef.current;
      setDropStatus({
        type: "loading",
        message: `${fmRef.current.uploading} (${filesList.length})`,
      });
      setIsLoading(true);

      let anyError = false;
      let successCount = 0;
      for (const file of filesList) {
        try {
          const res = await uploadContainerFile(containerId, targetDir, file);
          if (res.ok) successCount++;
          else anyError = true;
        } catch {
          anyError = true;
        }
      }

      await loadFiles(targetDir);
      setIsLoading(false);

      if (anyError && successCount === 0) {
        setDropStatus({ type: "error", message: fmRef.current.uploadFailed });
      } else if (anyError) {
        setDropStatus({
          type: "error",
          message: `${fmRef.current.uploadSuccess} (${successCount}/${filesList.length}) - ${fmRef.current.uploadFailed}`,
        });
      } else {
        setDropStatus({
          type: "success",
          message: fmRef.current.uploadSuccess,
        });
      }

      setTimeout(() => setDropStatus(null), 4000);
    };

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);

    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, [containerId, loadFiles]);

  const navigateTo = (newPath: string) => {
    const clean = newPath.trim() || "/";
    if (clean === currentPath) return;
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push(clean);
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
    loadFiles(clean);
  };

  const handleBack = () => {
    if (historyIdx > 0) {
      const prev = history[historyIdx - 1];
      setHistoryIdx(historyIdx - 1);
      loadFiles(prev);
    }
  };

  const handleForward = () => {
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1];
      setHistoryIdx(historyIdx + 1);
      loadFiles(next);
    }
  };

  const handleUp = () => {
    if (currentPath === "/") return;
    const segments = currentPath.split("/").filter(Boolean);
    segments.pop();
    const upPath = segments.length === 0 ? "/" : "/" + segments.join("/");
    navigateTo(upPath);
  };

  const handleRefresh = () => {
    loadFiles(currentPath);
  };

  const handleItemDoubleClickRef = useRef<typeof handleItemDoubleClick | null>(null);
  const handleItemDoubleClick = async (item: ContainerFileItem) => {
    if (item.isDirectory) {
      navigateTo(item.path);
    } else {
      setIsLoading(true);
      try {
        const data = await fetchFileContent(containerId, item.path);
        setViewerModal({
          item,
          content: data.content || "",
          originalContent: data.content || "",
          isBinary: data.isBinary,
          isSaving: false,
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const sortedFiles = [...files]
    .filter((f) =>
      searchQuery
        ? f.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true,
    )
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "size") {
        cmp = a.size - b.size;
      } else if (sortField === "mtime") {
        cmp = a.mtime.localeCompare(b.mtime);
      }
      return sortAsc ? cmp : -cmp;
    });

  handleItemDoubleClickRef.current = handleItemDoubleClick;

  const handleSelect = (e: React.MouseEvent, item: ContainerFileItem) => {
    e.stopPropagation();
    setContextMenu(null);
    const clickedIndex = sortedFiles.findIndex((f) => f.path === item.path);
    cursorIndexRef.current = clickedIndex;

    if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      const start = Math.min(lastClickedIndexRef.current, clickedIndex);
      const end = Math.max(lastClickedIndexRef.current, clickedIndex);
      const rangePaths = sortedFiles.slice(start, end + 1).map((f) => f.path);
      if (e.metaKey || e.ctrlKey) {
        const next = new Set(selectedPaths);
        rangePaths.forEach((p) => next.add(p));
        setSelectedPaths(next);
      } else {
        setSelectedPaths(new Set(rangePaths));
      }
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedPaths);
      if (next.has(item.path)) next.delete(item.path);
      else next.add(item.path);
      setSelectedPaths(next);
      lastClickedIndexRef.current = clickedIndex;
    } else {
      setSelectedPaths(new Set([item.path]));
      lastClickedIndexRef.current = clickedIndex;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item?: ContainerFileItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (item && !selectedPaths.has(item.path)) {
      setSelectedPaths(new Set([item.path]));
    }
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const el = contextMenuRef.current;
    const rect = el.getBoundingClientRect();
    let x = contextMenu.x;
    let y = contextMenu.y;
    let changed = false;
    if (x + rect.width > window.innerWidth) {
      x = window.innerWidth - rect.width - 8;
      changed = true;
    }
    if (y + rect.height > window.innerHeight) {
      y = window.innerHeight - rect.height - 8;
      changed = true;
    }
    if (changed) {
      setContextMenu({ x, y, item: contextMenu.item });
    }
  }, [contextMenu]);

  useEffect(() => {
    const handleDismiss = (e: MouseEvent | TouchEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handleDismiss, true);
    window.addEventListener("touchstart", handleDismiss, true);
    return () => {
      window.removeEventListener("mousedown", handleDismiss, true);
      window.removeEventListener("touchstart", handleDismiss, true);
    };
  }, []);

  const handleCopy = useCallback(
    (item?: ContainerFileItem) => {
      const targetItems = item
        ? [item]
        : files.filter((f) => selectedPaths.has(f.path));
      if (targetItems.length > 0) {
        setClipboard({ action: "copy", items: targetItems });
      }
      setContextMenu(null);
    },
    [files, selectedPaths],
  );

  const handleCut = useCallback(
    (item?: ContainerFileItem) => {
      const targetItems = item
        ? [item]
        : files.filter((f) => selectedPaths.has(f.path));
      if (targetItems.length > 0) {
        setClipboard({ action: "cut", items: targetItems });
      }
      setContextMenu(null);
    },
    [files, selectedPaths],
  );

  const handlePaste = useCallback(async () => {
    if (!clipboard || clipboard.items.length === 0) return;
    setIsLoading(true);
    const existingNames = new Set(files.map((f) => f.name));
    const movedItems: { from: string; to: string }[] = [];
    const copiedItems: { to: string }[] = [];

    for (const item of clipboard.items) {
      let destName = item.name;
      if (clipboard.action === "copy") {
        destName = getUniqueDuplicateName(item.name, existingNames);
        existingNames.add(destName);
      } else if (
        existingNames.has(item.name) &&
        item.path !==
          (currentPath === "/"
            ? `/${item.name}`
            : `${currentPath}/${item.name}`)
      ) {
        destName = getUniqueDuplicateName(item.name, existingNames);
        existingNames.add(destName);
      }
      const target =
        currentPath === "/" ? `/${destName}` : `${currentPath}/${destName}`;
      if (clipboard.action === "copy") {
        await copyContainerFile(containerId, item.path, target);
        copiedItems.push({ to: target });
      } else {
        await renameContainerFile(containerId, item.path, target);
        movedItems.push({ from: item.path, to: target });
      }
    }

    if (clipboard.action === "cut") {
      setClipboard(null);
      if (movedItems.length > 0) {
        lastOperationRef.current = { type: "move", items: movedItems };
      }
    } else if (copiedItems.length > 0) {
      lastOperationRef.current = { type: "copy", items: copiedItems };
    }

    await loadFiles(currentPath);
    setIsLoading(false);
    setContextMenu(null);
  }, [clipboard, containerId, currentPath, files, loadFiles]);

  const handleUndo = useCallback(async () => {
    const op = lastOperationRef.current;
    if (!op) return;

    lastOperationRef.current = null;
    setIsLoading(true);

    if (op.type === "move") {
      for (const item of op.items) {
        await renameContainerFile(containerId, item.to, item.from);
      }
    } else if (op.type === "copy") {
      await deleteContainerFiles(
        containerId,
        op.items.map((i) => i.to),
      );
    }

    await loadFiles(currentPath);
    setIsLoading(false);
  }, [containerId, currentPath, loadFiles]);

  const handleFileDragStart = (e: React.DragEvent, file: ContainerFileItem) => {
    e.stopPropagation();

    const filesToDrag = selectedPaths.has(file.path)
      ? files.filter((f) => selectedPaths.has(f.path))
      : [file];

    if (filesToDrag.length === 0) return;

    isDraggingInternalRef.current = true;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        type: "container-files",
        paths: filesToDrag.map((f) => f.path),
        names: filesToDrag.map((f) => f.name),
      }),
    );
  };

  const handleFileDragEnd = () => {
    isDraggingInternalRef.current = false;
    setDropTarget(null);
    setIsDraggingOver(false);
  };

  const handleItemDragOver = (
    e: React.DragEvent,
    targetItem: ContainerFileItem,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDropTarget(targetItem);
  };

  const handleItemDragLeave = (
    e: React.DragEvent,
    targetItem: ContainerFileItem,
  ) => {
    e.stopPropagation();
    if (dropTarget?.path === targetItem.path) {
      setDropTarget(null);
    }
  };

  const handleItemDrop = async (
    e: React.DragEvent,
    targetItem: ContainerFileItem,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    setIsDraggingOver(false);

    const internalData = e.dataTransfer.getData("application/json");
    if (internalData) {
      try {
        const parsed = JSON.parse(internalData);
        if (parsed.type === "container-files" && Array.isArray(parsed.paths)) {
          const sourcePaths: string[] = parsed.paths;
          if (sourcePaths.includes(targetItem.path)) return;

          let targetDir = targetItem.path;
          if (!targetItem.isDirectory) {
            const parts = targetItem.path.split("/").filter(Boolean);
            parts.pop();
            targetDir = parts.length === 0 ? "/" : `/${parts.join("/")}`;
          }

          setIsLoading(true);
          const currentDirFiles =
            targetDir === currentPath
              ? files
              : (await fetchContainerFiles(containerId, targetDir)).entries ||
                [];
          const existingNames = new Set(currentDirFiles.map((f) => f.name));
          const movedItems: { from: string; to: string }[] = [];

          for (const srcPath of sourcePaths) {
            const fileName = srcPath.split("/").filter(Boolean).pop() || "file";
            let destName = fileName;
            if (existingNames.has(fileName)) {
              destName = getUniqueDuplicateName(fileName, existingNames);
            }
            existingNames.add(destName);
            const targetDest =
              targetDir === "/" ? `/${destName}` : `${targetDir}/${destName}`;
            if (srcPath !== targetDest) {
              await renameContainerFile(containerId, srcPath, targetDest);
              movedItems.push({ from: srcPath, to: targetDest });
            }
          }

          if (movedItems.length > 0) {
            lastOperationRef.current = { type: "move", items: movedItems };
          }

          await loadFiles(currentPath);
          setIsLoading(false);
          setDropStatus({ type: "success", message: fm.uploadSuccess });
          setTimeout(() => setDropStatus(null), 3000);
          return;
        }
      } catch {}
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      let targetDir = targetItem.path;
      if (!targetItem.isDirectory) {
        const parts = targetItem.path.split("/").filter(Boolean);
        parts.pop();
        targetDir = parts.length === 0 ? "/" : `/${parts.join("/")}`;
      }
      const filesList = Array.from(e.dataTransfer.files);
      setDropStatus({
        type: "loading",
        message: `${fm.uploading} (${filesList.length})`,
      });
      setIsLoading(true);

      let anyError = false;
      let successCount = 0;
      for (const file of filesList) {
        try {
          const res = await uploadContainerFile(containerId, targetDir, file);
          if (res.ok) successCount++;
          else anyError = true;
        } catch {
          anyError = true;
        }
      }

      await loadFiles(currentPath);
      setIsLoading(false);

      if (anyError && successCount === 0) {
        setDropStatus({ type: "error", message: fm.uploadFailed });
      } else if (anyError) {
        setDropStatus({
          type: "error",
          message: `${fm.uploadSuccess} (${successCount}/${filesList.length}) - ${fm.uploadFailed}`,
        });
      } else {
        setDropStatus({ type: "success", message: fm.uploadSuccess });
      }

      setTimeout(() => setDropStatus(null), 4000);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    setDropTarget(null);

    const internalData = e.dataTransfer.getData("application/json");
    if (internalData) {
      try {
        const parsed = JSON.parse(internalData);
        if (parsed.type === "container-files" && Array.isArray(parsed.paths)) {
          const sourcePaths: string[] = parsed.paths;
          const targetDir = currentPathRef.current;

          setIsLoading(true);
          const existingNames = new Set(files.map((f) => f.name));
          const movedItems: { from: string; to: string }[] = [];

          for (const srcPath of sourcePaths) {
            const fileName = srcPath.split("/").filter(Boolean).pop() || "file";
            let destName = fileName;
            if (existingNames.has(fileName)) {
              destName = getUniqueDuplicateName(fileName, existingNames);
            }
            existingNames.add(destName);
            const targetDest =
              targetDir === "/" ? `/${destName}` : `${targetDir}/${destName}`;
            if (srcPath !== targetDest) {
              await renameContainerFile(containerId, srcPath, targetDest);
              movedItems.push({ from: srcPath, to: targetDest });
            }
          }

          if (movedItems.length > 0) {
            lastOperationRef.current = { type: "move", items: movedItems };
          }

          await loadFiles(targetDir);
          setIsLoading(false);
          setDropStatus({ type: "success", message: fm.uploadSuccess });
          setTimeout(() => setDropStatus(null), 3000);
          return;
        }
      } catch {}
    }

    if (Date.now() - lastProcessedPathsRef.current.timestamp < 1500) {
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesList = Array.from(e.dataTransfer.files);
      const targetDir = currentPathRef.current;
      setDropStatus({
        type: "loading",
        message: `${fm.uploading} (${filesList.length})`,
      });
      setIsLoading(true);

      let anyError = false;
      let successCount = 0;
      for (const file of filesList) {
        try {
          const res = await uploadContainerFile(containerId, targetDir, file);
          if (res.ok) {
            successCount++;
          } else {
            anyError = true;
          }
        } catch {
          anyError = true;
        }
      }

      await loadFiles(targetDir);
      setIsLoading(false);

      if (anyError && successCount === 0) {
        setDropStatus({ type: "error", message: fm.uploadFailed });
      } else if (anyError) {
        setDropStatus({
          type: "error",
          message: `${fm.uploadSuccess} (${successCount}/${filesList.length}) - ${fm.uploadFailed}`,
        });
      } else {
        setDropStatus({ type: "success", message: fm.uploadSuccess });
      }

      setTimeout(() => {
        setDropStatus(null);
      }, 4000);
    }
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const filesList = Array.from(selectedFiles);
      const targetDir = currentPathRef.current;
      setDropStatus({
        type: "loading",
        message: `${fm.uploading} (${filesList.length})`,
      });
      setIsLoading(true);

      let anyError = false;
      let successCount = 0;
      try {
        for (const file of filesList) {
          try {
            const res = await uploadContainerFile(containerId, targetDir, file);
            if (res.ok) {
              successCount++;
            } else {
              anyError = true;
            }
          } catch {
            anyError = true;
          }
        }
        await loadFiles(targetDir);
        if (anyError && successCount === 0) {
          setDropStatus({ type: "error", message: fm.uploadFailed });
        } else if (anyError) {
          setDropStatus({
            type: "error",
            message: `${fm.uploadSuccess} (${successCount}/${filesList.length}) - ${fm.uploadFailed}`,
          });
        } else {
          setDropStatus({ type: "success", message: fm.uploadSuccess });
        }
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => {
          setDropStatus(null);
        }, 4000);
      }
    }
  };

  const handleSaveAndClose = async () => {
    if (!viewerModal) return;
    setViewerModal((prev) => (prev ? { ...prev, isSaving: true } : null));
    await saveContainerFile(
      containerId,
      viewerModal.item.path,
      viewerModal.content,
    );
    setViewerModal(null);
    await loadFiles(currentPath);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        viewerModal ||
        renameModal ||
        newFolderModal ||
        newFileModal ||
        deleteModal
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (cmdKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
      } else if (cmdKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleCut();
      } else if (cmdKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePaste();
      } else if (cmdKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedPaths(new Set(files.map((f) => f.path)));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedPaths.size > 0) {
          e.preventDefault();
          const itemsToDelete = files.filter((f) => selectedPaths.has(f.path));
          if (itemsToDelete.length > 0) {
            setDeleteModal({ items: itemsToDelete });
          }
        }
      } else if (e.key === "Enter") {
        if (selectedPaths.size === 1) {
          const selectedPath = Array.from(selectedPaths)[0];
          const item = files.find((f) => f.path === selectedPath);
          if (item) {
            e.preventDefault();
            handleItemDoubleClickRef.current?.(item);
          }
        }
      } else if (e.key === "Escape") {
        setSelectedPaths(new Set());
        setContextMenu(null);
        shiftAnchorIndexRef.current = -1;
        lastClickedIndexRef.current = -1;
        cursorIndexRef.current = -1;
      } else if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        if (sortedFiles.length === 0) return;

        const currentIdx =
          cursorIndexRef.current >= 0
            ? cursorIndexRef.current
            : selectedPaths.size > 0
              ? sortedFiles.findIndex((f) => selectedPaths.has(f.path))
              : -1;

        let cols = 1;
        if (viewMode === "grid" && gridContainerRef.current) {
          const containerWidth = gridContainerRef.current.clientWidth;
          const itemEls = gridContainerRef.current.children;
          if (itemEls.length > 1) {
            const firstTop = (itemEls[0] as HTMLElement).offsetTop;
            let count = 0;
            for (let i = 0; i < itemEls.length; i++) {
              if ((itemEls[i] as HTMLElement).offsetTop === firstTop) count++;
              else break;
            }
            if (count > 0) cols = count;
          } else {
            cols = Math.max(1, Math.floor(containerWidth / 92));
          }
        }

        let nextIdx: number;
        if (currentIdx === -1) {
          nextIdx = 0;
        } else if (e.key === "ArrowRight") {
          nextIdx = Math.min(sortedFiles.length - 1, currentIdx + 1);
        } else if (e.key === "ArrowLeft") {
          nextIdx = Math.max(0, currentIdx - 1);
        } else if (e.key === "ArrowDown") {
          nextIdx = Math.min(sortedFiles.length - 1, currentIdx + cols);
        } else {
          nextIdx = Math.max(0, currentIdx - cols);
        }

        cursorIndexRef.current = nextIdx;

        if (e.shiftKey) {
          if (shiftAnchorIndexRef.current < 0) {
            shiftAnchorIndexRef.current = currentIdx >= 0 ? currentIdx : 0;
          }
          const anchor = shiftAnchorIndexRef.current;
          const start = Math.min(anchor, nextIdx);
          const end = Math.max(anchor, nextIdx);
          const rangePaths = sortedFiles
            .slice(start, end + 1)
            .map((f) => f.path);
          setSelectedPaths(new Set(rangePaths));
        } else {
          shiftAnchorIndexRef.current = nextIdx;
          setSelectedPaths(new Set([sortedFiles[nextIdx].path]));
          lastClickedIndexRef.current = nextIdx;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    files,
    sortedFiles,
    selectedPaths,
    viewMode,
    clipboard,
    currentPath,
    handleCopy,
    handleCut,
    handlePaste,
    handleUndo,
    viewerModal,
    renameModal,
    newFolderModal,
    newFileModal,
    deleteModal,
  ]);

  return {
    currentPath,
    defaultPath,
    history,
    historyIdx,
    files,
    sortedFiles,
    isLoading,
    viewMode,
    sortField,
    sortAsc,
    searchQuery,
    selectedPaths,
    isEditingPath,
    pathInput,
    isDraggingOver,
    dropStatus,
    dropTarget,
    clipboard,
    contextMenu,
    viewerModal,
    renameModal,
    newFolderModal,
    newFileModal,
    deleteModal,
    isDeleting,
    fileInputRef,
    containerRef,
    scrollContainerRef,
    gridContainerRef,
    contextMenuRef,
    isDraggingInternalRef,
    loadFiles,
    navigateTo,
    handleBack,
    handleForward,
    handleUp,
    handleRefresh,
    handleItemDoubleClick,
    handleSelect,
    handleContextMenu,
    handleCopy,
    handleCut,
    handlePaste,
    handleFileDragStart,
    handleFileDragEnd,
    handleItemDragOver,
    handleItemDragLeave,
    handleItemDrop,
    handleDrop,
    handleFileInputChange,
    handleSaveAndClose,
    setIsEditingPath,
    setPathInput,
    setSearchQuery,
    setViewMode,
    setSortField,
    setSortAsc,
    setSelectedPaths,
    setContextMenu,
    setDropStatus,
    setViewerModal,
    setRenameModal,
    setNewFolderModal,
    setNewFileModal,
    setDeleteModal,
    setIsDeleting,
  };
}
