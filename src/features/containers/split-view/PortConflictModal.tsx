import React from "react";
import { Translations } from "@/lib/i18n";
import { AlertTriangle, X, Play } from "lucide-react";
import { ContainerDetail } from "@/types";

interface PortConflictModalProps {
  t: Translations;
  isOpen: boolean;
  targetContainer: ContainerDetail | null;
  conflictDetails: {
    port: number;
    conflictingContainer: ContainerDetail;
  } | null;
  onClose: () => void;
  onConfirmStart: () => void;
}

export const PortConflictModal: React.FC<PortConflictModalProps> = ({
  t,
  isOpen,
  targetContainer,
  conflictDetails,
  onClose,
  onConfirmStart,
}) => {
  if (!isOpen || !targetContainer || !conflictDetails) return null;

  const desc = (t.containers.portConflictDesc || "")
    .replace("{port}", String(conflictDetails.port))
    .replace("{name}", conflictDetails.conflictingContainer.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div
        className="relative z-10 bg-popover text-foreground border border-popover-border rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {t.containers.portConflictTitle}
              </h3>
              <p className="text-2xs font-mono text-muted-foreground mt-0.5">
                :{conflictDetails.port}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs text-muted-foreground">
          <p className="leading-relaxed text-foreground">{desc}</p>
          <div className="p-2.5 rounded-lg bg-surface border border-border/70 text-2xs space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Attempting to start:</span>
              <span className="text-foreground font-semibold">
                {targetContainer.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Already bound by:</span>
              <span className="text-amber-500 font-semibold">
                {conflictDetails.conflictingContainer.name}
              </span>
            </div>
          </div>
          <p className="text-2xs text-amber-500/90 font-medium">
            {t.containers.portConflictWarning}
          </p>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border/80">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-surface border border-border/70 hover:bg-surface-secondary transition-colors"
          >
            {t.containers.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirmStart}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-xs flex items-center space-x-1.5"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{t.containers.startAnyway}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
