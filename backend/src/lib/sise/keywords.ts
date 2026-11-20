/**
 * 네이버 검색광고 API — 지역 키워드 월간검색수.
 *
 * 어느 지역 시세 글을 쓸지 고르는 데만 쓴다. **무료**지만 호출 수 제한이 있으므로
 * 어드민에서 버튼을 눌렀을 때만 부른다 — 검색량은 자주 바뀌지 않는다.
 *
 * 규격은 네이버 공식 저장소(naver/searchad-apidoc) 샘플 기준이다.
 *   서명 = base64( HMAC-SHA256( 비밀키, "{타임스탬프}.{메서드}.{URI}" ) )
 *
 * ⚠️ `hintKeywords` 에 지역명만 넣으면 그 지역명 하나만 돌아온다. "수원휴대폰성지" 처럼
 *    **합쳐서** 물어봐야 연관키워드가 따라온다. 띄어쓰기는 넣지 않는다(네이버가 무시한다).
 */
import { createHmac } from 'node:crypto';
import { badRequest } from '../http.js';

const BASE = 'https://api.searchad.naver.com';
const URI = '/keywordstool';
/** 한 번에 넣을 수 있는 힌트 수 */
const CHUNK = 5;

/** 지역명 뒤에 붙여 물어볼 말. 연관키워드가 따라오므로 하나로 충분하다. */
const SUFFIX = '휴대폰성지';

/** 이 말이 들어간 키워드만 남긴다 — 지역명만으론 맛집·부동산까지 딸려온다 */
const KEEP = ['성지', '시세'];

/**
 * 조회할 지역. 시·구·주요 상권까지 넣는다.
 *
 * "경기"·"충남" 같은 도 단위는 넣지 않는다 — 검색량이 거의 없다(실측).
 * 사람들은 "부천 휴대폰성지"로 찾지 "경기 휴대폰성지"로 찾지 않는다.
 */
export const PLACES = [
  // 특별·광역시
  '서울', '부산', '대구', '인천', '대전', '광주', '울산', '세종',
  // 서울 구
  '강남', '서초', '송파', '강동', '광진', '성동', '중랑', '동대문', '성북', '강북',
  '도봉', '노원', '은평', '서대문', '마포', '양천', '강서', '구로', '금천', '영등포',
  '동작', '관악', '용산', '종로',
  // 서울 상권
  '신도림', '강변', '테크노마트', '연신내',
  // 경기
  '수원', '성남', '고양', '용인', '부천', '안산', '안양', '남양주', '화성', '평택',
  '의정부', '시흥', '파주', '김포', '광명', '군포', '하남', '오산', '이천', '구리',
  '분당', '일산', '동탄', '판교', '평촌', '산본', '영통', '광교',
  // 그 밖
  '천안', '아산', '청주', '전주', '창원', '김해', '진주', '포항', '구미', '경산',
  '원주', '춘천', '제주', '서면', '해운대', '부평', '송도', '청라',
];

export interface KeywordHit {
  keyword: string;
  /** 어느 지역 묶음에서 나왔는지. 못 가리면 빈 값 */
  place: string;
  monthly: number;
  /** 네이버가 주는 경쟁정도 — 낮음·중간·높음 */
  competition: string;
}

interface RawKeyword {
  relKeyword?: unknown;
  monthlyPcQcCnt?: unknown;
  monthlyMobileQcCnt?: unknown;
  compIdx?: unknown;
}

function credentials() {
  const apiKey = process.env.NAVER_AD_API_KEY;
  const secret = process.env.NAVER_AD_SECRET_KEY;
  const customer = process.env.NAVER_AD_CUSTOMER_ID;
  if (!apiKey || !secret || !customer) return null;
  return { apiKey, secret, customer };
}

/** 키가 다 있으면 true — 화면에서 버튼을 띄울지 정하는 데 쓴다 */
export const keywordsReady = () => credentials() !== null;

/** 10 미만은 "< 10" 문자열로 온다 — 0 으로 본다 */
function count(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  if (value.includes('<')) return 0;
  const digits = value.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

async function ask(hints: string[], cred: NonNullable<ReturnType<typeof credentials>>) {
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', cred.secret)
    .update(`${timestamp}.GET.${URI}`)
    .digest('base64');

  const query = new URLSearchParams({ hintKeywords: hints.join(','), showDetail: '1' });
  const response = await fetch(`${BASE}${URI}?${query}`, {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Timestamp': timestamp,
      'X-API-KEY': cred.apiKey,
      'X-Customer': cred.customer,
      'X-Signature': signature,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    // 401·403 은 거의 키 문제다 — 그대로 보여주면 사람이 바로 고칠 수 있다
    throw badRequest(`네이버 검색광고 API 오류 (${response.status}) ${body.slice(0, 200)}`);
  }
  const data = (await response.json()) as { keywordList?: RawKeyword[] };
  return data.keywordList ?? [];
}

/**
 * 지역 키워드 월간검색수를 받아온다.
 *
 * 연관키워드가 섞여 돌아오므로 '성지'·'시세'가 든 것만 남기고, 가장 긴 지역명으로
 * 묶는다 — '강남'과 '강남구'가 둘 다 들어오면 둘 다 같은 지역으로 본다.
 */
export async function fetchKeywordVolumes(places: string[] = PLACES): Promise<KeywordHit[]> {
  const cred = credentials();
  if (!cred) throw badRequest('네이버 검색광고 API 키가 없습니다. .env.local 을 확인해주세요.');

  const found = new Map<string, KeywordHit>();
  for (let index = 0; index < places.length; index += CHUNK) {
    const chunk = places.slice(index, index + CHUNK);
    const list = await ask(chunk.map((place) => `${place}${SUFFIX}`), cred);

    for (const raw of list) {
      const keyword = typeof raw.relKeyword === 'string' ? raw.relKeyword.trim() : '';
      if (!keyword || !KEEP.some((word) => keyword.includes(word))) continue;

      const monthly = count(raw.monthlyPcQcCnt) + count(raw.monthlyMobileQcCnt);
      if (monthly <= 0) continue;

      // 어느 지역 키워드인지 — 들어 있는 지역명 중 가장 긴 것
      const place = places
        .filter((item) => keyword.includes(item))
        .sort((a, b) => b.length - a.length)[0] ?? '';

      const previous = found.get(keyword);
      if (!previous || monthly > previous.monthly) {
        found.set(keyword, {
          keyword,
          place,
          monthly,
          competition: typeof raw.compIdx === 'string' ? raw.compIdx : '',
        });
      }
    }
    // 호출 수 제한이 있어 살짝 쉰다
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return [...found.values()].sort((a, b) => b.monthly - a.monthly);
}
