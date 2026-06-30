import { useQuery } from "@tanstack/react-query";
import { fetchAliases } from "./api";

export function useAliases(userId: number) {
  return useQuery({
    queryKey: ["aliases", userId],
    queryFn: () => fetchAliases(userId),
    enabled: Number.isInteger(userId) && userId > 0,
  });
}
