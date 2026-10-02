import { createContext, useContext } from "react";

export const WallContext = createContext(null);

export function useWall() {
  const context = useContext(WallContext);
  if (!context) throw new Error("useWall must be used inside <WallProvider>");
  return context;
}