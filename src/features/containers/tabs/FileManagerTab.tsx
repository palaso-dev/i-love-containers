import React from "react";
import {
  Upload,
  Folder,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import {
  renameContainerFile,
  deleteContainerFiles,
  createContainerFolder,
  createContainerFile,
  downloadContainerFile,
} from "@/lib/api";
import { useAppStore } from "@/stores/useAppStore";
import { ContainerNotRunning } from "@/components/ContainerNotRunning";
import {
  FileManagerTabProps,
  FileViewerModal,
  RenameModal,
  NewFolderModal,
  NewFileModal,
  DeleteConfirmModal,
  FileManagerContextMenu,
  FileManagerToolbar,
  FileGridView,
  FileListView,
  useFileManagerState,
} from "./file-manager";

export const FileManagerTab: React.FC<FileManagerTabProps> = ({
  containerId,
  containerName,
  containerState,
}) => {
  const { t, containers } = useAppStore();
  const fm = t.containers.fileManager;

  const currentContainer = containers.find((c) => c.id === containerId);
  const state = containerState ?? currentContainer?.state ?? "running";
  const isRunning = state === "running";

  const {
    currentPath,
    defaultPath,
    history,
    historyIdx,
    files,
    sortedFiles,
    isLoading,
    viewMode,
    sortField,
    sortAsc,
    searchQuery,
    selectedPaths,
    isEditingPath,
    pathInput,
    isDraggingOver,
    dropStatus,
    dropTarget,
    clipboard,
    contextMenu,
    viewerModal,
    renameModal,
    newFolderModal,
    newFileModal,
    deleteModal,
    isDeleting,
    fileInputRef,
    containerRef,
    scrollContainerRef,
    gridContainerRef,
    contextMenuRef,
    loadFiles,
    navigateTo,
    handleBack,
    handleForward,
    handleUp,
    handleRefresh,
    handleItemDoubleClick,
    handleSelect,
    handleContextMenu,
    handleCopy,
    handleCut,
    handlePaste,
    handleFileDragStart,
    handleFileDragEnd,
    handleItemDragOver,
    handleItemDragLeave,
    handleItemDrop,
    handleDrop,
    handleFileInputChange,
    handleSaveAndClose,
    setIsEditingPath,
    setPathInput,
    setSearchQuery,
    setViewMode,
    setSortField,
    setSortAsc,
    setSelectedPaths,
    setContextMenu,
    setDropStatus,
    setViewerModal,
    setRenameModal,
    setNewFolderModal,
    setNewFileModal,
    setDeleteModal,
    setIsDeleting,
  } = useFileManagerState(containerId, state, fm);

  if (!isRunning) {
    return (
      <ContainerNotRunning
        state={state}
        containerName={containerName}
        featureName="files"
      />
    );
  }

  const pathBreadcrumbs = currentPath === "/" ? [""] : currentPath.split("/");

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-background overflow-hidden relative"
      onClick={() => {
        setSelectedPaths(new Set());
        setContextMenu(null);
      }}
      onContextMenu={(e) => handleContextMenu(e)}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="absolute -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-px h-px"
        tabIndex={-1}
        multiple
      />

      <FileManagerToolbar
        historyIdx={historyIdx}
        historyLength={history.length}
        currentPath={currentPath}
        defaultPath={defaultPath}
        isEditingPath={isEditingPath}
        pathInput={pathInput}
        pathBreadcrumbs={pathBreadcrumbs}
        searchQuery={searchQuery}
        isLoading={isLoading}
        viewMode={viewMode}
        fm={fm}
        fileInputRef={fileInputRef}
        onBack={handleBack}
        onForward={handleForward}
        onUp={handleUp}
        onNavigateTo={navigateTo}
        onRefresh={handleRefresh}
        setIsEditingPath={setIsEditingPath}
        setPathInput={setPathInput}
        setSearchQuery={setSearchQuery}
        setViewMode={setViewMode}
        onOpenNewFolderModal={() => setNewFolderModal({ name: "" })}
        onOpenNewFileModal={() => setNewFileModal({ name: "" })}
      />

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-2 relative"
        onClick={() => {
          setSelectedPaths(new Set());
          setContextMenu(null);
        }}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            handleContextMenu(e);
          }
        }}
      >
        {dropStatus && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-2.5 rounded-xl border shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 ${
              dropStatus.type === "loading"
                ? "bg-surface/90 border-border text-foreground"
                : dropStatus.type === "success"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
            }`}
          >
            {dropStatus.type === "loading" && (
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-primary" />
            )}
            {dropStatus.type === "success" && (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            )}
            {dropStatus.type === "error" && (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            )}
            <span className="text-xs font-medium">{dropStatus.message}</span>
            <button
              onClick={() => setDropStatus(null)}
              className="ml-2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {sortedFiles.length === 0 && !isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <Folder className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-xs font-medium">{fm.emptyDirectory}</p>
          </div>
        ) : viewMode === "list" ? (
          <FileListView
            sortedFiles={sortedFiles}
            selectedPaths={selectedPaths}
            dropTarget={dropTarget}
            sortField={sortField}
            sortAsc={sortAsc}
            fm={fm}
            onSort={(field) => {
              if (sortField === field) setSortAsc(!sortAsc);
              else {
                setSortField(field);
                setSortAsc(true);
              }
            }}
            onDragStart={handleFileDragStart}
            onDragEnd={handleFileDragEnd}
            onItemDragOver={handleItemDragOver}
            onItemDragLeave={handleItemDragLeave}
            onItemDrop={handleItemDrop}
            onSelect={handleSelect}
            onDoubleClick={handleItemDoubleClick}
            onContextMenu={handleContextMenu}
          />
        ) : (
          <FileGridView
            sortedFiles={sortedFiles}
            selectedPaths={selectedPaths}
            dropTarget={dropTarget}
            gridContainerRef={gridContainerRef}
            onDragStart={handleFileDragStart}
            onDragEnd={handleFileDragEnd}
            onItemDragOver={handleItemDragOver}
            onItemDragLeave={handleItemDragLeave}
            onItemDrop={handleItemDrop}
            onSelect={handleSelect}
            onDoubleClick={handleItemDoubleClick}
            onContextMenu={handleContextMenu}
          />
        )}
      </div>

      {isDraggingOver && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md border-2 border-dashed border-primary pointer-events-none animate-in fade-in duration-150">
          <Upload className="w-12 h-12 text-primary animate-bounce mb-2" />
          <p className="text-sm font-semibold text-primary">
            {fm.dragDropHint}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-1 bg-surface/50 border-t border-border/70 text-2xs font-mono text-muted-foreground shrink-0 ">
        <div className="flex items-center space-x-2">
          <span>{fm.itemsCount.replace("{count}", String(files.length))}</span>
          {selectedPaths.size > 0 && (
            <span className="font-semibold text-primary">
              • {selectedPaths.size} selected
            </span>
          )}
        </div>
        <div>{currentPath}</div>
      </div>

      {contextMenu && (
        <FileManagerContextMenu
          contextMenu={contextMenu}
          contextMenuRef={contextMenuRef}
          selectedPaths={selectedPaths}
          files={files}
          clipboard={clipboard}
          fm={fm}
          onClose={() => setContextMenu(null)}
          onOpenItem={handleItemDoubleClick}
          onDownloadItem={(item) => {
            const target = item || files.find((f) => selectedPaths.has(f.path));
            if (target && !target.isDirectory) {
              downloadContainerFile(containerId, target.path, target.name);
            }
          }}
          onCopyItem={handleCopy}
          onCutItem={handleCut}
          onPaste={handlePaste}
          onCopyPath={(item) => {
            const target = item || files.find((f) => selectedPaths.has(f.path));
            if (target) {
              navigator.clipboard.writeText(target.path);
            }
          }}
          onRename={(item) => setRenameModal({ item, newName: item.name })}
          onDeleteItems={(items) => setDeleteModal({ items })}
          onNewFolder={() => setNewFolderModal({ name: "" })}
          onNewFile={() => setNewFileModal({ name: "" })}
          onUploadClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
              fileInputRef.current.click();
            }
          }}
          onRefresh={handleRefresh}
        />
      )}

      {viewerModal && (
        <FileViewerModal
          viewerModal={viewerModal}
          containerId={containerId}
          fm={fm}
          onClose={() => setViewerModal(null)}
          onDiscardChanges={() =>
            setViewerModal((prev) =>
              prev ? { ...prev, content: prev.originalContent } : null,
            )
          }
          onSaveAndClose={handleSaveAndClose}
          onContentChange={(val) =>
            setViewerModal((prev) => (prev ? { ...prev, content: val } : null))
          }
          onDownload={downloadContainerFile}
        />
      )}

      <RenameModal
        renameModal={renameModal}
        fm={fm}
        onClose={() => setRenameModal(null)}
        onChangeName={(newName) =>
          setRenameModal((prev) => (prev ? { ...prev, newName } : null))
        }
        onSave={async (newName) => {
          if (!renameModal) return;
          const parent = currentPath === "/" ? "" : currentPath;
          const target = `${parent}/${newName}`;
          await renameContainerFile(containerId, renameModal.item.path, target);
          setRenameModal(null);
          await loadFiles(currentPath);
        }}
      />

      <NewFolderModal
        newFolderModal={newFolderModal}
        fm={fm}
        onClose={() => setNewFolderModal(null)}
        onChangeName={(name) => setNewFolderModal({ name })}
        onSave={async (name) => {
          const parent = currentPath === "/" ? "" : currentPath;
          const target = `${parent}/${name}`;
          await createContainerFolder(containerId, target);
          setNewFolderModal(null);
          await loadFiles(currentPath);
        }}
      />

      <NewFileModal
        newFileModal={newFileModal}
        fm={fm}
        onClose={() => setNewFileModal(null)}
        onChangeName={(name) => setNewFileModal({ name })}
        onSave={async (name) => {
          const parent = currentPath === "/" ? "" : currentPath;
          const target = `${parent}/${name}`;
          await createContainerFile(containerId, target);
          setNewFileModal(null);
          await loadFiles(currentPath);
        }}
      />

      <DeleteConfirmModal
        deleteModal={deleteModal}
        isDeleting={isDeleting}
        fm={fm}
        onClose={() => setDeleteModal(null)}
        onConfirm={async () => {
          if (!deleteModal) return;
          setIsDeleting(true);
          try {
            const paths = deleteModal.items.map((i) =>
              i.path.startsWith("/")
                ? i.path
                : `${currentPath === "/" ? "" : currentPath}/${i.path}`,
            );
            await deleteContainerFiles(containerId, paths);
          } finally {
            setIsDeleting(false);
            setDeleteModal(null);
            await loadFiles(currentPath);
          }
        }}
      />
    </div>
  );
};
