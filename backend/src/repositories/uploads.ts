/**
 * 업로드 기록 저장소.
 *
 * 파일은 업로드 즉시 저장되고, 글이 등록될 때 `post_id` 가 채워진다.
 * 글을 안 쓰고 나간 파일(이미지를 올렸다가 지우고 등록한 경우 포함)은 `post_id` 가
 * NULL 로 남으므로 그것만 주기적으로 지운다 — 저장소를 통째로 훑을 필요가 없다.
 */
import type { RowDataPacket } from 'mysql2';
import { execute, query } from '../db/pool.js';

export interface UploadRecord {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  uploaderId: number;
  width?: number;
  height?: number;
}

export async function recordUpload(data: UploadRecord): Promise<number> {
  const { insertId } = await execute(
    `INSERT INTO uploads (url, filename, mimetype, size, uploader_id, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.url,
      data.filename.slice(0, 255),
      data.mimetype,
      data.size,
      data.uploaderId,
      data.width ?? null,
      data.height ?? null,
    ],
  );
  return insertId;
}

/** 나중에 만든 썸네일 경로를 기록한다 — 청소할 때 같이 지워지게 */
export async function setThumbUrl(url: string, thumbUrl: string) {
  const { affectedRows } = await execute('UPDATE uploads SET thumb_url = ? WHERE url = ?', [thumbUrl, url]);
  return affectedRows;
}

/**
 * 글에 실제로 쓰인 이미지를 그 글에 연결한다.
 *
 * 본문에서 빠진 이미지는 연결되지 않으므로 나중에 청소 대상이 된다.
 */
export async function linkUploadsToPost(postId: number, urls: string[]) {
  if (urls.length === 0) return 0;
  const marks = urls.map(() => '?').join(',');
  const { affectedRows } = await execute(`UPDATE uploads SET post_id = ? WHERE url IN (${marks})`, [postId, ...urls]);
  return affectedRows;
}

/**
 * 글 수정 시 이미지 연결을 다시 맞춘다.
 *
 * 본문에서 빠진 이미지는 연결을 끊어 청소 대상으로 돌리고, 새로 들어온 이미지는 묶는다.
 * 이게 없으면 수정으로 뺀 이미지가 post_id 를 그대로 달고 있어서 영영 지워지지 않는다.
 */
export async function relinkUploadsToPost(postId: number, urls: string[]) {
  if (urls.length === 0) {
    const { affectedRows } = await execute('UPDATE uploads SET post_id = NULL WHERE post_id = ?', [postId]);
    return { linked: 0, unlinked: affectedRows };
  }

  const marks = urls.map(() => '?').join(',');
  const { affectedRows: unlinked } = await execute(
    `UPDATE uploads SET post_id = NULL WHERE post_id = ? AND url NOT IN (${marks})`,
    [postId, ...urls],
  );
  const { affectedRows: linked } = await execute(`UPDATE uploads SET post_id = ? WHERE url IN (${marks})`, [
    postId,
    ...urls,
  ]);
  return { linked, unlinked };
}

/** 글이 지워지면 그 글의 이미지도 청소 대상으로 돌린다 */
export async function unlinkUploadsOfPost(postId: number) {
  const { affectedRows } = await execute('UPDATE uploads SET post_id = NULL WHERE post_id = ?', [postId]);
  return affectedRows;
}

interface OrphanRow extends RowDataPacket {
  id: number;
  url: string;
  thumb_url: string | null;
  size: number;
}

export interface Orphan {
  id: number;
  /** 지워야 할 모든 파생본 주소 */
  urls: string[];
  size: number;
}

/**
 * 어느 글에도 안 쓰인 채 일정 시간이 지난 업로드.
 *
 * 유예를 두는 이유 — 지금 글을 쓰는 중인 사람의 이미지를 지우면 안 된다.
 */
export async function findOrphans(olderThanHours: number): Promise<Orphan[]> {
  const rows = await query<OrphanRow>(
    `SELECT id, url, thumb_url, size
       FROM uploads
      WHERE post_id IS NULL AND created_at < NOW() - INTERVAL ? HOUR
      ORDER BY created_at`,
    [olderThanHours],
  );

  return rows.map((r) => ({
    id: r.id,
    urls: [r.url, r.thumb_url].filter((v): v is string => Boolean(v)),
    size: Number(r.size),
  }));
}

export async function deleteUploadRecords(ids: number[]) {
  if (ids.length === 0) return 0;
  const marks = ids.map(() => '?').join(',');
  const { affectedRows } = await execute(`DELETE FROM uploads WHERE id IN (${marks})`, ids);
  return affectedRows;
}
