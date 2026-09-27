"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "./api";

type State<T> = { data: T | null; loading: boolean; error: ApiError | null };

/** Minimal fetch-on-mount hook - enough for a dashboard, no client cache needed. */
export function useApi<T>(path: string | null, deps: unknown[] = []): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, loading: Boolean(path), error: null });
  const counter = useRef(0);

  const load = useCallback(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const run = ++counter.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    apiFetch<T>(path)
      .then((data) => {
        if (run === counter.current) setState({ data, loading: false, error: null });
      })
      .catch((error: ApiError) => {
        if (run === counter.current) setState({ data: null, loading: false, error });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
