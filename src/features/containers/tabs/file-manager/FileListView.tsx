import React from "react";
import { Translations } from "@/lib/i18n";
import { ContainerFileItem } from "@/types";
import { formatBytes } from "@/lib/utils";
import { getFileIcon } from "./fileTypes";

interface FileListViewProps {
  sortedFiles: ContainerFileItem[];
  selectedPaths: Set<string>;
  dropTarget: ContainerFileItem | null;
  sortField: "name" | "size" | "mtime";
  sortAsc: boolean;
  fm: Translations["containers"]["fileManager"];
  onSort: (field: "name" | "size" | "mtime") => void;
  onDragStart: (e: React.DragEvent, item: ContainerFileItem) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onItemDragOver: (e: React.DragEvent, item: ContainerFileItem) => void;
  onItemDragLeave: (e: React.DragEvent, item: ContainerFileItem) => void;
  onItemDrop: (e: React.DragEvent, item: ContainerFileItem) => void;
  onSelect: (e: React.MouseEvent, item: ContainerFileItem) => void;
  onDoubleClick: (item: ContainerFileItem) => void;
  onContextMenu: (e: React.MouseEvent, item: ContainerFileItem) => void;
}

export const FileListView: React.FC<FileListViewProps> = ({
  sortedFiles,
  selectedPaths,
  dropTarget,
  sortField,
  sortAsc,
  fm,
  onSort,
  onDragStart,
  onDragEnd,
  onItemDragOver,
  onItemDragLeave,
  onItemDrop,
  onSelect,
  onDoubleClick,
  onContextMenu,
}) => {
  return (
    <div className="min-w-[600px] text-xs font-mono">
      <div className="grid grid-cols-12 gap-2 px-3 py-1.5 font-sans font-semibold text-2xs text-muted-foreground border-b border-border/60">
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSort("name");
          }}
          className="col-span-6 flex items-center space-x-1 cursor-pointer hover:text-foreground"
        >
          <span>{fm.name}</span>
          {sortField === "name" && <span>{sortAsc ? "↑" : "↓"}</span>}
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSort("size");
          }}
          className="col-span-2 text-right cursor-pointer hover:text-foreground"
        >
          <span>{fm.size}</span>
          {sortField === "size" && <span>{sortAsc ? "↑" : "↓"}</span>}
        </div>
        <div className="col-span-2 text-center">{fm.permissions}</div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSort("mtime");
          }}
          className="col-span-2 text-right cursor-pointer hover:text-foreground"
        >
          <span>{fm.modified}</span>
          {sortField === "mtime" && <span>{sortAsc ? "↑" : "↓"}</span>}
        </div>
      </div>

      <div className="divide-y divide-border/30">
        {sortedFiles.map((file) => {
          const Icon = getFileIcon(file);
          const isSelected = selectedPaths.has(file.path);
          const isDropTarget = dropTarget?.path === file.path;
          return (
            <div
              key={file.path}
              draggable={true}
              onDragStart={(e) => onDragStart(e, file)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => onItemDragOver(e, file)}
              onDragLeave={(e) => onItemDragLeave(e, file)}
              onDrop={(e) => onItemDrop(e, file)}
              onClick={(e) => onSelect(e, file)}
              onDoubleClick={() => onDoubleClick(file)}
              onContextMenu={(e) => onContextMenu(e, file)}
              className={`grid grid-cols-12 gap-2 px-3 py-2 items-center cursor-pointer rounded-lg transition-colors ${
                isDropTarget
                  ? "bg-primary/30 ring-2 ring-primary border-primary text-foreground"
                  : isSelected
                    ? "bg-primary text-white font-semibold shadow-xs"
                    : "hover:bg-surface-secondary/60 text-foreground"
              }`}
            >
              <div className="col-span-6 flex items-center space-x-2 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isSelected
                      ? "text-white fill-white/20"
                      : file.isDirectory
                        ? "text-amber-400 fill-amber-400/20"
                        : "text-muted-foreground"
                  }`}
                />
                <span className="truncate">{file.name}</span>
                {file.isSymlink && file.linkTarget && (
                  <span
                    className={`text-2xs truncate ${isSelected ? "text-white/70" : "text-muted-foreground opacity-60"}`}
                  >
                    → {file.linkTarget}
                  </span>
                )}
              </div>
              <div
                className={`col-span-2 text-right truncate ${isSelected ? "text-white/90" : "text-muted-foreground"}`}
              >
                {file.isDirectory ? "—" : formatBytes(file.size)}
              </div>
              <div
                className={`col-span-2 text-center text-2xs font-mono truncate ${isSelected ? "text-white/80" : "text-muted-foreground"}`}
              >
                {file.permissions}
              </div>
              <div
                className={`col-span-2 text-right text-2xs truncate ${isSelected ? "text-white/90" : "text-muted-foreground"}`}
              >
                {file.mtime}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
