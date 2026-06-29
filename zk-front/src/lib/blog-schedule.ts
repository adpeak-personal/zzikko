// 블로그 예약 발행 — 시간 분배 로직 (순수 함수, 백엔드 무관)

export type DistMode = "even" | "random" | "daytime";

export interface ScheduleOptions {
  /** 분배 시작 시각 */
  startAt: Date;
  /** 분배할 전체 시간(시간 단위). 기본 24 */
  windowHours: number;
  mode: DistMode;
  /** daytime 모드에서 발행 허용 시작 시 (0~23) */
  dayStart?: number;
  /** daytime 모드에서 발행 허용 종료 시 (0~24) */
  dayEnd?: number;
}

const HOUR = 3_600_000;

// 결정적 의사난수 (seed 기반) — SSR/재계산 시 흔들리지 않도록
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Segment {
  start: number;
  len: number;
}

// 야간을 제외한 '활동 시간' 구간들을 windowHours 안에서 잘라낸다
function buildDaytimeSegments(
  startMs: number,
  endMs: number,
  dayStart: number,
  dayEnd: number,
): Segment[] {
  const segs: Segment[] = [];
  const cur = new Date(startMs);
  cur.setHours(0, 0, 0, 0);

  while (cur.getTime() < endMs) {
    const base = cur.getTime();
    const segStart = Math.max(base + dayStart * HOUR, startMs);
    const segEnd = Math.min(base + dayEnd * HOUR, endMs);
    if (segEnd > segStart) segs.push({ start: segStart, len: segEnd - segStart });
    cur.setDate(cur.getDate() + 1);
  }
  return segs;
}

// 활동시간 구간들 안에서 누적 위치(ms)를 실제 시각으로 환산
function mapIntoSegments(segs: Segment[], offset: number): number {
  let remaining = offset;
  for (const seg of segs) {
    if (remaining <= seg.len) return seg.start + remaining;
    remaining -= seg.len;
  }
  const last = segs[segs.length - 1];
  return last.start + last.len;
}

/**
 * count개의 작업을 옵션에 맞게 분배해 발행 시각 배열(오름차순)을 만든다.
 */
export function distributeTimes(count: number, opts: ScheduleOptions): Date[] {
  if (count <= 0) return [];

  const startMs = opts.startAt.getTime();
  const windowMs = opts.windowHours * HOUR;
  const rand = seededRandom(Math.floor(startMs / 1000) + count);

  if (opts.mode === "even") {
    const step = windowMs / count;
    return Array.from({ length: count }, (_, i) => new Date(startMs + step * i));
  }

  if (opts.mode === "random") {
    const step = windowMs / count;
    return Array.from({ length: count }, (_, i) => startMs + step * i + rand() * step)
      .sort((a, b) => a - b)
      .map((ms) => new Date(ms));
  }

  // daytime — 활동 시간대에만 균등 분배
  const dayStart = opts.dayStart ?? 9;
  const dayEnd = opts.dayEnd ?? 23;
  const segs = buildDaytimeSegments(startMs, startMs + windowMs, dayStart, dayEnd);
  const totalLen = segs.reduce((acc, s) => acc + s.len, 0);

  if (segs.length === 0 || totalLen === 0) {
    // 활동시간이 안 잡히면 균등으로 폴백
    const step = windowMs / count;
    return Array.from({ length: count }, (_, i) => new Date(startMs + step * i));
  }

  const step = totalLen / count;
  return Array.from({ length: count }, (_, i) =>
    new Date(mapIntoSegments(segs, step * i)),
  );
}

// ---- 작업(Job) 데이터 모델 — 향후 백엔드 테이블과 1:1 ----

export type BlogJobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface BlogJob {
  id: string;
  title: string;
  keywords: string[];
  scheduledAt: string; // ISO
  status: BlogJobStatus;
  resultUrl?: string;
  error?: string;
  createdAt: string; // ISO
}

export interface ParsedRow {
  title: string;
  keywords: string[];
}

/**
 * "제목 | 키워드1, 키워드2" 형식의 여러 줄을 파싱.
 * - 제목과 키워드는 `|`(또는 탭)으로 구분
 * - 키워드는 콤마로 여러 개 입력 가능
 */
export function parseBulkInput(raw: string): ParsedRow[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\t|\s*\|\s*/);
      const title = (parts[0] ?? "").trim();
      const keywords = splitKeywords(parts.slice(1).join(","));
      return { title, keywords };
    })
    .filter((r) => r.title.length > 0);
}

/** 콤마로 구분된 키워드 문자열을 배열로 (공백/중복 제거) */
export function splitKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of raw.split(",")) {
    const t = k.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

// ---- 표시용 포맷터 ----

export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function formatSchedule(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}(${days[d.getDay()]}) ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
