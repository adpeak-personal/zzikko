"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { apiFetch, clearTokens, getAccessToken, type AuthUser } from "@/lib/auth";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    apiFetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          clearTokens();
          setUser(null);
          return;
        }
        const user: AuthUser = await res.json();
        console.log("[Auth] 유저 데이터:", user);
        setUser(user);
      })
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [setUser, setLoading]);

  return <>{children}</>;
}
