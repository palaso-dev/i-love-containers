import { ContainerFileItem, ContainerFileListResponse } from "@/types";
import { getErrorMessage } from "@/lib/utils";
import { normalizePath, getParentPath } from "../utils";
import { apiFetch, getApiUrl } from "./client";
import { mockFilesystem } from "./mockFilesystem";

export async function fetchContainerFiles(
  containerId: string,
  dirPath?: string,
): Promise<ContainerFileListResponse> {
  const hasExplicitPath = Boolean(dirPath && dirPath.trim());
  const normalized = hasExplicitPath ? normalizePath(dirPath!) : "";
  const query = normalized ? `?path=${encodeURIComponent(normalized)}` : "";
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files${query}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.entries)) {
        return data;
      }
    }
  } catch {}

  const fallbackPath = normalized || "/";
  const nodes = mockFilesystem[fallbackPath] || [];
  const entries: ContainerFileItem[] = nodes.map((n) => ({
    name: n.name,
    path: fallbackPath === "/" ? `/${n.name}` : `${fallbackPath}/${n.name}`,
    isDirectory: n.isDirectory,
    isSymlink: false,
    size: n.size,
    mtime: n.mtime,
    permissions: n.permissions,
    owner: "root",
    group: "root",
  }));

  return {
    currentPath: fallbackPath,
    parentPath: getParentPath(fallbackPath),
    entries,
    defaultWorkingDir: fallbackPath,
  };
}

export async function fetchFileContent(
  containerId: string,
  filePath: string,
): Promise<{ isBinary: boolean; size: number; content: string }> {
  try {
    const res = await apiFetch(
      `/api/containers/${containerId}/files/content?path=${encodeURIComponent(filePath)}`,
    );
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  const norm = normalizePath(filePath);
  const parent = getParentPath(norm) || "/";
  const fileName = norm.split("/").filter(Boolean).pop() || "";
  const found = (mockFilesystem[parent] || []).find((f) => f.name === fileName);
  if (found) {
    return {
      isBinary: false,
      size: found.size,
      content: found.content || "",
    };
  }

  return { isBinary: false, size: 0, content: "" };
}

export async function downloadContainerFile(
  containerId: string,
  filePath: string,
  filename?: string,
): Promise<void> {
  const name =
    filename || filePath.split("/").filter(Boolean).pop() || "download";
  try {
    const url = `/api/containers/${containerId}/files/content?path=${encodeURIComponent(filePath)}&download=true`;
    const fullUrl = getApiUrl(url);
    const a = document.createElement("a");
    a.href = fullUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    const res = await fetchFileContent(containerId, filePath);
    const blob = new Blob([res.content], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export async function saveContainerFile(
  containerId: string,
  filePath: string,
  content: string,
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const norm = normalizePath(filePath);
  const parent = getParentPath(norm) || "/";
  const fileName = norm.split("/").filter(Boolean).pop() || "";
  const list = mockFilesystem[parent];
  if (list) {
    const item = list.find((f) => f.name === fileName);
    if (item) {
      item.content = content;
      item.size = content.length;
      return { ok: true };
    }
  }
  return { ok: true };
}

export async function createContainerFolder(
  containerId: string,
  folderPath: string,
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/mkdir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: folderPath }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const norm = normalizePath(folderPath);
  const parent = getParentPath(norm) || "/";
  const folderName = norm.split("/").filter(Boolean).pop() || "";
  if (!mockFilesystem[parent]) mockFilesystem[parent] = [];
  mockFilesystem[parent].push({
    name: folderName,
    isDirectory: true,
    size: 4096,
    mtime: "Just now",
    permissions: "drwxr-xr-x",
  });
  mockFilesystem[norm] = [];
  return { ok: true };
}

export async function createContainerFile(
  containerId: string,
  filePath: string,
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/touch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const norm = normalizePath(filePath);
  const parent = getParentPath(norm) || "/";
  const fileName = norm.split("/").filter(Boolean).pop() || "";
  if (!mockFilesystem[parent]) mockFilesystem[parent] = [];
  mockFilesystem[parent].push({
    name: fileName,
    isDirectory: false,
    size: 0,
    mtime: "Just now",
    permissions: "-rw-r--r--",
    content: "",
  });
  return { ok: true };
}

export async function renameContainerFile(
  containerId: string,
  oldPath: string,
  newPath: string,
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPath, newPath }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const oldNorm = normalizePath(oldPath);
  const newNorm = normalizePath(newPath);
  const parent = getParentPath(oldNorm) || "/";
  const oldName = oldNorm.split("/").filter(Boolean).pop() || "";
  const newName = newNorm.split("/").filter(Boolean).pop() || "";
  const list = mockFilesystem[parent];
  if (list) {
    const item = list.find((f) => f.name === oldName);
    if (item) item.name = newName;
  }
  return { ok: true };
}

export async function deleteContainerFiles(
  containerId: string,
  paths: string[],
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    if (res.ok) return await res.json();
  } catch {}

  for (const p of paths) {
    const norm = normalizePath(p);
    const parent = getParentPath(norm) || "/";
    const name = norm.split("/").filter(Boolean).pop() || "";
    if (mockFilesystem[parent]) {
      mockFilesystem[parent] = mockFilesystem[parent].filter(
        (f) => f.name !== name,
      );
    }
    delete mockFilesystem[norm];
  }
  return { ok: true };
}

export async function copyContainerFile(
  containerId: string,
  sourcePath: string,
  targetPath: string,
): Promise<{ ok: boolean }> {
  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePath, targetPath }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const srcNorm = normalizePath(sourcePath);
  const srcParent = getParentPath(srcNorm) || "/";
  const srcName = srcNorm.split("/").filter(Boolean).pop() || "";
  const srcItem = (mockFilesystem[srcParent] || []).find(
    (f) => f.name === srcName,
  );

  const tgtNorm = normalizePath(targetPath);
  const tgtParent = getParentPath(tgtNorm) || "/";
  const tgtName = tgtNorm.split("/").filter(Boolean).pop() || "";

  if (srcItem) {
    if (!mockFilesystem[tgtParent]) mockFilesystem[tgtParent] = [];
    mockFilesystem[tgtParent].push({
      ...srcItem,
      name: tgtName,
    });
    if (srcItem.isDirectory && mockFilesystem[srcNorm]) {
      mockFilesystem[tgtNorm] = JSON.parse(
        JSON.stringify(mockFilesystem[srcNorm]),
      );
    }
  }
  return { ok: true };
}

export async function uploadContainerFile(
  containerId: string,
  dirPath: string,
  file: File,
): Promise<{ ok: boolean }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.split(",")[1] || "";
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const res = await apiFetch(`/api/containers/${containerId}/files/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dirPath, filename: file.name, base64 }),
    });
    if (res.ok) return await res.json();
  } catch {}

  const norm = normalizePath(dirPath);
  if (!mockFilesystem[norm]) mockFilesystem[norm] = [];
  mockFilesystem[norm].push({
    name: file.name,
    isDirectory: false,
    size: file.size,
    mtime: "Just now",
    permissions: "-rw-r--r--",
    content: "",
  });
  return { ok: true };
}

export async function copyHostFileToContainer(
  containerId: string,
  destDir: string,
  hostPath: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("copy_host_file_to_container", {
      containerId,
      destDir,
      hostPath,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) || String(err) };
  }
}
