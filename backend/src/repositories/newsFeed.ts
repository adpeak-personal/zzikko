import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../db/pool.js';
import type { FeedItem } from '../lib/news/feed.js';
import type { NewsFeedItem, NewsFeedStatus } from '../types.js';

/**
 * 뉴스 수집함.
 *
 * RSS 로 받아온 항목을 그대로 담아 두고, 사람이 고른 것만 기사로 만든다.
 * guid 가 UNIQUE 라 같은 글을 두 번 담지 않는다 — 수집을 몇 번 돌려도 안전하다.
 */

interface FeedRow extends RowDataPacket {
  id: number;
  guid: string;
  title: string;
  link: string;
  published_at: string;
  source_text: string;
  source_name: string;
  status: NewsFeedStatus;
  article_id: number | null;
  created_at: string;
}

const toItem = (row: FeedRow): NewsFeedItem => ({
  id: row.id,
  title: row.title,
  link: row.link,
  publishedAt: row.published_at,
  sourceName: row.source_name,
  // 목록에서는 앞부분만 보여 준다 — 원문 전체를 화면에 뿌릴 이유가 없다
  preview: row.source_text.replace(/\s+/g, ' ').slice(0, 300),
  status: row.status,
  articleId: row.article_id,
});

/**
 * 받아온 항목을 담는다. 이미 있는 guid 는 건너뛴다.
 *
 * INSERT IGNORE 를 쓰지 않는 이유 — 다른 제약(길이 초과 등) 위반까지 조용히 삼킨다.
 */
export async function saveItems(items: FeedItem[], sourceName: string): Promise<number> {
  let added = 0;
  for (const item of items) {
    const exists = await queryOne('SELECT id FROM news_feed WHERE guid = ?', [item.guid]);
    if (exists) continue;
    await execute(
      `INSERT INTO news_feed (guid, title, link, published_at, source_text, source_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        item.guid,
        item.title,
        item.link,
        item.publishedAt.toISOString().slice(0, 19).replace('T', ' '),
        item.sourceText,
        sourceName,
      ],
    );
    added++;
  }
  return added;
}

export async function listFeed(status?: NewsFeedStatus, limit = 120): Promise<NewsFeedItem[]> {
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status, limit] : [limit];
  const rows = await query<FeedRow>(
    `SELECT * FROM news_feed ${where} ORDER BY published_at DESC LIMIT ?`,
    params,
  );
  return rows.map(toItem);
}

export async function countByStatus(): Promise<{ status: NewsFeedStatus; count: number }[]> {
  const rows = await query<RowDataPacket & { status: NewsFeedStatus; count: number }>(
    'SELECT status, COUNT(*) AS count FROM news_feed GROUP BY status',
  );
  return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
}

/** 기사를 쓸 때는 원문 전체가 필요하다 */
export async function getWithSource(id: number) {
  const row = await queryOne<FeedRow>('SELECT * FROM news_feed WHERE id = ?', [id]);
  if (!row) return null;
  return { ...toItem(row), sourceText: row.source_text };
}

export async function markWritten(id: number, articleId: number) {
  await execute("UPDATE news_feed SET status = '작성됨', article_id = ? WHERE id = ?", [articleId, id]);
}

export async function setStatus(id: number, status: NewsFeedStatus) {
  await execute('UPDATE news_feed SET status = ?, article_id = IF(? = ?, article_id, NULL) WHERE id = ?', [
    status,
    status,
    '작성됨',
    id,
  ]);
}

/**
 * 오래된 수집 항목의 원문을 비운다.
 *
 * 원문은 기사를 쓸 때만 필요하다. 쌓이면 DB 만 커지므로 한 달 지난 건 비운다.
 * 행 자체는 남겨야 한다 — guid 가 없어지면 같은 글을 또 받아온다.
 */
export async function trimOldSources(days = 30): Promise<number> {
  const { affectedRows } = await execute(
    `UPDATE news_feed SET source_text = ''
      WHERE source_text <> '' AND published_at < NOW() - INTERVAL ? DAY`,
    [days],
  );
  return affectedRows;
}
