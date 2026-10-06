import React from "react";
import { Translations } from "@/lib/i18n";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Home,
  RotateCw,
  HardDrive,
  Search,
  FolderPlus,
  FilePlus,
  Upload,
  List as ListIcon,
  LayoutGrid,
} from "lucide-react";

interface FileManagerToolbarProps {
  historyIdx: number;
  historyLength: number;
  currentPath: string;
  defaultPath: string;
  isEditingPath: boolean;
  pathInput: string;
  pathBreadcrumbs: string[];
  searchQuery: string;
  isLoading: boolean;
  viewMode: "list" | "grid";
  fm: Translations["containers"]["fileManager"];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onNavigateTo: (path: string) => void;
  onRefresh: () => void;
  setIsEditingPath: (val: boolean) => void;
  setPathInput: (val: string) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: "list" | "grid") => void;
  onOpenNewFolderModal: () => void;
  onOpenNewFileModal: () => void;
}

export const FileManagerToolbar: React.FC<FileManagerToolbarProps> = ({
  historyIdx,
  historyLength,
  currentPath,
  defaultPath,
  isEditingPath,
  pathInput,
  pathBreadcrumbs,
  searchQuery,
  isLoading,
  viewMode,
  fm,
  fileInputRef,
  onBack,
  onForward,
  onUp,
  onNavigateTo,
  onRefresh,
  setIsEditingPath,
  setPathInput,
  setSearchQuery,
  setViewMode,
  onOpenNewFolderModal,
  onOpenNewFileModal,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-surface/40 border-b border-border/70 shrink-0">
      <div className="flex items-center space-x-1">
        <button
          onClick={onBack}
          disabled={historyIdx <= 0}
          className="p-1.5 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors shadow-xs"
          title="Back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onForward}
          disabled={historyIdx >= historyLength - 1}
          className="p-1.5 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors shadow-xs"
          title="Forward"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onUp}
          disabled={currentPath === "/"}
          className="p-1.5 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors shadow-xs"
          title="Up one level"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => onNavigateTo(defaultPath || "/")}
          disabled={currentPath === (defaultPath || "/")}
          className="p-1.5 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors shadow-xs"
          title={
            defaultPath && defaultPath !== "/"
              ? `Working directory (${defaultPath})`
              : fm.rootDirectory
          }
        >
          <Home className="w-4 h-4" />
        </button>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground transition-colors shadow-xs"
          title={fm.refresh}
        >
          <RotateCw
            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      <div className="flex-1 min-w-[180px] max-w-xl mx-1">
        {isEditingPath ? (
          <input
            type="text"
            value={pathInput}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setPathInput(e.target.value)}
            onBlur={() => {
              setIsEditingPath(false);
              onNavigateTo(pathInput || "/");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setIsEditingPath(false);
                onNavigateTo(pathInput || "/");
              } else if (e.key === "Escape") {
                setIsEditingPath(false);
                setPathInput(currentPath);
              }
            }}
            className="w-full px-2.5 py-1 text-xs font-mono bg-surface border border-primary/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingPath(true);
            }}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-mono bg-surface/70 border border-border/70 rounded-md cursor-text hover:border-border text-muted-foreground overflow-x-auto"
            title="Click to edit path"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateTo("/");
              }}
              className="hover:opacity-80 transition-opacity flex items-center shrink-0 mr-1"
              title={fm.rootDirectory}
            >
              <HardDrive className="w-3.5 h-3.5 text-primary" />
            </button>
            {pathBreadcrumbs.map((seg, idx) => {
              const isLast = idx === pathBreadcrumbs.length - 1;
              const segPath =
                idx === 0
                  ? "/"
                  : pathBreadcrumbs.slice(0, idx + 1).join("/") || "/";
              return (
                <React.Fragment key={segPath}>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateTo(segPath);
                    }}
                    className={`hover:text-primary cursor-pointer hover:underline ${
                      isLast ? "text-foreground font-semibold" : ""
                    }`}
                  >
                    {seg === "" ? "/" : seg}
                  </span>
                  {!isLast && idx !== 0 && (
                    <span className="text-muted-foreground/50">/</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-1.5 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={fm.searchPlaceholder}
            value={searchQuery}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 pr-2 py-1 text-xs bg-surface/70 border border-border/70 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-32 sm:w-40"
          />
        </div>

        <div className="h-4 w-[1px] bg-border/60 mx-0.5" />

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenNewFolderModal();
          }}
          className="flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-md bg-surface border border-border/70 hover:bg-surface-secondary text-foreground transition-colors shadow-xs"
          title={fm.newFolder}
        >
          <FolderPlus className="w-3.5 h-3.5 text-primary" />
          <span className="hidden xl:inline">{fm.newFolder}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenNewFileModal();
          }}
          className="flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-md bg-surface border border-border/70 hover:bg-surface-secondary text-foreground transition-colors shadow-xs"
          title={fm.newFile}
        >
          <FilePlus className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden xl:inline">{fm.newFile}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
              fileInputRef.current.click();
            }
          }}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 transition-colors shadow-xs"
          title={fm.upload}
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{fm.upload}</span>
        </button>

        <div className="h-4 w-[1px] bg-border/60 mx-0.5" />

        <div className="flex items-center bg-surface-secondary/70 border border-border/60 p-0.5 rounded-lg shadow-xs">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewMode("list");
            }}
            className={`p-1 rounded ${
              viewMode === "list"
                ? "bg-surface text-foreground shadow-mac-segment"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={fm.listView}
          >
            <ListIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewMode("grid");
            }}
            className={`p-1 rounded ${
              viewMode === "grid"
                ? "bg-surface text-foreground shadow-mac-segment"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={fm.gridView}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
