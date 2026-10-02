import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../db/pool.js';
import type { Board, BoardGroup } from '../types.js';

interface BoardRow extends RowDataPacket {
  id: number;
  group_id: number;
  group_name: string;
  slug: string;
  name: string;
  description: string;
  type: Board['type'];
  write_mode: Board['writeMode'];
  categories: string[] | null;
  seller_only: number;
}

const toBoard = (row: BoardRow): Board => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  type: row.type,
  writeMode: row.write_mode,
  ...(row.categories?.length ? { categories: row.categories } : {}),
  ...(row.seller_only ? { sellerOnly: true } : {}),
});

/** 대분류 → 소분류 구조 그대로 */
export async function listBoardGroups(): Promise<BoardGroup[]> {
  const rows = await query<BoardRow>(
    `SELECT b.*, g.name AS group_name
       FROM boards b
       JOIN board_groups g ON g.id = b.group_id
      ORDER BY g.sort_order, b.sort_order`,
  );

  const groups = new Map<number, BoardGroup>();
  for (const row of rows) {
    if (!groups.has(row.group_id)) groups.set(row.group_id, { id: row.group_id, name: row.group_name, boards: [] });
    groups.get(row.group_id)!.boards.push(toBoard(row));
  }
  return [...groups.values()];
}

export async function getBoard(slug: string): Promise<Board | null> {
  const row = await queryOne<BoardRow>(
    `SELECT b.*, g.name AS group_name FROM boards b JOIN board_groups g ON g.id = b.group_id WHERE b.slug = ?`,
    [slug],
  );
  return row ? toBoard(row) : null;
}

export interface BoardPatch {
  name?: string;
  description?: string;
  type?: Board['type'];
  writeMode?: Board['writeMode'];
  categories?: string[];
  sellerOnly?: boolean;
}

/** 어드민 게시판 설정 수정 — 넘어온 항목만 바꾼다 */
export async function updateBoard(slug: string, patch: BoardPatch) {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.name !== undefined) (sets.push('name = ?'), params.push(patch.name));
  if (patch.description !== undefined) (sets.push('description = ?'), params.push(patch.description));
  if (patch.type !== undefined) (sets.push('type = ?'), params.push(patch.type));
  if (patch.writeMode !== undefined) (sets.push('write_mode = ?'), params.push(patch.writeMode));
  if (patch.categories !== undefined) (sets.push('categories = ?'), params.push(JSON.stringify(patch.categories)));
  if (patch.sellerOnly !== undefined) (sets.push('seller_only = ?'), params.push(patch.sellerOnly ? 1 : 0));

  if (sets.length === 0) return;
  await execute(`UPDATE boards SET ${sets.join(', ')} WHERE slug = ?`, [...params, slug]);
}

/** 게시판별 글 수 — 어드민 통계용 */
export async function countPostsByBoard() {
  return query<RowDataPacket & { slug: string; name: string; type: string; post_count: number }>(
    `SELECT b.slug, b.name, b.type, COUNT(p.id) AS post_count
       FROM boards b
       LEFT JOIN posts p ON p.board_id = b.id
      GROUP BY b.id
      ORDER BY b.sort_order`,
  );
}
