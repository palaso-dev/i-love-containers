import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X, Search, Layers } from "lucide-react";

interface ServiceFilterPopoverProps {
  availableServices: string[];
  activeServices: string[] | null | undefined;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onInvert: () => void;
  onToggle: (service: string) => void;
  onSolo: (service: string) => void;
  isEs?: boolean;
  align?: "left" | "right";
}

export const ServiceFilterPopover: React.FC<ServiceFilterPopoverProps> = ({
  availableServices,
  activeServices,
  onSelectAll,
  onDeselectAll,
  onInvert,
  onToggle,
  onSolo,
  isEs = false,
  align = "left",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (availableServices.length <= 1) {
    return null;
  }

  const isAll = activeServices === null || activeServices === undefined;
  const currentActive = isAll
    ? availableServices
    : availableServices.filter((s) => activeServices.includes(s));
  const activeCount = currentActive.length;
  const isSolo = activeCount === 1 && !isAll;
  const soloName = isSolo ? currentActive[0] : null;

  const visibleServices = query.trim()
    ? availableServices.filter((s) =>
        s.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : availableServices;

  return (
    <div className="relative inline-block text-left shrink-0" ref={popoverRef}>
      <div className="inline-flex items-center rounded-md border text-2xs font-mono transition-colors shadow-2xs">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`inline-flex items-center space-x-1.5 px-2 py-1 rounded-l-md transition-colors cursor-pointer ${
            !isAll
              ? "bg-primary/10 border-primary/30 text-primary font-semibold"
              : "bg-surface-secondary border-border text-foreground hover:bg-surface-hover"
          } ${isSolo ? "border-r-0" : "rounded-r-md"}`}
          title={isEs ? "Filtrar servicios" : "Filter services"}
        >
          <Layers className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[120px]">
            {isSolo
              ? soloName
              : `${isEs ? "Servicios" : "Services"} (${activeCount}/${availableServices.length})`}
          </span>
          <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
        </button>
        {isSolo && (
          <button
            type="button"
            onClick={onSelectAll}
            className="px-1.5 py-1 rounded-r-md border-l border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
            title={isEs ? "Ver todos" : "Show all"}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 w-60 rounded-lg border border-border bg-surface p-2 shadow-xl flex flex-col gap-1.5 font-mono text-2xs ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-muted-foreground absolute left-2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isEs ? "Filtrar..." : "Filter..."}
              className="w-full pl-6 pr-5 py-1 text-2xs bg-surface-secondary border border-border rounded text-foreground focus:outline-none"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-1 py-0.5 text-[11px] text-muted-foreground border-b border-border/60">
            <span className="font-semibold">
              {activeCount}/{availableServices.length}
            </span>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={onSelectAll}
                className="hover:text-primary transition-colors cursor-pointer"
              >
                {isEs ? "Todos" : "All"}
              </button>
              <span className="opacity-40">·</span>
              <button
                type="button"
                onClick={onDeselectAll}
                className="hover:text-primary transition-colors cursor-pointer"
              >
                {isEs ? "Ninguno" : "None"}
              </button>
              <span className="opacity-40">·</span>
              <button
                type="button"
                onClick={onInvert}
                className="hover:text-primary transition-colors cursor-pointer"
              >
                {isEs ? "Invertir" : "Invert"}
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5 py-0.5 visible-scrollbar">
            {visibleServices.length === 0 ? (
              <div className="py-3 text-center text-muted-foreground">
                {isEs ? "Sin resultados" : "No results"}
              </div>
            ) : (
              visibleServices.map((service) => {
                const active = isAll || activeServices.includes(service);
                return (
                  <div
                    key={service}
                    className="group flex items-center justify-between px-1.5 py-1 rounded hover:bg-surface-secondary transition-colors"
                  >
                    <div
                      onClick={() => onToggle(service)}
                      className="flex items-center space-x-2 flex-1 min-w-0 cursor-pointer"
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center border ${
                          active
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-surface-secondary"
                        }`}
                      >
                        {active && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span
                        className={`truncate ${
                          active
                            ? "text-foreground font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {service}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSolo(service)}
                      className="opacity-0 group-hover:opacity-100 px-1 py-0.5 text-[9px] uppercase tracking-wider rounded text-muted-foreground hover:text-primary hover:bg-primary/20 transition-all cursor-pointer shrink-0 ml-1"
                    >
                      solo
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
