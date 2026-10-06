import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Translations } from "@/lib/i18n";
import { ComposeNetworkNode } from "@/lib/composeParser";

interface ComposeCanvasToolbarProps {
  projectName: string;
  servicesCount: number;
  networks: ComposeNetworkNode[];
  volumesCount: number;
  zoom: number;
  t: Translations;
  isActive?: boolean;
  onResetView: () => void;
  onFitView: () => void;
  onZoomStep: (factor: number) => void;
  onHoverNetwork: (networkId: string | null) => void;
}

export const ComposeCanvasToolbar: React.FC<ComposeCanvasToolbarProps> = ({
  projectName,
  servicesCount,
  networks,
  volumesCount,
  zoom,
  t,
  isActive,
  onResetView,
  onFitView,
  onZoomStep,
  onHoverNetwork,
}) => {
  return (
    <>
      <div className="absolute top-3 right-3 z-20 flex items-center space-x-1 bg-surface/90 backdrop-blur-xl border border-border/80 p-1 rounded-xl shadow-mac-segment canvas-interactive">
        <button
          onClick={onResetView}
          className="px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
          title={t.compose.autoArrange}
        >
          {t.compose.autoArrange}
        </button>
        <div className="w-[1px] h-3.5 bg-border/80" />
        <button
          onClick={() => onZoomStep(1.2)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
          title={t.compose.zoomIn}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-mono text-muted-foreground px-1 min-w-[38px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => onZoomStep(1 / 1.2)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
          title={t.compose.zoomOut}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <div className="w-[1px] h-3.5 bg-border/80" />
        <button
          onClick={onFitView}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
          title={t.compose.resetZoom}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 max-w-lg pointer-events-none">
        <div className="bg-surface/90 backdrop-blur-xl border border-border/80 px-3 py-1.5 rounded-xl shadow-mac-segment pointer-events-auto flex items-center space-x-2 text-xs">
          <span className="font-semibold text-foreground tracking-tight">
            {projectName}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isActive
                ? "bg-status-running shadow-[0_0_6px_rgba(48,209,88,0.7)]"
                : "bg-muted-foreground/40"
            }`}
          />
          <span className="text-[11px] text-muted-foreground font-mono">
            {servicesCount} {t.compose.servicesCount} • {networks.length}{" "}
            {t.compose.networksCount} • {volumesCount} {t.compose.volumesCount}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 pointer-events-auto">
          {networks.map((net) => (
            <div
              key={net.id}
              onMouseEnter={() => onHoverNetwork(net.id)}
              onMouseLeave={() => onHoverNetwork(null)}
              className="bg-surface/80 backdrop-blur-sm border border-border/70 px-2 py-0.5 rounded-lg text-[10px] font-mono text-foreground/80 flex items-center space-x-1.5 shadow-2xs hover:border-foreground/40 transition-colors cursor-default"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: net.color }}
              />
              <span>{net.name}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
