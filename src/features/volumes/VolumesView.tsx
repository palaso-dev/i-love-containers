import React, { useState, useMemo } from "react";
import { HardDrive, Trash2, Search, ArrowUpDown } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { formatBytes } from "@/lib/utils";
import { DockerVolume } from "@/types";
import { DockerDisconnected } from "@/components/DockerDisconnected";

export const VolumesView: React.FC = () => {
  const { t, volumes, systemOverview, removeVolume } = useAppStore();
  const isConnected = systemOverview?.dockerConnected ?? false;
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "size" | "inUse" | "created">(
    "name",
  );
  const [volumeToDelete, setVolumeToDelete] = useState<DockerVolume | null>(
    null,
  );

  const filteredVolumes = useMemo(() => {
    return volumes
      .filter(
        (volume) =>
          volume.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          volume.driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
          volume.mountpoint.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => {
        if (sortBy === "size") {
          return (
            (b.size || 0) - (a.size || 0) ||
            a.name.localeCompare(b.name, undefined, { numeric: true })
          );
        }
        if (sortBy === "inUse") {
          return (
            (b.inUse ? 1 : 0) - (a.inUse ? 1 : 0) ||
            a.name.localeCompare(b.name, undefined, { numeric: true })
          );
        }
        if (sortBy === "created") {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (
            dateB - dateA ||
            a.name.localeCompare(b.name, undefined, { numeric: true })
          );
        }
        return a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [volumes, searchQuery, sortBy]);

  if (!isConnected) {
    return <DockerDisconnected icon={HardDrive} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-semibold text-foreground tracking-tight">
              {t.volumes.title}
            </h1>
            <span className="text-xs font-mono text-muted-foreground bg-surface-secondary/70 border border-border/60 px-2 py-0.5 rounded-full">
              {volumes.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.volumes.subtitle}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.volumes.search}
              className="pl-8 pr-3 py-1 text-xs bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-40 sm:w-52 transition-all shadow-xs"
            />
          </div>

          <div className="flex items-center space-x-1 bg-surface border border-border/70 rounded-lg px-2 py-1 shadow-xs text-xs text-muted-foreground">
            <ArrowUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "name" | "size" | "inUse" | "created")
              }
              className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer pr-1"
              aria-label={t.volumes.sortBy}
            >
              <option value="name" className="bg-surface text-foreground">
                {t.volumes.sortByName}
              </option>
              <option value="inUse" className="bg-surface text-foreground">
                {t.volumes.sortByInUse}
              </option>
              <option value="size" className="bg-surface text-foreground">
                {t.volumes.sortBySize}
              </option>
              <option value="created" className="bg-surface text-foreground">
                {t.volumes.sortByCreated}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredVolumes.map((volume) => (
          <div
            key={volume.name}
            className="bg-surface/80 backdrop-blur-sm border border-border/70 hover:border-border hover:bg-surface rounded-xl p-4 flex flex-col justify-between transition-all shadow-xs group"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2 truncate">
                  <HardDrive className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-semibold text-foreground font-mono truncate">
                    {volume.name}
                  </span>
                </div>

                <span
                  title={volume.inUse ? undefined : t.volumes.danglingTooltip}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 font-medium ${
                    volume.inUse
                      ? "bg-status-running/10 text-status-running border border-status-running/20"
                      : "bg-surface-secondary/70 text-muted-foreground border border-border/60"
                  }`}
                >
                  {volume.inUse ? t.volumes.inUse : t.volumes.dangling}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-2xs font-mono">
                <div className="text-muted-foreground">
                  {t.volumes.driver}:{" "}
                  <span className="text-foreground">{volume.driver}</span>
                </div>
                <div className="text-muted-foreground truncate">
                  {t.volumes.path}:{" "}
                  <span
                    className="text-foreground truncate"
                    title={volume.mountpoint}
                  >
                    {volume.mountpoint}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {t.volumes.size}:{" "}
                  <span className="text-foreground font-semibold">
                    {typeof volume.size === "number" && volume.size >= 0
                      ? formatBytes(volume.size)
                      : t.volumes.dynamic}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-2xs">
              <span className="text-muted-foreground font-mono">
                {volume.createdAt
                  ? new Date(volume.createdAt).toLocaleDateString()
                  : t.volumes.active}
              </span>

              <button
                onClick={() => setVolumeToDelete(volume)}
                disabled={volume.inUse}
                className="p-1.5 rounded-md text-muted-foreground hover:text-status-danger hover:bg-status-danger/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                title={
                  volume.inUse
                    ? t.volumes.cannotDeleteInUse
                    : t.volumes.deleteAction
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {volumeToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-popover border border-popover-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-black/70 animate-in zoom-in-95 duration-100">
            <h3 className="text-sm font-semibold text-foreground">
              {t.volumes.removeTitle}
            </h3>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              {t.volumes.removeDesc}{" "}
              <span className="font-mono text-amber-500 font-medium">
                {volumeToDelete.name}
              </span>
              ? {t.volumes.removeWarning}
            </p>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                onClick={() => setVolumeToDelete(null)}
                className="px-3 py-1 rounded-md text-xs font-medium text-foreground bg-surface border border-border/80 hover:bg-surface-secondary transition-colors shadow-xs"
              >
                {t.volumes.cancel}
              </button>
              <button
                onClick={async () => {
                  await removeVolume(volumeToDelete.name);
                  setVolumeToDelete(null);
                }}
                className="px-3 py-1 rounded-md text-xs font-medium bg-status-danger hover:bg-status-danger/90 text-white shadow-xs transition-opacity"
              >
                {t.volumes.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
