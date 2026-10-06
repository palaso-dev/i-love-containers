import React from "react";
import { Translations } from "@/lib/i18n";
import {
  Folder,
  Copy,
  Scissors,
  ClipboardPaste,
  Trash2,
  Edit2,
  Eye,
  Download,
  FolderPlus,
  FilePlus,
  Upload,
  RotateCw,
} from "lucide-react";
import { ContainerFileItem } from "@/types";

interface ContextMenuState {
  x: number;
  y: number;
  item?: ContainerFileItem;
}

interface FileManagerContextMenuProps {
  contextMenu: ContextMenuState;
  contextMenuRef: React.RefObject<HTMLDivElement>;
  selectedPaths: Set<string>;
  files: ContainerFileItem[];
  clipboard: { action: "copy" | "cut"; items: ContainerFileItem[] } | null;
  fm: Translations["containers"]["fileManager"];
  onClose: () => void;
  onOpenItem: (item: ContainerFileItem) => void;
  onDownloadItem: (item?: ContainerFileItem) => void;
  onCopyItem: (item?: ContainerFileItem) => void;
  onCutItem: (item?: ContainerFileItem) => void;
  onPaste: () => void;
  onCopyPath: (item?: ContainerFileItem) => void;
  onRename: (item: ContainerFileItem) => void;
  onDeleteItems: (items: ContainerFileItem[]) => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onUploadClick: () => void;
  onRefresh: () => void;
}

export const FileManagerContextMenu: React.FC<FileManagerContextMenuProps> = ({
  contextMenu,
  contextMenuRef,
  selectedPaths,
  files,
  clipboard,
  fm,
  onClose,
  onOpenItem,
  onDownloadItem,
  onCopyItem,
  onCutItem,
  onPaste,
  onCopyPath,
  onRename,
  onDeleteItems,
  onNewFolder,
  onNewFile,
  onUploadClick,
  onRefresh,
}) => {
  return (
    <div
      ref={contextMenuRef}
      style={{ top: contextMenu.y, left: contextMenu.x }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 min-w-[160px] bg-popover/95 backdrop-blur-md border border-border rounded-lg shadow-xl py-1 text-xs text-foreground font-sans animate-in fade-in zoom-in-95 duration-75"
    >
      {contextMenu.item && (
        <button
          onClick={() => {
            onOpenItem(contextMenu.item!);
            onClose();
          }}
          className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
        >
          {contextMenu.item.isDirectory ? (
            <Folder className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
          <span>{fm.open}</span>
        </button>
      )}

      {contextMenu.item && !contextMenu.item.isDirectory && (
        <button
          onClick={() => {
            onDownloadItem(contextMenu.item);
            onClose();
          }}
          className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{fm.download}</span>
        </button>
      )}

      {contextMenu.item && (
        <>
          <button
            onClick={() => {
              onCopyItem(contextMenu.item);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{fm.copy}</span>
          </button>
          <button
            onClick={() => {
              onCutItem(contextMenu.item);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>{fm.cut}</span>
          </button>
        </>
      )}

      {clipboard && (
        <button
          onClick={() => {
            onPaste();
            onClose();
          }}
          className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          <span>{fm.paste}</span>
        </button>
      )}

      {contextMenu.item && (
        <>
          <button
            onClick={() => {
              onRename(contextMenu.item!);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{fm.rename}</span>
          </button>
          <button
            onClick={() => {
              onCopyPath(contextMenu.item);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{fm.copyPath}</span>
          </button>
          <div className="h-[1px] bg-border/60 my-1" />
          <button
            onClick={() => {
              const itemsToDelete = selectedPaths.has(contextMenu.item!.path)
                ? files.filter((f) => selectedPaths.has(f.path))
                : [contextMenu.item!];
              onDeleteItems(itemsToDelete);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{fm.delete}</span>
          </button>
        </>
      )}

      {!contextMenu.item && (
        <>
          <button
            onClick={() => {
              onNewFolder();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{fm.newFolder}</span>
          </button>
          <button
            onClick={() => {
              onNewFile();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>{fm.newFile}</span>
          </button>
          <button
            onClick={() => {
              onUploadClick();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{fm.upload}</span>
          </button>
          <div className="h-[1px] bg-border/60 my-1" />
          <button
            onClick={() => {
              onRefresh();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-primary hover:text-white transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>{fm.refresh}</span>
          </button>
        </>
      )}
    </div>
  );
};
