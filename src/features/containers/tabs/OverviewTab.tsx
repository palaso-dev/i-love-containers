import React, { useState, useEffect, useRef } from "react";
import { ContainerDetail } from "@/types";
import { Copy, Check, Layers, ExternalLink } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { InspectTab } from "./InspectTab";
import { fetchContainer } from "@/lib/api";
import { openExternalUrl } from "@/lib/nativeWindow";


interface OverviewTabProps {
  container: ContainerDetail;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ container }) => {
  const { images, setActiveTab, setSelectedImageId, t } = useAppStore();
  const ot = t.containers.overviewTab;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContainerDetail>(container);
  const containerRef = useRef(container);
  containerRef.current = container;
  const containerId = container.id;

  useEffect(() => {
    let isMounted = true;
    const current = containerRef.current;
    setDetail((prev) => (prev.id === current.id ? prev : current));

    fetchContainer(containerId).then((full) => {
      if (isMounted && full) {
        setDetail((prev) => {
          if (prev.id !== containerId) return prev;
          return {
            ...prev,
            ...full,
            ports:
              full.ports && full.ports.length > 0 ? full.ports : prev.ports,
            mounts:
              full.mounts && full.mounts.length > 0 ? full.mounts : prev.mounts,
            env: full.env && full.env.length > 0 ? full.env : prev.env,
            rawInspectJson: full.rawInspectJson || prev.rawInspectJson,
          };
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [containerId]);

  useEffect(() => {
    setDetail((prev) => {
      if (prev.id !== container.id) return prev;
      if (prev.status === container.status && prev.state === container.state)
        return prev;
      return {
        ...prev,
        status: container.status,
        state: container.state,
      };
    });
  }, [container.id, container.status, container.state]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleGoToImage = () => {
    const targetImg = images.find(
      (img) =>
        img.id === detail.imageId ||
        `${img.repository}:${img.tag}` === detail.image ||
        img.repository === detail.image.split(":")[0],
    );
    setActiveTab("images");
    if (targetImg) {
      setSelectedImageId(targetImg.id);
    }
  };

  return (
    <div className="space-y-4 select-text">
      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider mb-3 select-none">
          {ot.configMetadata}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60">
            <span className="text-muted-foreground block text-[11px] font-sans font-medium uppercase select-none">
              {ot.containerId}
            </span>
            <div className="flex items-center justify-between mt-1 text-foreground">
              <span className="truncate text-xs select-text">{detail.id}</span>
              <button
                onClick={() => copyToClipboard(detail.id, "id")}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-colors ml-2 select-none shrink-0"
              >
                {copiedKey === "id" ? (
                  <Check className="w-3.5 h-3.5 text-status-running" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60">
            <div className="flex items-center justify-between select-none">
              <span className="text-muted-foreground block text-[11px] font-sans font-medium uppercase">
                {ot.imageHash}
              </span>
              <button
                onClick={handleGoToImage}
                className="text-primary hover:underline text-[11px] font-sans font-medium flex items-center space-x-1"
                title={ot.viewImage}
              >
                <Layers className="w-3 h-3 text-sky-400" />
                <span>{ot.viewImage}</span>
              </button>
            </div>
            <div className="flex items-center justify-between mt-1 text-foreground">
              <span className="truncate text-xs select-text">
                {detail.imageId}
              </span>
              <button
                onClick={() => copyToClipboard(detail.imageId, "image")}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-colors ml-2 select-none shrink-0"
              >
                {copiedKey === "image" ? (
                  <Check className="w-3.5 h-3.5 text-status-running" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60">
            <span className="text-muted-foreground block text-[11px] font-sans font-medium uppercase select-none">
              {ot.uptimeStatus}
            </span>
            <span className="text-foreground text-xs block mt-1 select-text">
              {detail.status}
            </span>
          </div>

          <div className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60">
            <span className="text-muted-foreground block text-[11px] font-sans font-medium uppercase select-none">
              {ot.restartPolicy}
            </span>
            <span className="text-foreground text-xs block mt-1 select-text">
              {detail.restartPolicy || "no"}
            </span>
          </div>

          <div className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground block text-[11px] font-sans font-medium uppercase select-none">
                {ot.entrypointCommand}
              </span>
              {detail.command && (
                <button
                  onClick={() =>
                    copyToClipboard(detail.command || "", "command")
                  }
                  className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-colors select-none shrink-0"
                  title="Copiar comando"
                >
                  {copiedKey === "command" ? (
                    <Check className="w-3.5 h-3.5 text-status-running" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
            <span className="text-foreground text-xs block mt-1 truncate select-text">
              {detail.command || "default"}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider mb-3 select-none">
          {ot.portBindings}
        </h3>
        {Array.isArray(detail.ports) && detail.ports.length > 0 ? (
          <div className="divide-y divide-border/60 select-text">
            {detail.ports.map((port, index) => (
              <div
                key={index}
                className="py-2.5 flex items-center justify-between text-xs font-mono select-text"
              >
                <div className="flex items-center space-x-2 select-text">
                  <span className="px-2 py-0.5 rounded-md bg-surface-secondary border border-border/70 text-foreground font-semibold text-2xs select-none">
                    {port.type.toUpperCase()}
                  </span>
                  <span className="text-foreground select-text">
                    {port.privatePort}
                  </span>
                </div>
                <div className="text-muted-foreground select-text">
                  {port.publicPort ? (
                    <div className="flex items-center space-x-2 select-text">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-2xs font-sans font-medium select-none">
                        {ot.externalHost}
                      </span>
                      <span className="text-status-running font-semibold select-text">
                        {port.ip || "0.0.0.0"}:{port.publicPort}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          openExternalUrl(`http://localhost:${port.publicPort}`)
                        }
                        className="text-primary hover:text-primary-hover p-1 rounded hover:bg-surface transition-colors select-none"
                        title={`Abrir http://localhost:${port.publicPort} en el navegador`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `http://localhost:${port.publicPort}`,
                            `port-${index}`,
                          )
                        }
                        className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-colors select-none"
                        title="Copiar URL"
                      >
                        {copiedKey === `port-${index}` ? (
                          <Check className="w-3.5 h-3.5 text-status-running" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                  ) : (
                    <div className="flex items-center space-x-2 select-text">
                      <span className="px-2 py-0.5 rounded-md bg-surface-secondary border border-border/70 text-muted-foreground text-2xs font-sans select-none">
                        {ot.internalOnly}
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            String(port.privatePort),
                            `port-${index}`,
                          )
                        }
                        className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-colors select-none"
                        title="Copiar puerto"
                      >
                        {copiedKey === `port-${index}` ? (
                          <Check className="w-3.5 h-3.5 text-status-running" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground select-none">
            {ot.noPorts}
          </div>
        )}
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider mb-3 select-none">
          {ot.volumeMounts}
        </h3>
        {Array.isArray(detail.mounts) && detail.mounts.length > 0 ? (
          <div className="space-y-2 select-text">
            {detail.mounts.map((mount, index) => (
              <div
                key={index}
                className="bg-surface-secondary/50 p-2.5 rounded-lg border border-border/60 text-xs font-mono select-text"
              >
                <div className="flex items-center justify-between text-muted-foreground mb-1 select-none">
                  <span className="font-semibold text-foreground uppercase text-2xs">
                    {mount.type}
                  </span>
                  <span className="text-2xs">
                    {mount.rw ? ot.readWrite : ot.readOnly}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center justify-between py-0.5 select-text">
                  <div className="truncate mr-2 select-text">
                    <span className="select-none">SRC: </span>
                    <span className="text-foreground select-text">
                      {mount.source}
                    </span>
                  </div>
                  {mount.source && (
                    <button
                      onClick={() =>
                        copyToClipboard(mount.source, `src-${index}`)
                      }
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-colors select-none shrink-0"
                      title="Copiar ruta de origen"
                    >
                      {copiedKey === `src-${index}` ? (
                        <Check className="w-3.5 h-3.5 text-status-running" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
                <div className="text-muted-foreground flex items-center justify-between py-0.5 select-text">
                  <div className="truncate mr-2 select-text">
                    <span className="select-none">DST: </span>
                    <span className="text-foreground select-text">
                      {mount.destination}
                    </span>
                  </div>
                  {mount.destination && (
                    <button
                      onClick={() =>
                        copyToClipboard(mount.destination, `dst-${index}`)
                      }
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-colors select-none shrink-0"
                      title="Copiar ruta de destino"
                    >
                      {copiedKey === `dst-${index}` ? (
                        <Check className="w-3.5 h-3.5 text-status-running" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground select-none">
            {ot.noMounts}
          </div>
        )}
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3 select-none">
          <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
            {ot.environmentVariables}
          </h3>
          {detail.env && detail.env.length > 0 && (
            <button
              onClick={() => copyToClipboard(detail.env!.join("\n"), "all-env")}
              className="flex items-center space-x-1 text-xs text-muted-foreground hover:text-foreground p-1 px-2 rounded hover:bg-surface transition-colors"
              title={ot.copyAll}
            >
              {copiedKey === "all-env" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-status-running mr-1" />
                  <span className="text-status-running font-sans text-[11px]">
                    {ot.copied}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  <span className="font-sans text-[11px]">{ot.copyAll}</span>
                </>
              )}
            </button>
          )}
        </div>
        {detail.env && detail.env.length > 0 ? (
          <div className="bg-surface-secondary/50 rounded-lg border border-border/60 p-3 max-h-64 overflow-y-auto space-y-1 font-mono text-xs select-text">
            {detail.env.map((variable, index) => {
              const [key, ...values] = variable.split("=");
              const val = values.join("=");
              return (
                <div
                  key={index}
                  className="flex items-center justify-between group hover:bg-surface/60 rounded px-1.5 py-1 transition-colors select-text"
                >
                  <div className="flex items-start mr-2 select-text min-w-0 flex-1">
                    <span className="text-primary font-medium shrink-0 mr-1.5 select-text">
                      {key}=
                    </span>
                    <span className="text-muted-foreground select-text break-all">
                      {val}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(variable, `env-${index}`)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface transition-all select-none shrink-0"
                    title="Copiar variable"
                  >
                    {copiedKey === `env-${index}` ? (
                      <Check className="w-3.5 h-3.5 text-status-running" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground select-none">
            {ot.noEnv}
          </div>
        )}
      </div>

      <div className="bg-surface/80 backdrop-blur-sm border border-border/70 rounded-xl p-4 shadow-xs space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider select-none">
          {ot.inspectJson}
        </h3>
        <InspectTab container={detail} />
      </div>
    </div>
  );
};
