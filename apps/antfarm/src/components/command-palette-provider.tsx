"use client";

import { Maximize2, Minimize2, Moon, Sun, Table } from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useContentWidth } from "@/components/content-width-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useTheme } from "@/hooks/use-theme";

interface CommandPaletteContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
}

const CommandPaletteContext = React.createContext<CommandPaletteContextType | undefined>(undefined);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const navigate = useNavigate();

  const { theme, setTheme } = useTheme();
  const { contentWidth, toggleContentWidth } = useContentWidth();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggle = React.useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Global keyboard shortcut for command palette (⌘K)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggle]);

  const handleSelect = React.useCallback(
    (href?: string, action?: string) => {
      setIsOpen(false);

      if (action === "toggle-theme") {
        setTheme(theme === "dark" ? "light" : "dark");
      } else if (action === "toggle-width") {
        toggleContentWidth();
      } else if (href) {
        navigate(href);
      }
    },
    [navigate, theme, setTheme, toggleContentWidth],
  );

  const navigationCommands = [{ icon: Table, label: "Tables", href: "/" }];

  const quickActionCommands = [
    { icon: Moon, label: "Toggle Theme", action: "toggle-theme" },
    { icon: Maximize2, label: "Toggle Content Width", action: "toggle-width" },
  ];

  return (
    <CommandPaletteContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggle,
      }}
    >
      {children}

      <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Quick Actions */}
          <CommandGroup heading="Quick Actions">
            {quickActionCommands.map((command) => {
              const Icon = command.icon;
              let DynamicIcon = Icon;
              let DynamicLabel = command.label;

              // Update icon and label based on current state (only when mounted to avoid hydration issues)
              if (mounted) {
                if (command.action === "toggle-theme") {
                  DynamicIcon = theme === "dark" ? Sun : Moon;
                  DynamicLabel = theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
                } else if (command.action === "toggle-width") {
                  DynamicIcon = contentWidth === "restricted" ? Maximize2 : Minimize2;
                  DynamicLabel =
                    contentWidth === "restricted"
                      ? "Expand Content Width"
                      : "Restrict Content Width";
                }
              }

              return (
                <CommandItem
                  key={command.action}
                  onSelect={() => handleSelect(undefined, command.action)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <DynamicIcon className="h-4 w-4" />
                  <span>{DynamicLabel}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          {/* Navigation */}
          <CommandGroup heading="Navigation">
            {navigationCommands.map((command) => (
              <CommandItem
                key={command.href}
                onSelect={() => handleSelect(command.href)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <command.icon className="h-4 w-4" />
                <span>{command.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCommandPalette() {
  const context = React.useContext(CommandPaletteContext);
  if (context === undefined) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return context;
}
