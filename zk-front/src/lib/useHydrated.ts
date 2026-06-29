import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** 클라이언트 마운트 이후 true. localStorage 기반 상태의 hydration 불일치 방지용. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true, // client
    () => false, // server
  );
}
