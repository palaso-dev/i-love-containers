import React, { useState, useEffect } from "react";
import {
  Server,
  Plus,
  Trash2,
  Cpu,
  RotateCw,
  Globe,
  HardDrive,
  Link,
  Terminal,
  Layers,
  Box,
  Save,
  RotateCcw,
  Sliders,
  Check,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import {
  ComposeServiceConfig,
  ParsedComposeFile,
} from "@/lib/composeYamlHelper";
import { DirectiveAutocompleteInput } from "./DirectiveAutocompleteInput";

interface ComposeServiceFormProps {
  parsedConfig: ParsedComposeFile;
  onUpdateConfig: (updatedConfig: ParsedComposeFile) => void;
  onOpenBulkModal: () => void;
}

export const ComposeServiceForm: React.FC<ComposeServiceFormProps> = ({
  parsedConfig,
  onUpdateConfig,
  onOpenBulkModal,
}) => {
  const { t } = useAppStore();

  const [draftConfig, setDraftConfig] =
    useState<ParsedComposeFile>(parsedConfig);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!hasChanges) {
      setDraftConfig(parsedConfig);
    }
  }, [parsedConfig, hasChanges]);

  const services = draftConfig.services;
  const currentService = services[selectedServiceIndex] || services[0];

  const updateCurrentService = (
    updater: (svc: ComposeServiceConfig) => void,
  ) => {
    const updatedServices = [...services];
    const original = updatedServices[selectedServiceIndex];
    const target: ComposeServiceConfig = {
      ...original,
      ports: [...(original.ports || [])],
      environment: [...(original.environment || [])],
      customDirectives: (original.customDirectives || []).map((d) => ({
        ...d,
      })),
      networks: [...(original.networks || [])],
      depends_on: [...(original.depends_on || [])],
      volumes: [...(original.volumes || [])],
    };
    updater(target);
    updatedServices[selectedServiceIndex] = target;
    setDraftConfig({
      ...draftConfig,
      services: updatedServices,
    });
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleSaveAndApply = () => {
    onUpdateConfig(draftConfig);
    setHasChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleDiscardChanges = () => {
    setDraftConfig(parsedConfig);
    setHasChanges(false);
  };

  const handleAddService = () => {
    const baseName = "new-service";
    let counter = 1;
    while (services.some((s) => s.name === `${baseName}-${counter}`)) {
      counter++;
    }
    const newName = `${baseName}-${counter}`;
    const newService: ComposeServiceConfig = {
      name: newName,
      image: "alpine:latest",
      restart: "unless-stopped",
      ports: [],
      environment: [],
      depends_on: [],
      networks:
        draftConfig.availableNetworks.length > 0
          ? [draftConfig.availableNetworks[0]]
          : [],
      volumes: [],
      customDirectives: [],
    };

    const updated = [...services, newService];
    setDraftConfig({
      ...draftConfig,
      services: updated,
    });
    setSelectedServiceIndex(updated.length - 1);
    setHasChanges(true);
  };

  const handleRemoveService = (index: number) => {
    if (services.length <= 1) return;
    const removedName = services[index].name;
    const updated = services
      .filter((_, idx) => idx !== index)
      .map((s) => ({
        ...s,
        depends_on: s.depends_on
          ? s.depends_on.filter((dep) => dep !== removedName)
          : [],
      }));

    setDraftConfig({
      ...draftConfig,
      services: updated,
    });
    setSelectedServiceIndex(Math.max(0, index - 1));
    setHasChanges(true);
  };

  if (!currentService) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>
          {t.compose.noServicesFound ||
            "No services found in this Compose file."}
        </p>
        <button
          onClick={handleAddService}
          className="mt-3 px-3 py-1.5 bg-primary text-white text-xs rounded-lg shadow-xs hover:opacity-90"
        >
          {t.compose.createFirstService || "Create first service"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 w-full flex flex-col md:flex-row h-full overflow-hidden bg-surface/80 backdrop-blur-xl border border-border/80 rounded-2xl shadow-mac-segment">
      <div className="w-full md:w-52 border-r border-border/70 flex flex-col bg-surface-secondary/40 shrink-0">
        <div className="p-3 border-b border-border/70 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
            <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">
              {t.compose.servicesListTitle || "Services"} ({services.length})
            </span>
          </span>
          <button
            onClick={handleAddService}
            className="p-1 rounded-md text-primary hover:bg-surface border border-border/60 hover:border-primary/40 transition-colors shrink-0"
            title={t.compose.addService || "Add Service"}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-2 space-y-1 overflow-y-auto flex-1 text-xs">
          {services.map((svc, idx) => {
            const isSelected = idx === selectedServiceIndex;
            return (
              <button
                key={svc.name + idx}
                type="button"
                onClick={() => setSelectedServiceIndex(idx)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all border ${
                  isSelected
                    ? "bg-primary/10 border-primary/40 text-foreground font-semibold shadow-2xs"
                    : "bg-surface/50 border-transparent hover:border-border/60 hover:bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center space-x-2 truncate min-w-0">
                  <Box
                    className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="truncate font-mono text-2xs">
                    {svc.name}
                  </span>
                </div>
                {svc.restart && (
                  <span className="text-[9px] font-mono text-muted-foreground/70 bg-surface-secondary px-1 rounded shrink-0 ml-1">
                    {svc.restart}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-2.5 border-t border-border/70 bg-surface-secondary/60">
          <button
            type="button"
            onClick={onOpenBulkModal}
            className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-lg text-2xs font-semibold transition-all shadow-xs"
          >
            <span>⚡ {t.compose.bulkOptions || "Bulk Options"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto overflow-x-hidden p-5 space-y-5 text-xs bg-background">
        {hasChanges && (
          <div className="sticky top-0 z-30 px-5 py-2.5 bg-amber-500/15 border-b border-amber-500/30 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 shadow-xs animate-in fade-in duration-100">
            <div className="flex items-center space-x-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="text-foreground font-medium">
                {t.compose.hasUnsavedChanges ||
                  "There are unsaved changes in services"}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="flex items-center space-x-1 px-2.5 py-1 text-2xs font-medium rounded-lg text-muted-foreground hover:text-foreground bg-surface border border-border transition-colors shadow-2xs"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t.compose.discardChanges || "Discard"}</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAndApply}
                className="flex items-center space-x-1.5 px-3 py-1 text-2xs font-semibold rounded-lg bg-primary text-white hover:opacity-90 transition-opacity shadow-xs"
              >
                <Save className="w-3 h-3" />
                <span>{t.compose.saveChanges || "Save Changes"}</span>
              </button>
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 text-2xs font-medium animate-in fade-in duration-100">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>
              {t.compose.savedSuccess || "Changes saved to YAML and diagram!"}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div className="min-w-0">
            <div className="flex items-center space-x-2 truncate">
              <span className="text-sm font-semibold font-mono text-foreground truncate">
                {currentService.name}
              </span>
              {currentService.platform && (
                <span className="text-2xs font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.2 rounded-full shrink-0">
                  {currentService.platform}
                </span>
              )}
            </div>
            <p className="text-2xs font-mono text-muted-foreground mt-0.5 truncate">
              {currentService.image || "--"}
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveAndApply}
              disabled={!hasChanges}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all shadow-xs ${
                hasChanges
                  ? "bg-primary text-white hover:opacity-90 shadow-primary/20"
                  : "bg-surface-secondary text-muted-foreground opacity-50 cursor-not-allowed border border-border/60"
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t.compose.saveChanges || "Save"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleRemoveService(selectedServiceIndex)}
              disabled={services.length <= 1}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-status-danger hover:bg-status-danger/10 border border-status-danger/30 transition-colors disabled:opacity-40"
              title={
                t.compose.deleteServiceTitle ||
                "Delete this service from Compose"
              }
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {t.compose.deleteService || "Delete"}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="block text-2xs font-semibold text-muted-foreground mb-1">
              {t.compose.serviceNameInYaml || "Service Name in YAML"}
            </label>
            <input
              type="text"
              value={currentService.name}
              onChange={(e) =>
                updateCurrentService((s) => (s.name = e.target.value))
              }
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full px-3 py-1.5 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary shadow-xs min-w-0"
              placeholder="proxy, web, backend..."
            />
          </div>

          <div className="min-w-0">
            <label className="block text-2xs font-semibold text-muted-foreground mb-1">
              {t.compose.dockerImage || "Docker Image (`image`)"}
            </label>
            <input
              type="text"
              value={currentService.image || ""}
              onChange={(e) =>
                updateCurrentService((s) => (s.image = e.target.value))
              }
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full px-3 py-1.5 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary shadow-xs min-w-0"
              placeholder="nginx:alpine, postgres:16..."
            />
          </div>

          <div className="min-w-0">
            <label className="block text-2xs font-semibold text-muted-foreground mb-1">
              {t.compose.containerName || "Container Name (`container_name`)"}
            </label>
            <input
              type="text"
              value={currentService.container_name || ""}
              onChange={(e) =>
                updateCurrentService(
                  (s) => (s.container_name = e.target.value || undefined),
                )
              }
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full px-3 py-1.5 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary shadow-xs min-w-0"
              placeholder="proxy_app"
            />
          </div>

          <div className="min-w-0">
            <label className="block text-2xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <Terminal className="w-3 h-3 text-muted-foreground" />
              <span>{t.compose.commandLabel || "Command (`command`)"}</span>
            </label>
            <input
              type="text"
              value={currentService.command || ""}
              onChange={(e) =>
                updateCurrentService(
                  (s) => (s.command = e.target.value || undefined),
                )
              }
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full px-3 py-1.5 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary shadow-xs min-w-0"
              placeholder="npm start, /bin/sh..."
            />
          </div>
        </div>

        <div className="p-3.5 bg-surface-secondary/40 border border-border/70 rounded-xl space-y-3 min-w-0">
          <h4 className="text-2xs font-semibold text-foreground tracking-wide uppercase flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>
              {t.compose.runtimePolicies || "Runtime Policies & Platform"}
            </span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="min-w-0">
              <label className="block text-2xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <RotateCw className="w-3 h-3 text-emerald-400" />
                <span>
                  {t.compose.restartPolicy || "Restart Policy (`restart`)"}
                </span>
              </label>
              <select
                value={currentService.restart || "no"}
                onChange={(e) =>
                  updateCurrentService((s) => {
                    const val = e.target.value;
                    s.restart = val === "none" ? undefined : val;
                  })
                }
                className="w-full px-3 py-1.5 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary cursor-pointer shadow-xs min-w-0"
              >
                <option value="always">
                  {t.compose.restartAlways || "always (Always restart)"}
                </option>
                <option value="unless-stopped">
                  {t.compose.restartUnlessStopped ||
                    "unless-stopped (Unless stopped manually)"}
                </option>
                <option value="on-failure">
                  {t.compose.restartOnFailure || "on-failure (On errors only)"}
                </option>
                <option value="no">
                  {t.compose.restartNo || "no (Do not restart automatically)"}
                </option>
                <option value="none">
                  {t.compose.restartNone || "-- Not specified --"}
                </option>
              </select>
            </div>

            <div className="min-w-0 space-y-1.5">
              <label className="block text-2xs font-semibold text-muted-foreground flex items-center gap-1">
                <Cpu className="w-3 h-3 text-sky-400" />
                <span>
                  {t.compose.platformArch ||
                    "Platform / Architecture (`platform`)"}
                </span>
              </label>

              <select
                value={
                  [
                    "linux/amd64",
                    "linux/arm64",
                    "linux/arm/v7",
                    "linux/386",
                  ].includes(currentService.platform || "")
                    ? currentService.platform
                    : currentService.platform
                      ? "custom"
                      : "none"
                }
                onChange={(e) => {
                  const val = e.target.value;
                  updateCurrentService((s) => {
                    if (val === "none") s.platform = undefined;
                    else if (val === "custom") s.platform = "linux/amd64";
                    else s.platform = val;
                  });
                }}
                className="w-full px-3 py-1.5 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary cursor-pointer shadow-xs min-w-0"
              >
                <option value="none">
                  {t.compose.platformDefault || "-- Default / Native --"}
                </option>
                <option value="linux/amd64">linux/amd64 (x86_64)</option>
                <option value="linux/arm64">
                  linux/arm64 (Apple Silicon / ARM)
                </option>
                <option value="linux/arm/v7">linux/arm/v7</option>
                <option value="linux/386">linux/386</option>
                <option value="custom">
                  {t.compose.platformCustom || "Custom..."}
                </option>
              </select>

              {(![
                "none",
                "linux/amd64",
                "linux/arm64",
                "linux/arm/v7",
                "linux/386",
              ].includes(currentService.platform || "none") ||
                currentService.platform === "custom") && (
                <input
                  type="text"
                  value={currentService.platform || ""}
                  onChange={(e) =>
                    updateCurrentService(
                      (s) => (s.platform = e.target.value || undefined),
                    )
                  }
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="ej: linux/amd64, linux/riscv64..."
                  className="w-full px-3 py-1 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary shadow-xs min-w-0"
                />
              )}
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-surface-secondary/40 border border-border/70 rounded-xl space-y-2 min-w-0">
          <div className="flex items-center justify-between">
            <label className="text-2xs font-semibold text-foreground tracking-wide uppercase flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-primary" />
              <span>{t.compose.portMapping || "Port Mapping (`ports`)"}</span>
            </label>
            <button
              type="button"
              onClick={() =>
                updateCurrentService((s) => {
                  s.ports = s.ports || [];
                  s.ports.push("8080:80");
                })
              }
              className="text-2xs text-primary hover:underline font-mono flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>{t.compose.addPort || "Add port"}</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {(!currentService.ports || currentService.ports.length === 0) && (
              <p className="text-2xs text-muted-foreground italic">
                {t.compose.noPorts || "No exposed ports"}
              </p>
            )}
            {currentService.ports?.map((port, pIdx) => (
              <div key={pIdx} className="flex items-center space-x-2 min-w-0">
                <input
                  type="text"
                  value={port}
                  onChange={(e) =>
                    updateCurrentService((s) => {
                      if (s.ports) s.ports[pIdx] = e.target.value;
                    })
                  }
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="flex-1 px-2.5 py-1 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary shadow-xs min-w-0"
                  placeholder="host:container (ej: 80:80)"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateCurrentService((s) => {
                      if (s.ports) s.ports.splice(pIdx, 1);
                    })
                  }
                  className="p-1 rounded-md text-muted-foreground hover:text-status-danger transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3.5 bg-surface-secondary/40 border border-border/70 rounded-xl space-y-2 min-w-0">
          <div className="flex items-center justify-between">
            <label className="text-2xs font-semibold text-foreground tracking-wide uppercase flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {t.compose.envVars || "Environment Variables (`environment`)"}
              </span>
            </label>
            <button
              type="button"
              onClick={() =>
                updateCurrentService((s) => {
                  s.environment = s.environment || [];
                  s.environment.push("KEY=value");
                })
              }
              className="text-2xs text-primary hover:underline font-mono flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>{t.compose.addEnvVar || "Add variable"}</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {(!currentService.environment ||
              currentService.environment.length === 0) && (
              <p className="text-2xs text-muted-foreground italic">
                {t.compose.noEnvVars || "No environment variables defined"}
              </p>
            )}
            {currentService.environment?.map((envStr, eIdx) => {
              const colonPos = envStr.indexOf("=");
              const key = colonPos !== -1 ? envStr.slice(0, colonPos) : envStr;
              const val = colonPos !== -1 ? envStr.slice(colonPos + 1) : "";

              return (
                <div key={eIdx} className="flex items-center space-x-2 min-w-0">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) =>
                      updateCurrentService((s) => {
                        if (s.environment)
                          s.environment[eIdx] = `${e.target.value}=${val}`;
                      })
                    }
                    placeholder="KEY"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-1/3 px-2.5 py-1 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary shadow-xs min-w-0"
                  />
                  <span className="text-muted-foreground font-mono">=</span>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) =>
                      updateCurrentService((s) => {
                        if (s.environment)
                          s.environment[eIdx] = `${key}=${e.target.value}`;
                      })
                    }
                    placeholder="value"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="flex-1 px-2.5 py-1 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary shadow-xs min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateCurrentService((s) => {
                        if (s.environment) s.environment.splice(eIdx, 1);
                      })
                    }
                    className="p-1 rounded-md text-muted-foreground hover:text-status-danger transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3.5 bg-surface-secondary/40 border border-border/70 rounded-xl space-y-2.5 min-w-0">
          <div className="flex items-center justify-between">
            <label className="text-2xs font-semibold text-foreground tracking-wide uppercase flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-primary" />
              <span>
                {t.compose.customDirectivesTitle || "Additional Directives"}
              </span>
            </label>
            <button
              type="button"
              onClick={() =>
                updateCurrentService((s) => {
                  s.customDirectives = s.customDirectives || [];
                  s.customDirectives.push({ key: "", value: "" });
                })
              }
              className="text-2xs text-primary hover:underline font-mono flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>{t.compose.addDirective || "Add directive"}</span>
            </button>
          </div>

          <div className="space-y-1.5 pt-0.5">
            {(!currentService.customDirectives ||
              currentService.customDirectives.length === 0) && (
              <p className="text-2xs text-muted-foreground italic">
                {t.compose.noCustomDirectives ||
                  "No additional directives added."}
              </p>
            )}
            {currentService.customDirectives?.map((directive, dIdx) => (
              <div key={dIdx} className="flex items-center space-x-2 min-w-0">
                <DirectiveAutocompleteInput
                  value={directive.key}
                  onChange={(newKey) =>
                    updateCurrentService((s) => {
                      if (s.customDirectives)
                        s.customDirectives[dIdx].key = newKey;
                    })
                  }
                  onSelectSuggestion={(selectedKey, defaultVal) => {
                    updateCurrentService((s) => {
                      if (s.customDirectives) {
                        s.customDirectives[dIdx].key = selectedKey;
                        if (!s.customDirectives[dIdx].value && defaultVal) {
                          s.customDirectives[dIdx].value = defaultVal;
                        }
                      }
                    });
                  }}
                  placeholder="directive (e.g. privileged)"
                  className="w-full px-2.5 py-1 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary shadow-xs min-w-0"
                />
                <span className="text-muted-foreground font-mono">:</span>
                <input
                  type="text"
                  value={directive.value}
                  onChange={(e) =>
                    updateCurrentService((s) => {
                      if (s.customDirectives)
                        s.customDirectives[dIdx].value = e.target.value;
                    })
                  }
                  placeholder="value"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="flex-1 px-2.5 py-1 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary shadow-xs min-w-0"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateCurrentService((s) => {
                      if (s.customDirectives)
                        s.customDirectives.splice(dIdx, 1);
                    })
                  }
                  className="p-1 rounded-md text-muted-foreground hover:text-status-danger transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
          <div className="p-3.5 bg-surface-secondary/40 border border-border/70 rounded-xl space-y-2 min-w-0">
            <label className="text-2xs font-semibold text-foreground tracking-wide uppercase flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span>{t.compose.networksTitle || "Networks (`networks`)"}</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {draftConfig.availableNetworks.map((net) => {
                const isAttached = currentService.networks?.includes(net);
                return (
                  <button
                    key={net}
                    type="button"
                    onClick={() =>
                      updateCurrentService((s) => {
                        s.networks = s.networks || [];
                        if (s.networks.includes(net)) {
                          s.networks = s.networks.filter((n) => n !== net);
                        } else {
                          s.networks.push(net);
                        }
                      })
                    }
                    className={`px-2.5 py-1 rounded-lg text-2xs font-mono border transition-all ${
                      isAttached
                        ? "bg-purple-500/15 border-purple-500/40 text-purple-400 font-semibold shadow-2xs"
                        : "bg-surface border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isAttached ? "✓ " : "+ "}
                    {net}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3.5 bg-surface-secondary/40 border border-border/70 rounded-xl space-y-2 min-w-0">
            <label className="text-2xs font-semibold text-foreground tracking-wide uppercase flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {t.compose.dependsOnTitle || "Dependencies (`depends_on`)"}
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {services
                .filter((s) => s.name !== currentService.name)
                .map((peer) => {
                  const isDep = currentService.depends_on?.includes(peer.name);
                  return (
                    <button
                      key={peer.name}
                      type="button"
                      onClick={() =>
                        updateCurrentService((s) => {
                          s.depends_on = s.depends_on || [];
                          if (s.depends_on.includes(peer.name)) {
                            s.depends_on = s.depends_on.filter(
                              (d) => d !== peer.name,
                            );
                          } else {
                            s.depends_on.push(peer.name);
                          }
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-2xs font-mono border transition-all ${
                        isDep
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-semibold shadow-2xs"
                          : "bg-surface border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isDep ? "✓ " : "+ "}
                      {peer.name}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-surface-secondary/40 border border-border/70 rounded-xl space-y-2 min-w-0">
          <div className="flex items-center justify-between">
            <label className="text-2xs font-semibold text-foreground tracking-wide uppercase flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {t.compose.volumesTitle || "Mounted Volumes (`volumes`)"}
              </span>
            </label>
            <button
              type="button"
              onClick={() =>
                updateCurrentService((s) => {
                  s.volumes = s.volumes || [];
                  s.volumes.push("data_vol:/data");
                })
              }
              className="text-2xs text-primary hover:underline font-mono flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>{t.compose.addVolume || "Add volume"}</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {(!currentService.volumes ||
              currentService.volumes.length === 0) && (
              <p className="text-2xs text-muted-foreground italic">
                {t.compose.noVolumes || "No volumes mounted"}
              </p>
            )}
            {currentService.volumes?.map((vol, vIdx) => (
              <div key={vIdx} className="flex items-center space-x-2 min-w-0">
                <input
                  type="text"
                  value={vol}
                  onChange={(e) =>
                    updateCurrentService((s) => {
                      if (s.volumes) s.volumes[vIdx] = e.target.value;
                    })
                  }
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="flex-1 px-2.5 py-1 text-xs font-mono bg-surface border border-border/70 rounded-lg text-foreground focus:outline-none focus:border-primary shadow-xs min-w-0"
                  placeholder="volume_name:/data"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateCurrentService((s) => {
                      if (s.volumes) s.volumes.splice(vIdx, 1);
                    })
                  }
                  className="p-1 rounded-md text-muted-foreground hover:text-status-danger transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-border/70 flex items-center justify-between">
          <span className="text-2xs text-muted-foreground">
            {hasChanges
              ? t.compose.pendingApply || "You have pending changes to apply"
              : t.compose.allSaved || "All configurations are saved"}
          </span>

          <div className="flex items-center space-x-2">
            {hasChanges && (
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-surface border border-border transition-colors shadow-2xs"
              >
                {t.compose.discardChanges || "Discard"}
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveAndApply}
              disabled={!hasChanges}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs ${
                hasChanges
                  ? "bg-primary text-white hover:opacity-90 shadow-primary/20"
                  : "bg-surface-secondary text-muted-foreground opacity-50 cursor-not-allowed border border-border/60"
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t.compose.saveChanges || "Save Changes"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
