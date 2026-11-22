import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne, withTransaction } from '../db/pool.js';
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
  admin_only: number;
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
  ...(row.admin_only ? { adminOnly: true } : {}),
});

/**
 * 대분류 → 소분류 구조 그대로.
 *
 * 게시판이 없는 대분류는 기본으로 빠진다 — 사이드바에 제목만 덩그러니 뜨면 안 되므로.
 * 어드민은 `includeEmpty` 로 전부 받는다(막 만든 대분류에 게시판을 붙여야 하고,
 * 순서 API 가 전체 id 를 요구한다).
 */
export async function listBoardGroups({ includeEmpty = false } = {}): Promise<BoardGroup[]> {
  const [groupRows, rows] = await Promise.all([
    query<RowDataPacket & { id: number; name: string }>(`SELECT id, name FROM board_groups ORDER BY sort_order, id`),
    query<BoardRow>(`SELECT * FROM boards ORDER BY sort_order, id`),
  ]);

  const groups = groupRows.map((group): BoardGroup => ({
    id: group.id,
    name: group.name,
    boards: rows.filter((row) => row.group_id === group.id).map(toBoard),
  }));
  return includeEmpty ? groups : groups.filter((group) => group.boards.length > 0);
}

/** 대분류 추가 — 맨 아래에 붙는다 */
export async function createBoardGroup(name: string): Promise<BoardGroup> {
  const result = await execute(
    `INSERT INTO board_groups (name, sort_order) SELECT ?, COALESCE(MAX(sort_order), 0) + 1 FROM board_groups`,
    [name],
  );
  return { id: result.insertId, name, boards: [] };
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
  adminOnly?: boolean;
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
  if (patch.adminOnly !== undefined) (sets.push('admin_only = ?'), params.push(patch.adminOnly ? 1 : 0));

  if (sets.length === 0) return;
  await execute(`UPDATE boards SET ${sets.join(', ')} WHERE slug = ?`, [...params, slug]);
}

export interface NewBoard {
  groupId: number;
  slug: string;
  name: string;
  description: string;
  type: Board['type'];
  writeMode: Board['writeMode'];
}

export type CreateBoardResult = { ok: true; board: Board } | { ok: false; reason: 'no-group' | 'slug-taken' };

/**
 * 게시판 추가 — 그 대분류의 맨 끝에 붙는다.
 * slug 는 주소(`/board/<slug>`)라 한번 정하면 바꾸지 않는다(어드민 수정 항목에도 없다).
 */
export async function createBoard(input: NewBoard): Promise<CreateBoardResult> {
  const group = await queryOne<RowDataPacket & { id: number }>(`SELECT id FROM board_groups WHERE id = ?`, [
    input.groupId,
  ]);
  if (!group) return { ok: false, reason: 'no-group' };
  if (await getBoard(input.slug)) return { ok: false, reason: 'slug-taken' };

  try {
    await execute(
      `INSERT INTO boards (group_id, slug, name, description, type, write_mode, sort_order)
       SELECT ?, ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM boards WHERE group_id = ?`,
      [input.groupId, input.slug, input.name, input.description, input.type, input.writeMode, input.groupId],
    );
  } catch (error) {
    // 위에서 확인했어도 동시에 두 번 누르면 UNIQUE 에 걸린다
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return { ok: false, reason: 'slug-taken' };
    throw error;
  }
  return { ok: true, board: (await getBoard(input.slug))! };
}

/**
 * 대분류 이름 바꾸기. 없는 id 면 false.
 * 사이드바·모바일 메뉴가 전부 `listBoardGroups` 에서 이름을 읽으므로 여기만 고치면 된다.
 */
export async function renameBoardGroup(id: number, name: string): Promise<boolean> {
  const row = await queryOne<RowDataPacket & { id: number }>(`SELECT id FROM board_groups WHERE id = ?`, [id]);
  if (!row) return false;
  await execute(`UPDATE board_groups SET name = ? WHERE id = ?`, [name, id]);
  return true;
}

/**
 * 한 대분류 안의 게시판 순서를 통째로 다시 적는다.
 * 받은 slug 목록이 그 대분류의 게시판과 **정확히 같은 집합**일 때만 바꾼다 —
 * 화면이 오래된 상태로 보냈으면(그 사이 게시판이 추가됐으면) 일부만 순서가 잡혀 뒤섞인다.
 */
export async function reorderBoards(groupId: number, slugs: string[]): Promise<boolean> {
  const rows = await query<RowDataPacket & { slug: string }>(`SELECT slug FROM boards WHERE group_id = ?`, [groupId]);
  const current = rows.map((row) => row.slug).sort();
  if (current.length === 0 || JSON.stringify(current) !== JSON.stringify([...slugs].sort())) return false;

  await withTransaction(async (conn) => {
    for (const [index, slug] of slugs.entries()) {
      await conn.execute(`UPDATE boards SET sort_order = ? WHERE slug = ? AND group_id = ?`, [index + 1, slug, groupId]);
    }
  });
  return true;
}

/** 대분류 순서. 받은 id 목록이 전체 대분류와 같은 집합일 때만 바꾼다 */
export async function reorderBoardGroups(ids: number[]): Promise<boolean> {
  const rows = await query<RowDataPacket & { id: number }>(`SELECT id FROM board_groups`);
  const current = rows.map((row) => row.id).sort((a, b) => a - b);
  if (JSON.stringify(current) !== JSON.stringify([...ids].sort((a, b) => a - b))) return false;

  await withTransaction(async (conn) => {
    for (const [index, id] of ids.entries()) {
      await conn.execute(`UPDATE board_groups SET sort_order = ? WHERE id = ?`, [index + 1, id]);
    }
  });
  return true;
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
