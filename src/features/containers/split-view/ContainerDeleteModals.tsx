import React from "react";
import { Translations } from "@/lib/i18n";
import { X, RotateCw } from "lucide-react";
import { ContainerDetail, ComposeProject } from "@/types";

interface ContainerDeleteModalsProps {
  t: Translations;
  containerToDelete: ContainerDetail | null;
  stackToDelete: { name: string; containers: ContainerDetail[] } | null;
  bulkToDelete: string[] | null;
  isActionInProgress: boolean;
  isBulkOperating: boolean;
  containers: ContainerDetail[];
  composeProjects: ComposeProject[];
  setContainerToDelete: (c: ContainerDetail | null) => void;
  setStackToDelete: (
    s: { name: string; containers: ContainerDetail[] } | null,
  ) => void;
  setBulkToDelete: (b: string[] | null) => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setHiddenStacks: React.Dispatch<React.SetStateAction<Set<string>>>;
  removeContainer: (id: string) => Promise<void>;
  removeComposeProject: (
    projectName: string,
    workingDir?: string,
    configFile?: string,
  ) => Promise<void>;
  refreshData: () => Promise<void>;
}

export const ContainerDeleteModals: React.FC<ContainerDeleteModalsProps> = ({
  t,
  containerToDelete,
  stackToDelete,
  bulkToDelete,
  isActionInProgress,
  isBulkOperating,
  containers,
  composeProjects,
  setContainerToDelete,
  setStackToDelete,
  setBulkToDelete,
  setSelectedIds,
  setHiddenStacks,
  removeContainer,
  removeComposeProject,
  refreshData,
}) => {
  return (
    <>
      {containerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setContainerToDelete(null)}
          />
          <div
            className="relative z-10 bg-popover text-foreground border border-popover-border rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {t.containers.removeConfirmTitle}
              </h3>
              <button
                type="button"
                onClick={() => setContainerToDelete(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              {t.containers.removeConfirmDesc}{" "}
              <span className="font-mono text-status-danger font-medium">
                {containerToDelete.name}
              </span>
              ? {t.containers.cannotBeUndone}
            </p>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setContainerToDelete(null)}
                className="px-3 py-1 rounded-md text-xs font-medium text-foreground bg-surface border border-border/80 hover:bg-surface-secondary transition-colors shadow-xs cursor-pointer"
              >
                {t.containers.cancel}
              </button>
              <button
                type="button"
                disabled={isActionInProgress}
                onClick={async () => {
                  await removeContainer(containerToDelete.id);
                  setContainerToDelete(null);
                }}
                className="px-3 py-1 rounded-md text-xs font-medium bg-status-danger hover:bg-status-danger/90 text-white shadow-xs transition-opacity cursor-pointer flex items-center space-x-1.5"
              >
                {isActionInProgress && (
                  <RotateCw className="w-3 h-3 animate-spin" />
                )}
                <span>{t.containers.remove}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {stackToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setStackToDelete(null)}
          />
          <div
            className="relative z-10 bg-popover text-foreground border border-popover-border rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {stackToDelete.containers.length > 0
                  ? t.containers.removeStackContainersTitle ||
                    t.containers.removeStackConfirmTitle
                  : t.containers.removeStackConfirmTitle}
              </h3>
              <button
                type="button"
                onClick={() => setStackToDelete(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              {stackToDelete.containers.length > 0 ? (
                <>
                  {t.containers.removeStackContainersDesc ||
                    t.containers.removeConfirmDesc}{" "}
                  <span className="font-mono text-status-danger font-medium">
                    {stackToDelete.name}
                  </span>{" "}
                  ({stackToDelete.containers.length} {t.containers.active})?{" "}
                  {t.containers.removeStackContainersNote}
                </>
              ) : (
                <>
                  {t.containers.removeStackConfirmDesc}{" "}
                  <span className="font-mono text-status-danger font-medium">
                    {stackToDelete.name}
                  </span>
                  ? {t.containers.cannotBeUndone}
                </>
              )}
            </p>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStackToDelete(null)}
                className="px-3 py-1 rounded-md text-xs font-medium text-foreground bg-surface border border-border/80 hover:bg-surface-secondary transition-colors shadow-xs cursor-pointer"
              >
                {t.containers.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const stackNameLower = stackToDelete.name.toLowerCase();
                  const proj = composeProjects.find(
                    (p) => p.name.toLowerCase() === stackNameLower,
                  );

                  if (stackToDelete.containers.length > 0) {
                    setHiddenStacks((prev) => {
                      if (prev.has(stackNameLower)) {
                        const next = new Set(prev);
                        next.delete(stackNameLower);
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
                    await removeComposeProject(
                      stackToDelete.name,
                      proj?.workingDir,
                      proj?.configFile,
                    );
                  } else {
                    setHiddenStacks((prev) => {
                      const next = new Set(prev);
                      next.add(stackNameLower);
                      try {
                        localStorage.setItem(
                          "ilc_hidden_container_stacks",
                          JSON.stringify(Array.from(next)),
                        );
                      } catch {}
                      return next;
                    });
                  }
                  setStackToDelete(null);
                  await refreshData();
                }}
                className="px-3 py-1 rounded-md text-xs font-medium bg-status-danger hover:bg-status-danger/90 text-white shadow-xs transition-opacity cursor-pointer flex items-center space-x-1.5"
              >
                {isActionInProgress && (
                  <RotateCw className="w-3 h-3 animate-spin" />
                )}
                <span>{t.containers.remove}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setBulkToDelete(null)}
          />
          <div
            className="relative z-10 bg-popover text-foreground border border-popover-border rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {t.containers.removeBulkConfirmTitle ||
                  t.containers.removeConfirmTitle}
              </h3>
              <button
                type="button"
                onClick={() => setBulkToDelete(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              {t.containers.removeBulkConfirmDesc ||
                "¿Deseas eliminar permanentemente los contenedores seleccionados?"}{" "}
              {t.containers.cannotBeUndone}
            </p>
            <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-surface/50 rounded-lg border border-border/50 text-2xs font-mono">
              {bulkToDelete.map((id) => {
                const c = containers.find((item) => item.id === id);
                return (
                  <div
                    key={id}
                    className="text-muted-foreground truncate flex items-center space-x-1.5"
                  >
                    <span className="text-status-danger">•</span>
                    <span className="text-foreground font-medium">
                      {c?.name || id.slice(0, 12)}
                    </span>
                    {c?.composeProject && (
                      <span className="text-muted-foreground/60 text-[10px]">
                        ({c.composeProject})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBulkToDelete(null)}
                className="px-3 py-1 rounded-md text-xs font-medium text-foreground bg-surface border border-border/80 hover:bg-surface-secondary transition-colors shadow-xs cursor-pointer"
              >
                {t.containers.cancel}
              </button>
              <button
                type="button"
                disabled={isBulkOperating}
                onClick={async () => {
                  for (const id of bulkToDelete) {
                    await removeContainer(id);
                  }
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    bulkToDelete.forEach((id) => next.delete(id));
                    return next;
                  });
                  setBulkToDelete(null);
                }}
                className="px-3 py-1 rounded-md text-xs font-medium bg-status-danger hover:bg-status-danger/90 text-white shadow-xs transition-opacity cursor-pointer flex items-center space-x-1.5"
              >
                {isBulkOperating && (
                  <RotateCw className="w-3 h-3 animate-spin" />
                )}
                <span>{t.containers.remove}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
