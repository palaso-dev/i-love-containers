import { useState, useRef, useEffect } from "react";
import {
  ComposeTopology,
  ComposeServiceNode,
  ComposeVolumeNode,
} from "@/lib/composeParser";

interface UseCanvasInteractionOptions {
  topology: ComposeTopology;
  projectName: string;
  onSelectService: (serviceId: string) => void;
}

export function useCanvasInteraction({
  topology,
  projectName,
  onSelectService,
}: UseCanvasInteractionOptions) {
  const [view, setView] = useState<{ x: number; y: number; zoom: number }>(
    () => {
      try {
        const raw = localStorage.getItem(`ilc-compose-layout-${projectName}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            parsed?.view &&
            typeof parsed.view.x === "number" &&
            typeof parsed.view.y === "number" &&
            typeof parsed.view.zoom === "number"
          ) {
            return parsed.view;
          }
        }
      } catch {}
      return { x: 0, y: 0, zoom: 1 };
    },
  );

  const [nodePositions, setNodePositions] = useState<
    Record<string, { x: number; y: number }>
  >(() => {
    try {
      const raw = localStorage.getItem(`ilc-compose-layout-${projectName}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed?.nodePositions &&
          typeof parsed.nodePositions === "object" &&
          parsed.nodePositions !== null
        ) {
          return parsed.nodePositions;
        }
      }
    } catch {}
    return {};
  });

  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  const nodePositionsRef = useRef(nodePositions);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const touchStateRef = useRef<{
    dist: number;
    center: { x: number; y: number };
  } | null>(null);
  const autoPanFrameRef = useRef<number | null>(null);
  const lastClientMousePosRef = useRef<{
    clientX: number;
    clientY: number;
  } | null>(null);
  const wheelSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const initializedProjectRef = useRef<string | null>(null);

  const draggingNodeRef = useRef<{
    id: string;
    type: "service" | "volume";
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
    hasMoved: boolean;
  } | null>(null);

  const saveLayoutRef = useRef<typeof saveLayout | null>(null);
  const loadOrInitLayoutRef = useRef<typeof loadOrInitLayout | null>(null);
  const saveLayout = (
    positions: Record<string, { x: number; y: number }>,
    currentView: { x: number; y: number; zoom: number },
  ) => {
    try {
      localStorage.setItem(
        `ilc-compose-layout-${projectName}`,
        JSON.stringify({
          nodePositions: positions,
          view: currentView,
        }),
      );
    } catch {}
  };

  const updateView = (nextView: { x: number; y: number; zoom: number }) => {
    viewRef.current = nextView;
    setView(nextView);
  };

  const getServicePos = (svc: ComposeServiceNode) => {
    return nodePositions[svc.id] || { x: svc.x, y: svc.y };
  };

  const getVolumePos = (vol: ComposeVolumeNode) => {
    return nodePositions[vol.id] || { x: vol.x, y: vol.y };
  };

  const handleResetView = () => {
    setNodePositions({});
    nodePositionsRef.current = {};
    try {
      localStorage.removeItem(`ilc-compose-layout-${projectName}`);
    } catch {}
    handleFitView({});
  };

  const handleFitView = (overridePositions?: Record<string, { x: number; y: number }>) => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    const positionsToUse = overridePositions !== undefined ? overridePositions : nodePositionsRef.current;

    const allPositions: { x1: number; y1: number; x2: number; y2: number }[] = [
      ...topology.services.map((s) => {
        const p = positionsToUse[s.id] || { x: s.x, y: s.y };
        return { x1: p.x, y1: p.y, x2: p.x + s.width, y2: p.y + s.height };
      }),
      ...topology.volumes.map((v) => {
        const p = positionsToUse[v.id] || { x: v.x, y: v.y };
        return { x1: p.x, y1: p.y, x2: p.x + 140, y2: p.y + 44 };
      }),
    ];

    topology.networks.forEach((net, netIdx) => {
      const memberServices = net.services
        .map((sId) => topology.services.find((s) => s.id === sId))
        .filter((s): s is ComposeServiceNode => !!s);
      if (memberServices.length === 0) return;

      const netPositions = memberServices.map((s) => {
        const p = positionsToUse[s.id] || { x: s.x, y: s.y };
        return { x: p.x, y: p.y, width: s.width, height: s.height };
      });
      const extraPad = netIdx * 8;
      const padX = 24 + extraPad;
      const padTop = 34 + extraPad;
      const padBottom = 22 + extraPad;

      const minNetX = Math.min(...netPositions.map((p) => p.x)) - padX;
      const maxNetX = Math.max(...netPositions.map((p) => p.x + p.width)) + padX;
      const minNetY = Math.min(...netPositions.map((p) => p.y)) - padTop;
      const maxNetY = Math.max(...netPositions.map((p) => p.y + p.height)) + padBottom;

      allPositions.push({ x1: minNetX, y1: minNetY, x2: maxNetX, y2: maxNetY });
    });

    if (allPositions.length === 0) {
      return;
    }

    const minX = Math.min(...allPositions.map((p) => p.x1));
    const maxX = Math.max(...allPositions.map((p) => p.x2));
    const minY = Math.min(...allPositions.map((p) => p.y1));
    const maxY = Math.max(...allPositions.map((p) => p.y2));

    const contentWidth = Math.max(300, maxX - minX);
    const contentHeight = Math.max(200, maxY - minY);

    const padX = 72;
    const padTop = 76;
    const padBottom = 48;

    const scaleX = (clientWidth - padX * 2) / contentWidth;
    const scaleY = (clientHeight - padTop - padBottom) / contentHeight;
    const fitZoom = Math.min(1, Math.max(0.35, Math.min(scaleX, scaleY)));

    const initialX = Math.round(
      (clientWidth - contentWidth * fitZoom) / 2 - minX * fitZoom,
    );
    const initialY = Math.round(
      padTop +
        Math.max(
          0,
          (clientHeight - padTop - padBottom - contentHeight * fitZoom) / 2,
        ) -
        minY * fitZoom,
    );

    const nextView = { x: initialX, y: initialY, zoom: fitZoom };
    updateView(nextView);
    saveLayout(positionsToUse, nextView);
  };

  const loadOrInitLayout = () => {
    try {
      const raw = localStorage.getItem(`ilc-compose-layout-${projectName}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed?.nodePositions &&
          typeof parsed.nodePositions === "object" &&
          parsed.nodePositions !== null
        ) {
          nodePositionsRef.current = parsed.nodePositions;
          setNodePositions(parsed.nodePositions);
          if (
            parsed.view &&
            typeof parsed.view.x === "number" &&
            typeof parsed.view.y === "number" &&
            typeof parsed.view.zoom === "number"
          ) {
            updateView(parsed.view);
            return;
          } else {
            handleFitView();
            return;
          }
        }
      }
    } catch {}

    handleResetView();
  };

  saveLayoutRef.current = saveLayout;
  loadOrInitLayoutRef.current = loadOrInitLayout;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          if (initializedProjectRef.current !== projectName) {
            initializedProjectRef.current = projectName;
            loadOrInitLayoutRef.current?.();
          }
        }
      }
    });

    ro.observe(container);

    return () => {
      ro.disconnect();
    };
  }, [projectName, topology.canvasWidth, topology.canvasHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      let mouseX = e.clientX - rect.left;
      let mouseY = e.clientY - rect.top;

      if (
        mousePosRef.current &&
        (isNaN(mouseX) || (mouseX === 0 && mouseY === 0))
      ) {
        mouseX = mousePosRef.current.x;
        mouseY = mousePosRef.current.y;
      }

      if (e.ctrlKey || e.metaKey) {
        const zoomDelta = -e.deltaY * 0.003;
        const zoomFactor = Math.min(Math.max(Math.exp(zoomDelta), 0.9), 1.1);

        const { x, y, zoom } = viewRef.current;
        const nextZoom = Math.min(Math.max(0.35, zoom * zoomFactor), 2.5);

        const worldX = (mouseX - x) / zoom;
        const worldY = (mouseY - y) / zoom;

        const nextX = mouseX - worldX * nextZoom;
        const nextY = mouseY - worldY * nextZoom;

        const nextView = { x: nextX, y: nextY, zoom: nextZoom };
        updateView(nextView);
        if (wheelSaveTimeoutRef.current) {
          clearTimeout(wheelSaveTimeoutRef.current);
        }
        wheelSaveTimeoutRef.current = setTimeout(() => {
          saveLayoutRef.current?.(nodePositionsRef.current, nextView);
        }, 300);
      } else {
        const { x, y, zoom } = viewRef.current;
        const nextView = {
          x: x - e.deltaX,
          y: y - e.deltaY,
          zoom,
        };
        updateView(nextView);
        if (wheelSaveTimeoutRef.current) {
          clearTimeout(wheelSaveTimeoutRef.current);
        }
        wheelSaveTimeoutRef.current = setTimeout(() => {
          saveLayoutRef.current?.(nodePositionsRef.current, nextView);
        }, 300);
      }
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("wheel", onWheel);
    };
  }, []);

  const handleNodeMouseDown = (
    e: React.MouseEvent,
    id: string,
    type: "service" | "volume",
    pos: { x: number; y: number },
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    draggingNodeRef.current = {
      id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      nodeStartX: pos.x,
      nodeStartY: pos.y,
      hasMoved: false,
    };
    lastClientMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".canvas-interactive")) {
      return;
    }
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - viewRef.current.x,
      y: e.clientY - viewRef.current.y,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const checkAutoPan = () => {
      if (
        !draggingNodeRef.current ||
        !draggingNodeRef.current.hasMoved ||
        !containerRef.current ||
        !lastClientMousePosRef.current
      ) {
        if (autoPanFrameRef.current) {
          cancelAnimationFrame(autoPanFrameRef.current);
          autoPanFrameRef.current = null;
        }
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = lastClientMousePosRef.current.clientX - rect.left;
      const mouseY = lastClientMousePosRef.current.clientY - rect.top;
      const threshold = 60;
      let panX = 0;
      let panY = 0;

      if (mouseX < threshold) {
        panX = Math.min(16, Math.max(2, (threshold - mouseX) * 0.35));
      } else if (mouseX > rect.width - threshold) {
        panX = -Math.min(
          16,
          Math.max(2, (mouseX - (rect.width - threshold)) * 0.35),
        );
      }

      if (mouseY < threshold + 40) {
        panY = Math.min(16, Math.max(2, (threshold + 40 - mouseY) * 0.35));
      } else if (mouseY > rect.height - threshold) {
        panY = -Math.min(
          16,
          Math.max(2, (mouseY - (rect.height - threshold)) * 0.35),
        );
      }

      if (panX !== 0 || panY !== 0) {
        const nextView = {
          ...viewRef.current,
          x: viewRef.current.x + panX,
          y: viewRef.current.y + panY,
        };
        viewRef.current = nextView;
        setView(nextView);

        if (draggingNodeRef.current) {
          draggingNodeRef.current.startX += panX;
          draggingNodeRef.current.startY += panY;

          const zoom = nextView.zoom;
          const rawDx =
            (lastClientMousePosRef.current.clientX -
              draggingNodeRef.current.startX) /
            zoom;
          const rawDy =
            (lastClientMousePosRef.current.clientY -
              draggingNodeRef.current.startY) /
            zoom;
          const rawWorldX = draggingNodeRef.current.nodeStartX + rawDx;
          const rawWorldY = draggingNodeRef.current.nodeStartY + rawDy;

          const nodeW = draggingNodeRef.current.type === "service" ? 230 : 150;
          const nodeH = draggingNodeRef.current.type === "service" ? 100 : 44;

          const minScreenX = 40;
          const maxScreenX = Math.max(
            minScreenX,
            rect.width - nodeW * zoom - 40,
          );
          const minScreenY = 64;
          const maxScreenY = Math.max(
            minScreenY,
            rect.height - nodeH * zoom - 40,
          );

          const screenX = nextView.x + rawWorldX * zoom;
          const screenY = nextView.y + rawWorldY * zoom;

          const clampedScreenX = Math.min(
            Math.max(screenX, minScreenX),
            maxScreenX,
          );
          const clampedScreenY = Math.min(
            Math.max(screenY, minScreenY),
            maxScreenY,
          );

          const nextX = Math.round((clampedScreenX - nextView.x) / zoom);
          const nextY = Math.round((clampedScreenY - nextView.y) / zoom);

          nodePositionsRef.current = {
            ...nodePositionsRef.current,
            [draggingNodeRef.current.id]: { x: nextX, y: nextY },
          };
          setNodePositions({ ...nodePositionsRef.current });
        }
      }

      autoPanFrameRef.current = requestAnimationFrame(checkAutoPan);
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggingNodeRef.current) {
        lastClientMousePosRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
        };

        const zoom = viewRef.current.zoom;
        const rawDx = (e.clientX - draggingNodeRef.current.startX) / zoom;
        const rawDy = (e.clientY - draggingNodeRef.current.startY) / zoom;

        if (!draggingNodeRef.current.hasMoved && Math.hypot(rawDx, rawDy) > 3) {
          draggingNodeRef.current.hasMoved = true;
        }

        if (draggingNodeRef.current.hasMoved && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const nodeW = draggingNodeRef.current.type === "service" ? 230 : 150;
          const nodeH = draggingNodeRef.current.type === "service" ? 100 : 44;

          const rawWorldX = draggingNodeRef.current.nodeStartX + rawDx;
          const rawWorldY = draggingNodeRef.current.nodeStartY + rawDy;

          const minScreenX = 40;
          const maxScreenX = Math.max(
            minScreenX,
            rect.width - nodeW * zoom - 40,
          );
          const minScreenY = 64;
          const maxScreenY = Math.max(
            minScreenY,
            rect.height - nodeH * zoom - 40,
          );

          const screenX = viewRef.current.x + rawWorldX * zoom;
          const screenY = viewRef.current.y + rawWorldY * zoom;

          const clampedScreenX = Math.min(
            Math.max(screenX, minScreenX),
            maxScreenX,
          );
          const clampedScreenY = Math.min(
            Math.max(screenY, minScreenY),
            maxScreenY,
          );

          const nextX = Math.round((clampedScreenX - viewRef.current.x) / zoom);
          const nextY = Math.round((clampedScreenY - viewRef.current.y) / zoom);

          nodePositionsRef.current = {
            ...nodePositionsRef.current,
            [draggingNodeRef.current.id]: { x: nextX, y: nextY },
          };
          setNodePositions({ ...nodePositionsRef.current });

          if (!autoPanFrameRef.current) {
            autoPanFrameRef.current = requestAnimationFrame(checkAutoPan);
          }
        }
        return;
      }

      if (!isDraggingRef.current) return;
      updateView({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
        zoom: viewRef.current.zoom,
      });
    };

    const handleGlobalMouseUp = () => {
      if (autoPanFrameRef.current) {
        cancelAnimationFrame(autoPanFrameRef.current);
        autoPanFrameRef.current = null;
      }

      if (draggingNodeRef.current) {
        const wasDrag = draggingNodeRef.current.hasMoved;
        const nodeId = draggingNodeRef.current.id;
        const nodeType = draggingNodeRef.current.type;
        draggingNodeRef.current = null;

        if (wasDrag) {
          saveLayoutRef.current?.(nodePositionsRef.current, viewRef.current);
        } else if (nodeType === "service") {
          onSelectService(nodeId);
        }
        return;
      }

      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        saveLayoutRef.current?.(nodePositionsRef.current, viewRef.current);
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      if (autoPanFrameRef.current) {
        cancelAnimationFrame(autoPanFrameRef.current);
        autoPanFrameRef.current = null;
      }
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [topology, onSelectService]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest(".canvas-interactive")) return;

    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.touches[0].clientX - viewRef.current.x,
        y: e.touches[0].clientY - viewRef.current.y,
      };
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStateRef.current = {
        dist,
        center: {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        },
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      updateView({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y,
        zoom: viewRef.current.zoom,
      });
    } else if (
      e.touches.length === 2 &&
      touchStateRef.current &&
      containerRef.current
    ) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY,
      );
      const rawFactor = newDist / touchStateRef.current.dist;
      const zoomFactor = Math.min(
        Math.max(1 + (rawFactor - 1) * 0.4, 0.92),
        1.08,
      );

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = touchStateRef.current.center.x - rect.left;
      const centerY = touchStateRef.current.center.y - rect.top;

      const { x, y, zoom } = viewRef.current;
      const nextZoom = Math.min(Math.max(0.35, zoom * zoomFactor), 2.5);

      const worldX = (centerX - x) / zoom;
      const worldY = (centerY - y) / zoom;

      updateView({
        x: centerX - worldX * nextZoom,
        y: centerY - worldY * nextZoom,
        zoom: nextZoom,
      });

      touchStateRef.current.dist = newDist;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchStateRef.current = null;
    setIsDragging(false);
    saveLayout(nodePositionsRef.current, viewRef.current);
  };

  const handleZoomStep = (factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const { x, y, zoom } = viewRef.current;
    const nextZoom = Math.min(Math.max(0.35, zoom * factor), 2.5);

    const worldX = (centerX - x) / zoom;
    const worldY = (centerY - y) / zoom;

    const nextView = {
      x: centerX - worldX * nextZoom,
      y: centerY - worldY * nextZoom,
      zoom: nextZoom,
    };
    updateView(nextView);
    saveLayout(nodePositionsRef.current, nextView);
  };

  return {
    view,
    isDragging,
    containerRef,
    getServicePos,
    getVolumePos,
    handleResetView,
    handleFitView,
    handleZoomStep,
    handleMouseDown,
    handleNodeMouseDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
