import { createContext } from "react";

export interface TermiteConfigContextType {
  termiteUrl: string;
  setTermiteUrl: (url: string) => void;
  resetToDefault: () => void;
}

export const TermiteConfigContext = createContext<TermiteConfigContextType | undefined>(undefined);
