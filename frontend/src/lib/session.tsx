"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearSession, getStoredUser, getToken, type ApiUser } from "./api";
import type { Locale } from "@/i18n/config";

type SessionValue = {
  user: ApiUser | null;
  ready: boolean;
  signOut: () => void;
  refresh: () => void;
};

const SessionContext = createContext<SessionValue>({
  user: null,
  ready: false,
  signOut: () => {},
  refresh: () => {},
});

export function SessionProvider({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setUser(getToken() ? getStoredUser() : null);
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const signOut = useCallback(() => {
    // Revoke the token server-side first; local sign-out must not depend on the network.
    void apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
    setUser(null);
    router.push(`/${locale}/login`);
  }, [locale, router]);

  const value = useMemo(() => ({ user, ready, signOut, refresh }), [user, ready, signOut, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
