import {
  ContainerEngineInfo,
  EngineType,
  SystemOverview,
  SystemDiskUsage,
  PruneOptions,
  PruneResult,
} from "@/types";

interface NativeEngineInfo {
  id: string;
  name: string;
  socket_path: string;
  app_path?: string;
  status: ContainerEngineInfo["status"];
  is_default: boolean;
}

import { DEFAULT_ENGINES, DEFAULT_OVERVIEW } from "../engines";
import { apiFetch } from "./client";

let localEngines: ContainerEngineInfo[] = [...DEFAULT_ENGINES];
let localActiveEngine: ContainerEngineInfo | null = DEFAULT_ENGINES[0] || null;

export function getLocalEngines(): ContainerEngineInfo[] {
  return localEngines;
}

export function getLocalActiveEngine(): ContainerEngineInfo | null {
  return localActiveEngine;
}

export async function fetchDetectedEngines(): Promise<{
  engines: ContainerEngineInfo[];
  activeEngine: ContainerEngineInfo | null;
}> {
  try {
    const response = await apiFetch("/api/engines");
    if (response.ok) {
      const data = await response.json();
      if (data.engines) {
        localEngines = data.engines;
        localActiveEngine =
          data.activeEngine ||
          localEngines.find((e) => e.isActive) ||
          localEngines[0];
        return data;
      }
    }
  } catch {}

  if (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  ) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const nativeEngines =
        await invoke<NativeEngineInfo[]>("detect_container_engines");
      if (Array.isArray(nativeEngines) && nativeEngines.length > 0) {
        localEngines = nativeEngines.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.id as EngineType,
          socketPath: e.socket_path,
          appPath: e.app_path,
          status: e.status,
          isDefault: e.is_default,
          isActive: e.id === (localActiveEngine?.id || "docker-desktop"),
        }));
        localActiveEngine =
          localEngines.find((e) => e.isActive) || localEngines[0];
        return {
          engines: localEngines,
          activeEngine: localActiveEngine,
        };
      }
    } catch {}
  }

  return {
    engines: localEngines,
    activeEngine: localActiveEngine,
  };
}

export async function selectContainerEngine(engineId: string): Promise<{
  engines: ContainerEngineInfo[];
  activeEngine: ContainerEngineInfo | null;
}> {
  try {
    const response = await apiFetch("/api/engines/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engineId }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.engines) {
        localEngines = data.engines;
        localActiveEngine = data.activeEngine;
        return data;
      }
    }
  } catch {}

  localEngines = localEngines.map((e) => ({
    ...e,
    isActive: e.id === engineId,
  }));
  localActiveEngine = localEngines.find((e) => e.id === engineId) || null;

  return {
    engines: localEngines,
    activeEngine: localActiveEngine,
  };
}

export async function rescanContainerEngines(): Promise<{
  engines: ContainerEngineInfo[];
  activeEngine: ContainerEngineInfo | null;
}> {
  try {
    const response = await apiFetch("/api/engines/rescan");
    if (response.ok) {
      const data = await response.json();
      if (data.engines) {
        localEngines = data.engines;
        localActiveEngine = data.activeEngine;
        return data;
      }
    }
  } catch {}

  return {
    engines: localEngines,
    activeEngine: localActiveEngine,
  };
}

export async function fetchSystemOverview(): Promise<SystemOverview> {
  try {
    const response = await apiFetch("/api/overview");
    if (response.ok) {
      const data = await response.json();
      if (data.detectedEngines) {
        localEngines = data.detectedEngines;
      }
      if (data.activeEngine) {
        localActiveEngine = data.activeEngine;
      }
      return data;
    }
  } catch {}

  return {
    ...DEFAULT_OVERVIEW,
    activeEngine: localActiveEngine || DEFAULT_ENGINES[0],
    detectedEngines: localEngines,
  };
}

export async function fetchSystemDiskUsage(): Promise<SystemDiskUsage | null> {
  try {
    const response = await apiFetch("/api/system/df");
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return null;
}

export async function executeSystemPrune(
  options: PruneOptions,
): Promise<PruneResult> {
  try {
    const response = await apiFetch("/api/system/prune", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return { ok: false, spaceReclaimed: 0 };
}

