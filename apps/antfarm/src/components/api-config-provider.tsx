import { AntflyClient } from "@antfly/sdk";
import type { ReactNode } from "react";
import { useState } from "react";
import { ApiConfigContext } from "@/contexts/api-config-context";

const getDefaultApiUrl = () => {
  // In development, default to localhost
  // In production (built), use relative path
  return import.meta.env.MODE === "development" ? "http://localhost:8082/api/v1" : "/api/v1";
};

const STORAGE_KEY = "antfarm-api-url";

export function ApiConfigProvider({ children }: { children: ReactNode }) {
  // Try to load from localStorage, fallback to default
  const [apiUrl, setApiUrlState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || getDefaultApiUrl();
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

  return (
    <ApiConfigContext.Provider value={{ apiUrl, setApiUrl, client, resetToDefault }}>
      {children}
    </ApiConfigContext.Provider>
  );
}
