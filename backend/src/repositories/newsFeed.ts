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
  title_ko: string | null;
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
  // 옮긴 제목이 있으면 그걸 띄우고, 원문은 따로 들고 간다(대조용)
  title: row.title_ko || row.title,
  titleOriginal: row.title_ko ? row.title : null,
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
/** 새로 담은 항목 — 제목을 옮겨 주려면 id 가 필요하다 */
export interface SavedItem {
  id: number;
  title: string;
}

export async function saveItems(items: FeedItem[], sourceName: string): Promise<SavedItem[]> {
  const added: SavedItem[] = [];
  for (const item of items) {
    const exists = await queryOne('SELECT id FROM news_feed WHERE guid = ?', [item.guid]);
    if (exists) continue;
    const { insertId } = await execute(
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
    added.push({ id: insertId, title: item.title });
  }
  return added;
}

/**
 * 아직 제목을 안 옮긴 항목.
 *
 * 새로 담은 것만 옮기면 그 전에 쌓인 건 영영 영어로 남는다. 수집을 돌릴 때 밀린 것까지
 * 같이 처리한다 — 한 번 옮기면 `title_ko` 가 차서 다시 부르지 않는다.
 *
 * ⚠️ 최신순이라, 밀린 양이 limit 을 넘으면 **오래된 쪽이 계속 뒤로 밀린다.**
 *    부르는 쪽에서 빌 때까지 돌려야 한 번에 끝난다.
 */
export async function listUntranslated(limit = 60): Promise<SavedItem[]> {
  const rows = await query<RowDataPacket & { id: number; title: string }>(
    `SELECT id, title FROM news_feed
      WHERE title_ko IS NULL AND status <> '삭제'
      ORDER BY published_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((row) => ({ id: row.id, title: row.title }));
}

/** 옮긴 제목을 적는다. 원문 title 은 건드리지 않는다. */
export async function setTitleKo(id: number, titleKo: string) {
  await execute('UPDATE news_feed SET title_ko = ? WHERE id = ?', [titleKo.slice(0, 300), id]);
}

/**
 * 수집함 목록.
 *
 * '삭제'는 어디에도 띄우지 않는다 — 행이 남아 있는 건 guid 로 다시 안 받으려는 것뿐이다.
 */
export async function listFeed(status?: NewsFeedStatus, limit = 120): Promise<NewsFeedItem[]> {
  const where = status ? 'WHERE status = ?' : `WHERE status <> '삭제'`;
  const params = status ? [status, limit] : [limit];
  const rows = await query<FeedRow>(
    `SELECT * FROM news_feed ${where} ORDER BY published_at DESC LIMIT ?`,
    params,
  );
  return rows.map(toItem);
}

export async function countByStatus(): Promise<{ status: NewsFeedStatus; count: number }[]> {
  const rows = await query<RowDataPacket & { status: NewsFeedStatus; count: number }>(
    `SELECT status, COUNT(*) AS count FROM news_feed WHERE status <> '삭제' GROUP BY status`,
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

/**
 * 상태를 바꾼다.
 *
 * '삭제'면 원문(`source_text`)도 **그 자리에서 비운다.** 행 자체는 남겨야 한다 —
 * guid 가 UNIQUE 라, 지우면 다음 수집 때 똑같은 게 다시 들어오기 때문이다.
 * 남는 건 guid·제목·링크·날짜뿐이라 사실상 치워진 것과 같다.
 */
export async function setStatus(id: number, status: NewsFeedStatus) {
  await execute(
    `UPDATE news_feed
        SET status = ?,
            article_id = IF(? = ?, article_id, NULL),
            source_text = IF(? = '삭제', '', source_text)
      WHERE id = ?`,
    [status, status, '작성됨', status, id],
  );
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
