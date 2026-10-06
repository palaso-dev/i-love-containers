import React, { useState, useEffect } from "react";
import { getErrorMessage } from "@/lib/utils";
import { Play, X, RotateCw, AlertCircle } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import {
  getCustomComposeConfig,
  saveCustomComposeConfig,
} from "@/lib/composeCustomStorage";

interface ComposeCustomRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  workingDir?: string;
  configFile?: string;
  onSuccess?: () => void;
}

export const ComposeCustomRunModal: React.FC<ComposeCustomRunModalProps> = ({
  isOpen,
  onClose,
  projectName,
  workingDir,
  configFile,
  onSuccess,
}) => {
  const { t, upComposeProject, refreshData } = useAppStore();

  const [command, setCommand] = useState("");
  const [useAsDefault, setUseAsDefault] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && projectName) {
      const saved = getCustomComposeConfig(projectName);
      setCommand(saved.command || "");
      setUseAsDefault(saved.useAsDefault);
      setErrorMsg(null);
    }
  }, [isOpen, projectName]);

  if (!isOpen) return null;

  const handleSaveOnly = () => {
    saveCustomComposeConfig(projectName, {
      command: command.trim(),
      useAsDefault,
    });
    onClose();
  };

  const handleExecute = async () => {
    const trimmed = command.trim();
    if (!trimmed || isRunning) return;

    saveCustomComposeConfig(projectName, {
      command: trimmed,
      useAsDefault,
    });

    setIsRunning(true);
    setErrorMsg(null);

    try {
      const res = await upComposeProject(
        projectName,
        workingDir,
        configFile,
        trimmed,
      );
      if (res.ok) {
        await refreshData();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(res.stderr || "Error executing command");
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err) || "Execution failed");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        className="relative z-10 bg-popover text-foreground border border-popover-border rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
              <Play className="w-3 h-3 text-purple-400 fill-current" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {t.compose.customPlayTitle || "Custom Play"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
              {t.compose.customPlayCommand || "Comando"}
            </label>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={
                t.compose.customPlayPlaceholder ||
                "docker compose -f docker-compose.yml -f override.yml up -d --build"
              }
              rows={3}
              className="w-full p-2.5 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500/50 transition-all shadow-xs resize-none"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center space-x-2.5 text-xs font-medium text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useAsDefault}
                onChange={(e) => setUseAsDefault(e.target.checked)}
                className="w-4 h-4 rounded border-border/80 bg-surface text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
              />
              <span>
                {t.compose.applyToComposeActions ||
                  "Aplicar a las acciones de Compose"}
              </span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/30 rounded-lg text-xs font-mono text-status-danger flex items-start space-x-2 max-h-32 overflow-y-auto">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <pre className="whitespace-pre-wrap break-all leading-tight">
                {errorMsg}
              </pre>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            {t.compose.cancelRaw || "Cancelar"}
          </button>
          <button
            type="button"
            onClick={handleSaveOnly}
            disabled={isRunning}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border/80 hover:bg-surface-secondary text-foreground transition-colors cursor-pointer shadow-xs"
          >
            {t.compose.save || "Guardar"}
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isRunning}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t.compose.executing || "Ejecutando..."}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t.compose.run || "Ejecutar"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
