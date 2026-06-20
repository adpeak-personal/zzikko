import type { CommentRow, NestedComment } from "@/service/posts/types";

export function nestComments(flat: CommentRow[]): NestedComment[] {
  const map = new Map<number, NestedComment>();
  const roots: NestedComment[] = [];
  for (const c of flat) map.set(c.id, { ...c, replies: [] });
  for (const c of flat) {
    if (c.parent_id === null) roots.push(map.get(c.id)!);
    else map.get(c.parent_id)?.replies.push(map.get(c.id)!);
  }
  return roots;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}
