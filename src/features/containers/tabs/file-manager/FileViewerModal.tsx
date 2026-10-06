import React, { useRef } from "react";
import { Translations } from "@/lib/i18n";
import { FileText, RotateCcw, Save, Download, X, File } from "lucide-react";
import { ContainerFileItem } from "@/types";

export interface ViewerModalState {
  item: ContainerFileItem;
  content: string;
  originalContent: string;
  isBinary: boolean;
  isSaving: boolean;
}

interface FileViewerModalProps {
  viewerModal: ViewerModalState;
  containerId: string;
  fm: Translations["containers"]["fileManager"];
  onClose: () => void;
  onDiscardChanges: () => void;
  onSaveAndClose: () => void;
  onContentChange: (content: string) => void;
  onDownload: (containerId: string, path: string, name: string) => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  viewerModal,
  containerId,
  fm,
  onClose,
  onDiscardChanges,
  onSaveAndClose,
  onContentChange,
  onDownload,
}) => {
  const editorGutterRef = useRef<HTMLDivElement>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="bg-popover border border-border rounded-xl flex flex-col w-full max-w-3xl h-[80vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border">
          <div className="flex items-center space-x-2 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold text-xs text-foreground truncate">
              {viewerModal.item.name}
            </span>
            <span className="text-2xs font-mono text-muted-foreground truncate">
              ({viewerModal.item.path})
            </span>
            {!viewerModal.isBinary && (
              <span className="text-2xs font-mono text-muted-foreground/60 shrink-0 hidden sm:inline">
                •{" "}
                {fm.linesCount.replace(
                  "{count}",
                  String((viewerModal.content || "").split("\n").length),
                )}
              </span>
            )}
            {viewerModal.content !== viewerModal.originalContent && (
              <span
                className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                title="Unsaved changes"
              />
            )}
          </div>
          <div className="flex items-center space-x-2">
            {!viewerModal.isBinary &&
              viewerModal.content !== viewerModal.originalContent && (
                <button
                  onClick={onDiscardChanges}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-surface-secondary border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors shadow-xs"
                  title={fm.discardChanges}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                  <span>{fm.discardChanges}</span>
                </button>
              )}
            {!viewerModal.isBinary && (
              <button
                onClick={onSaveAndClose}
                disabled={viewerModal.isSaving}
                className="flex items-center space-x-1 px-3 py-1 rounded bg-primary hover:bg-primary/90 text-white text-xs font-medium transition-colors shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{viewerModal.isSaving ? fm.saving : fm.save}</span>
              </button>
            )}
            <button
              onClick={() =>
                onDownload(
                  containerId,
                  viewerModal.item.path,
                  viewerModal.item.name,
                )
              }
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-surface-secondary border border-border text-xs text-foreground hover:bg-surface-hover transition-colors shadow-xs"
              title={fm.download}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{fm.download}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-background">
          {viewerModal.isBinary ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <File className="w-12 h-12 mb-2 opacity-40" />
              <p className="text-xs font-medium">{fm.readOnlyWarning}</p>
            </div>
          ) : (
            <div className="flex flex-1 h-full overflow-hidden">
              <div
                ref={editorGutterRef}
                className="py-2.5 pl-3 pr-2.5 select-none text-right font-mono text-xs leading-relaxed border-r border-border/50 bg-surface-secondary/20 overflow-hidden shrink-0"
                aria-hidden="true"
              >
                <pre className="font-mono text-xs leading-relaxed m-0 p-0 text-muted-foreground/40">
                  {Array.from(
                    {
                      length: Math.max(
                        1,
                        (viewerModal.content || "").split("\n").length,
                      ),
                    },
                    (_, i) => i + 1,
                  ).join("\n")}
                </pre>
              </div>
              <textarea
                ref={editorTextareaRef}
                value={viewerModal.content}
                onChange={(e) => onContentChange(e.target.value)}
                onScroll={(e) => {
                  if (editorGutterRef.current) {
                    editorGutterRef.current.scrollTop =
                      e.currentTarget.scrollTop;
                  }
                }}
                wrap="off"
                className="w-full h-full p-2.5 bg-transparent text-foreground font-mono text-xs resize-none focus:outline-none leading-relaxed overflow-auto whitespace-pre select-text"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
