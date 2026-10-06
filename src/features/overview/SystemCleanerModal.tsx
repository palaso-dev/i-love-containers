import React, { useState, useEffect, useMemo } from "react";
import { Translations } from "@/lib/i18n";
import {
  X,
  Trash2,
  Broom,
  Layers,
  Box,
  HardDrive,
  Cpu,
  RotateCw,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";


import {
  SystemDiskUsage,
  PruneOptions,
  PruneResult,
  ContainerDetail,
  DockerImage,
  DockerVolume,
} from "@/types";
import { fetchSystemDiskUsage, executeSystemPrune } from "@/lib/api";
import { formatBytes, formatRelativeTime } from "@/lib/utils";
import { IndeterminateCheckbox } from "@/features/containers/split-view/IndeterminateCheckbox";

interface SystemCleanerModalProps {
  t: Translations;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  containers: ContainerDetail[];
  images: DockerImage[];
  volumes: DockerVolume[];
}

export const SystemCleanerModal: React.FC<SystemCleanerModalProps> = ({
  t,
  isOpen,
  onClose,
  onSuccess,
  containers,
  images,
  volumes,
}) => {
  const [diskUsage, setDiskUsage] = useState<SystemDiskUsage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState<PruneResult | null>(null);

  const [pruneContainers, setPruneContainers] = useState(true);
  const [pruneImages, setPruneImages] = useState(true);
  const [pruneBuildCache, setPruneBuildCache] = useState(true);
  const [pruneVolumes, setPruneVolumes] = useState(false);

  const [expandedCategories, setExpandedCategories] = useState<{
    containers: boolean;
    images: boolean;
    volumes: boolean;
  }>({
    containers: false,
    images: false,
    volumes: false,
  });

  const stoppedContainers = useMemo(
    () => containers.filter((c) => c.state !== "running"),
    [containers],
  );

  const candidateImages = useMemo(
    () => images.filter((img) => !img.inUse),
    [images],
  );

  const unusedVolumes = useMemo(
    () => volumes.filter((v) => !v.inUse),
    [volumes],
  );

  const [selectedContainerIds, setSelectedContainerIds] = useState<Set<string>>(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [selectedVolumeNames, setSelectedVolumeNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setSelectedContainerIds(new Set(stoppedContainers.map((c) => c.id)));
      setSelectedImageIds(new Set(candidateImages.map((i) => i.id)));
      setSelectedVolumeNames(new Set(unusedVolumes.map((v) => v.name)));
    }
  }, [isOpen, stoppedContainers, candidateImages, unusedVolumes]);

  const loadDiskUsage = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSystemDiskUsage();
      setDiskUsage(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPruneResult(null);
      loadDiskUsage();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleCategory = (cat: "containers" | "images" | "volumes", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const handlePrune = async () => {
    setIsPruning(true);
    try {
      const options: PruneOptions = {
        containers: pruneContainers,
        containerIds:
          pruneContainers && selectedContainerIds.size !== stoppedContainers.length
            ? Array.from(selectedContainerIds)
            : undefined,
        images: pruneImages,
        imageIds:
          pruneImages && selectedImageIds.size !== candidateImages.length
            ? Array.from(selectedImageIds)
            : undefined,
        allImages: true,
        buildCache: pruneBuildCache,
        volumes: pruneVolumes,
        volumeNames:
          pruneVolumes && selectedVolumeNames.size !== unusedVolumes.length
            ? Array.from(selectedVolumeNames)
            : undefined,
      };

      const result = await executeSystemPrune(options);
      setPruneResult(result);
      await onSuccess();
      await loadDiskUsage();
    } finally {
      setIsPruning(false);
    }
  };

  let selectedReclaimable = 0;
  if (diskUsage) {
    if (pruneContainers && stoppedContainers.length > 0) {
      const ratio = selectedContainerIds.size / stoppedContainers.length;
      selectedReclaimable += diskUsage.containersReclaimable * ratio;
    }
    if (pruneImages && candidateImages.length > 0) {
      const ratio = selectedImageIds.size / candidateImages.length;
      selectedReclaimable += diskUsage.imagesReclaimable * ratio;
    }
    if (pruneBuildCache) selectedReclaimable += diskUsage.buildCacheReclaimable;
    if (pruneVolumes && unusedVolumes.length > 0) {
      const ratio = selectedVolumeNames.size / unusedVolumes.length;
      selectedReclaimable += diskUsage.volumesReclaimable * ratio;
    }
  }

  const hasAnySelected =
    (pruneContainers && selectedContainerIds.size > 0) ||
    (pruneImages && selectedImageIds.size > 0) ||
    pruneBuildCache ||
    (pruneVolumes && selectedVolumeNames.size > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => !isPruning && onClose()}
      />

      <div
        className="relative z-10 bg-popover text-foreground border border-popover-border rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between bg-surface-secondary/40">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/30 text-primary">
              <Broom className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                {t.overview.cleaner.title}
              </h2>
              <p className="text-2xs text-muted-foreground">
                {t.overview.cleaner.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPruning}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <RotateCw className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                {t.overview.cleaner.analyze}...
              </span>
            </div>
          ) : (
            <>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t.overview.cleaner.reclaimableSpace}
                  </div>
                  <div className="text-2xl font-black text-foreground font-mono mt-0.5 tracking-tight flex items-baseline gap-2">
                    <span>
                      {formatBytes(diskUsage?.totalReclaimable ?? selectedReclaimable)}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      / {formatBytes(diskUsage?.totalSize ?? 0)}{" "}
                      {t.overview.cleaner.totalUsage}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={loadDiskUsage}
                  disabled={isLoading || isPruning}
                  className="p-2 rounded-lg bg-surface border border-border/70 text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
                  title={t.overview.cleaner.analyze}
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {pruneResult && pruneResult.ok && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-400 flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <div>
                    <span className="font-semibold">
                      {t.overview.cleaner.cleanedSuccess}
                    </span>
                    <span className="ml-1 text-2xs text-emerald-300">
                      ({formatBytes(pruneResult.spaceReclaimed)}{" "}
                      {t.overview.cleaner.reclaimedBanner})
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                <div className="rounded-xl border border-border/70 bg-surface/40 overflow-hidden">
                  <div className="flex items-center space-x-3 p-3 hover:bg-surface-secondary/40 transition-colors">
                    <div>
                      <IndeterminateCheckbox
                        checked={stoppedContainers.length > 0 && selectedContainerIds.size === stoppedContainers.length}
                        indeterminate={selectedContainerIds.size > 0 && selectedContainerIds.size < stoppedContainers.length}
                        onChange={() => {
                          if (selectedContainerIds.size === stoppedContainers.length) {
                            setSelectedContainerIds(new Set());
                            setPruneContainers(false);
                          } else {
                            setSelectedContainerIds(new Set(stoppedContainers.map((c) => c.id)));
                            setPruneContainers(true);
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Box className="w-3.5 h-3.5 text-sky-400" />
                          {t.overview.cleaner.stoppedContainers}
                          <span className="text-2xs font-mono text-muted-foreground font-normal">
                            ({selectedContainerIds.size}/{stoppedContainers.length})
                          </span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-2xs font-mono font-semibold text-primary">
                            {formatBytes(diskUsage?.containersReclaimable ?? 0)}
                          </span>
                          {stoppedContainers.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => toggleCategory("containers", e)}
                              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {expandedCategories.containers ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedCategories.containers && stoppedContainers.length > 0 && (
                    <div className="border-t border-border/50 bg-surface/80 p-2.5 space-y-1.5 max-h-48 overflow-y-auto">
                      {stoppedContainers.map((c) => {
                        const isChecked = selectedContainerIds.has(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-secondary text-2xs font-mono cursor-pointer"
                          >
                            <div className="flex items-center space-x-2 truncate mr-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = new Set(selectedContainerIds);
                                  if (e.target.checked) next.add(c.id);
                                  else next.delete(c.id);
                                  setSelectedContainerIds(next);
                                  setPruneContainers(next.size > 0);
                                }}
                                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 shrink-0"
                              />
                              <span className="font-semibold text-foreground truncate">
                                {c.name}
                              </span>
                              <span className="text-muted-foreground shrink-0 truncate max-w-[130px]">
                                {c.image}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0 text-muted-foreground">
                              {c.created && (
                                <span title={new Date(c.created).toLocaleString()}>
                                  {formatRelativeTime(c.created)}
                                </span>
                              )}
                              <span className="px-1.5 py-0.2 rounded text-2xs bg-surface-secondary text-amber-400 border border-amber-500/20">
                                {c.state}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border/70 bg-surface/40 overflow-hidden">
                  <div className="flex items-center space-x-3 p-3 hover:bg-surface-secondary/40 transition-colors">
                    <div>
                      <IndeterminateCheckbox
                        checked={candidateImages.length > 0 && selectedImageIds.size === candidateImages.length}
                        indeterminate={selectedImageIds.size > 0 && selectedImageIds.size < candidateImages.length}
                        onChange={() => {
                          if (selectedImageIds.size === candidateImages.length) {
                            setSelectedImageIds(new Set());
                            setPruneImages(false);
                          } else {
                            setSelectedImageIds(new Set(candidateImages.map((i) => i.id)));
                            setPruneImages(true);
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                          {t.overview.cleaner.unusedImages}
                          <span className="text-2xs font-mono text-muted-foreground font-normal">
                            ({selectedImageIds.size}/{candidateImages.length})
                          </span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-2xs font-mono font-semibold text-primary">
                            {formatBytes(diskUsage?.imagesReclaimable ?? 0)}
                          </span>
                          {candidateImages.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => toggleCategory("images", e)}
                              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {expandedCategories.images ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedCategories.images && candidateImages.length > 0 && (
                    <div className="border-t border-border/50 bg-surface/80 p-2.5 space-y-1.5 max-h-48 overflow-y-auto">
                      {candidateImages.map((img) => {
                        const isChecked = selectedImageIds.has(img.id);
                        return (
                          <label
                            key={img.id}
                            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-secondary text-2xs font-mono cursor-pointer"
                          >
                            <div className="flex items-center space-x-2 truncate mr-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = new Set(selectedImageIds);
                                  if (e.target.checked) next.add(img.id);
                                  else next.delete(img.id);
                                  setSelectedImageIds(next);
                                  setPruneImages(next.size > 0);
                                }}
                                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 shrink-0"
                              />
                              <span className="font-semibold text-foreground truncate">
                                {img.repository}:{img.tag}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0 text-muted-foreground">
                              {img.created && (
                                <span title={new Date(img.created).toLocaleString()}>
                                  {formatRelativeTime(img.created)}
                                </span>
                              )}
                              <span>{formatBytes(img.size)}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <label className="flex items-center space-x-3 p-3 rounded-xl border border-border/70 hover:bg-surface-secondary/40 cursor-pointer transition-colors bg-surface/40">
                  <input
                    type="checkbox"
                    checked={pruneBuildCache}
                    onChange={(e) => setPruneBuildCache(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-amber-400" />
                        {t.overview.cleaner.buildCache}
                      </span>
                      <span className="text-2xs font-mono font-semibold text-primary">
                        {formatBytes(diskUsage?.buildCacheReclaimable ?? 0)}
                      </span>
                    </div>
                  </div>
                </label>

                <div className="rounded-xl border border-border/70 bg-surface/40 overflow-hidden">
                  <div className="flex items-center space-x-3 p-3 hover:bg-surface-secondary/40 transition-colors">
                    <div>
                      <IndeterminateCheckbox
                        checked={unusedVolumes.length > 0 && selectedVolumeNames.size === unusedVolumes.length}
                        indeterminate={selectedVolumeNames.size > 0 && selectedVolumeNames.size < unusedVolumes.length}
                        onChange={() => {
                          if (selectedVolumeNames.size === unusedVolumes.length) {
                            setSelectedVolumeNames(new Set());
                            setPruneVolumes(false);
                          } else {
                            setSelectedVolumeNames(new Set(unusedVolumes.map((v) => v.name)));
                            setPruneVolumes(true);
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                          {t.overview.cleaner.unusedVolumes}
                          <span className="text-2xs font-mono text-muted-foreground font-normal">
                            ({selectedVolumeNames.size}/{unusedVolumes.length})
                          </span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-2xs font-mono font-semibold text-primary">
                            {formatBytes(diskUsage?.volumesReclaimable ?? 0)}
                          </span>
                          {unusedVolumes.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => toggleCategory("volumes", e)}
                              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {expandedCategories.volumes ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedCategories.volumes && unusedVolumes.length > 0 && (
                    <div className="border-t border-border/50 bg-surface/80 p-2.5 space-y-1.5 max-h-48 overflow-y-auto">
                      {unusedVolumes.map((v) => {
                        const isChecked = selectedVolumeNames.has(v.name);
                        return (
                          <label
                            key={v.name}
                            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-secondary text-2xs font-mono cursor-pointer"
                          >
                            <div className="flex items-center space-x-2 truncate mr-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = new Set(selectedVolumeNames);
                                  if (e.target.checked) next.add(v.name);
                                  else next.delete(v.name);
                                  setSelectedVolumeNames(next);
                                  setPruneVolumes(next.size > 0);
                                }}
                                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 shrink-0"
                              />
                              <span className="font-semibold text-foreground truncate">
                                {v.name}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0 text-muted-foreground">
                              {v.createdAt && (
                                <span title={new Date(v.createdAt).toLocaleString()}>
                                  {formatRelativeTime(v.createdAt)}
                                </span>
                              )}
                              <span>{formatBytes(v.size ?? 0)}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-border/80 flex items-center justify-end space-x-2.5 bg-surface-secondary/30">
          <button
            type="button"
            onClick={onClose}
            disabled={isPruning}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-surface border border-border/70 hover:bg-surface-secondary transition-colors disabled:opacity-50"
          >
            {t.overview.cleaner.close}
          </button>
          <button
            type="button"
            onClick={handlePrune}
            disabled={isPruning || !hasAnySelected}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-white transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
          >
            {isPruning ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t.overview.cleaner.cleaning}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {t.overview.cleaner.cleanNow} (
                  {formatBytes(selectedReclaimable)})
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
