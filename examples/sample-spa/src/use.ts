import { useEffect, useState } from "react";

import { get } from "./api";

// useRead is what path reads as, and its error.
export function useRead<T>(path: string): { data?: T; error?: string } {
  const [state, setState] = useState<{ path?: string; data?: T; error?: string }>({});
  useEffect(() => {
    let live = true;
    get<T>(path).then(
      (data) => live && setState({ path, data }),
      (e: Error) => live && setState({ path, error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [path]);
  return state.path === path ? state : {};
}
