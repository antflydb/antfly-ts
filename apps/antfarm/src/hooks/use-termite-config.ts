import { useContext } from "react";
import { TermiteConfigContext } from "@/contexts/termite-config-context";

export function useTermiteConfig() {
  const context = useContext(TermiteConfigContext);
  if (context === undefined) {
    throw new Error("useTermiteConfig must be used within a TermiteConfigProvider");
  }
  return context;
}
