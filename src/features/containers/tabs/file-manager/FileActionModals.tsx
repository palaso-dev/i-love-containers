import React from "react";
import { Translations } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import { ContainerFileItem } from "@/types";

interface RenameModalProps {
  renameModal: { item: ContainerFileItem; newName: string } | null;
  fm: Translations["containers"]["fileManager"];
  onClose: () => void;
  onSave: (newName: string) => void;
  onChangeName: (newName: string) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  renameModal,
  fm,
  onClose,
  onSave,
  onChangeName,
}) => {
  if (!renameModal) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="bg-popover border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground">{fm.rename}</h3>
        <div>
          <label className="text-2xs text-muted-foreground mb-1 block">
            {fm.renamePrompt}
          </label>
          <input
            type="text"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            value={renameModal.newName}
            onChange={(e) => onChangeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameModal.newName.trim()) {
                onSave(renameModal.newName.trim());
              }
            }}
            className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium rounded-md bg-surface border border-border hover:bg-surface-secondary text-foreground transition-colors"
          >
            {fm.close}
          </button>
          <button
            onClick={() => {
              if (renameModal.newName.trim()) {
                onSave(renameModal.newName.trim());
              }
            }}
            className="px-3 py-1 text-xs font-medium rounded-md bg-primary hover:bg-primary/90 text-white transition-colors"
          >
            {fm.save}
          </button>
        </div>
      </div>
    </div>
  );
};

interface NewFolderModalProps {
  newFolderModal: { name: string } | null;
  fm: Translations["containers"]["fileManager"];
  onClose: () => void;
  onSave: (name: string) => void;
  onChangeName: (name: string) => void;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({
  newFolderModal,
  fm,
  onClose,
  onSave,
  onChangeName,
}) => {
  if (!newFolderModal) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="bg-popover border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground">
          {fm.newFolder}
        </h3>
        <div>
          <label className="text-2xs text-muted-foreground mb-1 block">
            {fm.folderNamePrompt}
          </label>
          <input
            type="text"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            value={newFolderModal.name}
            onChange={(e) => onChangeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderModal.name.trim()) {
                onSave(newFolderModal.name.trim());
              }
            }}
            className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium rounded-md bg-surface border border-border hover:bg-surface-secondary text-foreground transition-colors"
          >
            {fm.close}
          </button>
          <button
            onClick={() => {
              if (newFolderModal.name.trim()) {
                onSave(newFolderModal.name.trim());
              }
            }}
            className="px-3 py-1 text-xs font-medium rounded-md bg-primary hover:bg-primary/90 text-white transition-colors"
          >
            {fm.save}
          </button>
        </div>
      </div>
    </div>
  );
};

interface NewFileModalProps {
  newFileModal: { name: string } | null;
  fm: Translations["containers"]["fileManager"];
  onClose: () => void;
  onSave: (name: string) => void;
  onChangeName: (name: string) => void;
}

export const NewFileModal: React.FC<NewFileModalProps> = ({
  newFileModal,
  fm,
  onClose,
  onSave,
  onChangeName,
}) => {
  if (!newFileModal) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="bg-popover border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground">{fm.newFile}</h3>
        <div>
          <label className="text-2xs text-muted-foreground mb-1 block">
            {fm.fileNamePrompt}
          </label>
          <input
            type="text"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            value={newFileModal.name}
            onChange={(e) => onChangeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFileModal.name.trim()) {
                onSave(newFileModal.name.trim());
              }
            }}
            className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium rounded-md bg-surface border border-border hover:bg-surface-secondary text-foreground transition-colors"
          >
            {fm.close}
          </button>
          <button
            onClick={() => {
              if (newFileModal.name.trim()) {
                onSave(newFileModal.name.trim());
              }
            }}
            className="px-3 py-1 text-xs font-medium rounded-md bg-primary hover:bg-primary/90 text-white transition-colors"
          >
            {fm.save}
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  deleteModal: { items: ContainerFileItem[] } | null;
  isDeleting: boolean;
  fm: Translations["containers"]["fileManager"];
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  deleteModal,
  isDeleting,
  fm,
  onClose,
  onConfirm,
}) => {
  if (!deleteModal) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="bg-popover border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground">
          {fm.confirmDeleteTitle}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {deleteModal.items.length === 1 ? (
            <>
              {fm.confirmDeleteDesc}{" "}
              <span className="font-mono text-rose-500 font-semibold">
                {deleteModal.items[0].name}
              </span>
              ?
            </>
          ) : (
            <>
              {fm.confirmDeleteDesc}{" "}
              <span className="font-mono text-rose-500 font-semibold">
                {deleteModal.items.length} files
              </span>
              ?
            </>
          )}
        </p>
        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium rounded-md bg-surface border border-border hover:bg-surface-secondary text-foreground transition-colors"
          >
            {fm.close}
          </button>
          <button
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-3 py-1 text-xs font-medium rounded-md bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white transition-colors flex items-center space-x-1.5"
          >
            {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
            <span>{fm.delete}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
