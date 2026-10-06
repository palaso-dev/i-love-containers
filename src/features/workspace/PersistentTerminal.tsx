import React, { useEffect, useRef } from "react";
import { getErrorMessage } from "@/lib/utils";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useAppStore } from "@/stores/useAppStore";
import { WorkspaceSession } from "@/stores/useWorkspaceStore";
import { executeContainerCommand } from "@/lib/api";
import { getTerminalTheme, formatTerminalPrompt } from "@/lib/terminalTheme";
import { setupTerminalInput, TerminalController } from "@/lib/terminalInput";

interface PersistentTerminalProps {
  session: WorkspaceSession;
  isActive: boolean;
}

export const PersistentTerminal: React.FC<PersistentTerminalProps> = ({
  session,
  isActive,
}) => {
  const { theme } = useAppStore();
  const isDark = theme === "dark";

  const terminalElementRef = useRef<HTMLDivElement>(null);
  const xtermInstanceRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentCwdRef = useRef<string>(session.terminalCwd || "/");
  const controllerRef = useRef<TerminalController | null>(null);

  const containerName = session.containerName || "host";
  const containerId = session.containerId || "local";

  useEffect(() => {
    if (!terminalElementRef.current) return;
    if (xtermInstanceRef.current) return;

    const savedFontSize = (() => {
      try {
        const val = localStorage.getItem("ilc_terminal_font_size");
        if (val) {
          const parsed = parseFloat(val);
          if (!isNaN(parsed) && parsed >= 8 && parsed <= 32) return parsed;
        }
      } catch {}
      return 12.5;
    })();

    let currentFontSize = savedFontSize;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "SF Mono, JetBrains Mono, Menlo, Monaco, Consolas, monospace",
      fontSize: savedFontSize,
      lineHeight: 1.25,
      rightClickSelectsWord: true,
      theme: getTerminalTheme(isDark),
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalElementRef.current);
    try {
      fitAddon.fit();
    } catch {}

    const applyFontSize = (newSize: number) => {
      const clamped = Math.max(9, Math.min(30, newSize));
      currentFontSize = clamped;
      term.options.fontSize = clamped;
      try {
        localStorage.setItem("ilc_terminal_font_size", String(clamped));
      } catch {}
      try {
        fitAddon.fit();
      } catch {}
    };

    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        if (event.key === "=" || event.key === "+") {
          if (event.type === "keydown") applyFontSize(currentFontSize + 1.5);
          return false;
        }
        if (event.key === "-" || event.key === "_") {
          if (event.type === "keydown") applyFontSize(currentFontSize - 1.5);
          return false;
        }
        if (event.key === "0") {
          if (event.type === "keydown") applyFontSize(12.5);
          return false;
        }
      }
      return true;
    });

    xtermInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln(
      `\x1b[1;38;5;205m♥\x1b[0m \x1b[1mI ♥ Containers Workspace\x1b[0m \x1b[90m—\x1b[0m \x1b[1;36m${containerName}\x1b[0m \x1b[90m(${containerId.substring(0, 12)})\x1b[0m \x1b[90m•\x1b[0m \x1b[32m● Connected\x1b[0m`,
    );
    term.writeln("");

    const controller = setupTerminalInput({
      term,
      getPrompt: () =>
        formatTerminalPrompt(containerName, containerId, currentCwdRef.current),
      onExecute: async (command) => {
        if (session.containerId) {
          const isCd = command === "cd" || command.startsWith("cd ");
          if (isCd) {
            try {
              const cdCmd = `${command} && pwd`;
              const res = await executeContainerCommand(
                session.containerId,
                cdCmd,
                term.cols,
                term.rows,
                currentCwdRef.current,
              );
              if (res.exitCode === 0 && res.output) {
                const lines = res.output.trim().split(/\r?\n/);
                const lastLine = lines[lines.length - 1].trim();
                if (lastLine.startsWith("/")) {
                  currentCwdRef.current = lastLine;
                }
              } else if (res.output) {
                term.writeln(res.output.replace(/\r?\n/g, "\r\n"));
              }
            } catch (err) {
              term.writeln(`\x1b[31merror: ${getErrorMessage(err)}\x1b[0m`);
            }
          } else {
            try {
              const res = await executeContainerCommand(
                session.containerId,
                command,
                term.cols,
                term.rows,
                currentCwdRef.current,
              );
              if (res.output) {
                const formattedOutput = res.output.replace(/\r?\n/g, "\r\n");
                term.write(formattedOutput);
                if (!formattedOutput.endsWith("\r\n")) {
                  term.writeln("");
                }
              }
            } catch (err) {
              term.writeln(`\x1b[31merror: ${getErrorMessage(err)}\x1b[0m`);
            }
          }
        } else {
          term.writeln(`\x1b[33mNo container attached to this session.\x1b[0m`);
        }
      },
    });

    controllerRef.current = controller;
    controller.redraw();

    term.onSelectionChange(() => {
      const selection = term.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    });

    const termEl = terminalElementRef.current;
    const handleContextMenu = (e: MouseEvent) => {
      const selection = term.getSelection();
      if (selection) {
        e.preventDefault();
        navigator.clipboard.writeText(selection);
      }
    };
    termEl?.addEventListener("contextmenu", handleContextMenu);

    const handleWindowResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener("resize", handleWindowResize);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {}
      });
    });

    if (termEl) {
      resizeObserver.observe(termEl);
    }

    return () => {
      controller.dispose();
      termEl?.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("resize", handleWindowResize);
      resizeObserver.disconnect();
      term.dispose();
      xtermInstanceRef.current = null;
    };
  }, [session, isDark, containerName, containerId]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        xtermInstanceRef.current?.focus();
      }, 50);
    }
  }, [isActive]);

  return (
    <div
      className={`w-full h-full p-2 select-text ${
        isDark ? "bg-[#0d1117]" : "bg-white"
      }`}
      style={{ display: isActive ? "block" : "none" }}
    >
      <div
        ref={terminalElementRef}
        className="w-full h-full font-mono select-text"
      />
    </div>
  );
};
