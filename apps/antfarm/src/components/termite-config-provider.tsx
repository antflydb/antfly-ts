import type { ReactNode } from "react";
import { useState } from "react";
import { TermiteConfigContext } from "@/contexts/termite-config-context";

const getDefaultTermiteUrl = () => {
  return import.meta.env.VITE_TERMITE_URL || "http://localhost:11433";
};

const STORAGE_KEY = "antfarm-termite-url";

export function TermiteConfigProvider({ children }: { children: ReactNode }) {
  const [termiteUrl, setTermiteUrlState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || getDefaultTermiteUrl();
  });

  const setTermiteUrl = (url: string) => {
    const trimmedUrl = url.trim();
    setTermiteUrlState(trimmedUrl);
    localStorage.setItem(STORAGE_KEY, trimmedUrl);
  };

  const resetToDefault = () => {
    const defaultUrl = getDefaultTermiteUrl();
    setTermiteUrlState(defaultUrl);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <TermiteConfigContext.Provider value={{ termiteUrl, setTermiteUrl, resetToDefault }}>
      {children}
    </TermiteConfigContext.Provider>
  );
}
