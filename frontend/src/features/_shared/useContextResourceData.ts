import { useCallback, useMemo, useState } from "react";
import type { ByContext } from "@/store/resources";

export function retainActiveContextData<T>(
  current: ByContext<T>,
  activeContexts: string[],
): ByContext<T> {
  const active = new Set(activeContexts);
  return Object.fromEntries(
    Object.entries(current).filter(([contextName]) => active.has(contextName)),
  ) as ByContext<T>;
}

export function useContextResourceData<T>(activeContexts: string[]) {
  const [storedData, setState] = useState<ByContext<T>>({});
  const data = useMemo(
    () => retainActiveContextData(storedData, activeContexts),
    [storedData, activeContexts],
  );

  const setData = useCallback((contextName: string, list: T[]) => {
    setState((current) => ({ ...current, [contextName]: list }));
  }, []);

  return { data, setData };
}
