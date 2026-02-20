import { AntflyClient } from "@antfly/sdk";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ApiConfigContext } from "@/contexts/api-config-context";
import { initCommandPaletteSearch } from "@/lib/semantic-search";

const getDefaultApiUrl = () => {
  return "/api/v1";
};

const getDefaultTermiteApiUrl = () => {
  return "http://localhost:11433";
};

const STORAGE_KEY = "antfarm-api-url";
const TERMITE_STORAGE_KEY = "antfarm-termite-api-url";

export function ApiConfigProvider({ children }: { children: ReactNode }) {
  // Try to load from localStorage, fallback to default
  const [apiUrl, setApiUrlState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || getDefaultApiUrl();
  });

  const [termiteApiUrl, setTermiteApiUrlState] = useState<string>(() => {
    const stored = localStorage.getItem(TERMITE_STORAGE_KEY);
    return stored || getDefaultTermiteApiUrl();
  });

  const [client, setClient] = useState<AntflyClient>(() => new AntflyClient({ baseUrl: apiUrl }));

  const setApiUrl = (url: string) => {
    const trimmedUrl = url.trim();
    setApiUrlState(trimmedUrl);
    localStorage.setItem(STORAGE_KEY, trimmedUrl);
    // Update client when URL changes
    setClient(new AntflyClient({ baseUrl: trimmedUrl }));
  };

  const resetToDefault = () => {
    const defaultUrl = getDefaultApiUrl();
    setApiUrlState(defaultUrl);
    localStorage.removeItem(STORAGE_KEY);
    // Update client when resetting
    setClient(new AntflyClient({ baseUrl: defaultUrl }));
  };

  const setTermiteApiUrl = (url: string) => {
    const trimmedUrl = url.trim();
    setTermiteApiUrlState(trimmedUrl);
    localStorage.setItem(TERMITE_STORAGE_KEY, trimmedUrl);
  };

  const resetTermiteApiUrl = () => {
    const defaultUrl = getDefaultTermiteApiUrl();
    setTermiteApiUrlState(defaultUrl);
    localStorage.removeItem(TERMITE_STORAGE_KEY);
  };

  // Initialize command palette search in background on page load
  // Small delay lets the page render first, then init runs quietly
  useEffect(() => {
    const timer = setTimeout(() => {
      initCommandPaletteSearch(client);
    }, 1000);
    return () => clearTimeout(timer);
  }, [client]);

  return (
    <ApiConfigContext.Provider
      value={{
        apiUrl,
        setApiUrl,
        client,
        resetToDefault,
        termiteApiUrl,
        setTermiteApiUrl,
        resetTermiteApiUrl,
      }}
    >
      {children}
    </ApiConfigContext.Provider>
  );
}
