import { useQuery } from "@tanstack/react-query";
import { fetchMembers } from "./api";

export function useMembers(q = "", page = 1) {
  return useQuery({
    queryKey: ["members", q, page],
    queryFn: () => fetchMembers(q, page),
  });
}
