/**
 * 주소로 받은 이미지 내려받기.
 *
 * 시세표를 캡처해서 올리는 대신 커뮤니티에 올라온 이미지 주소를 그대로 넣을 수 있게 만든 것.
 *
 * ⚠️ **서버가 대신 요청을 보내는 기능이라 아무 주소나 받으면 안 된다**(SSRF).
 *    주소에 `127.0.0.1` 이나 `10.0.0.5` 를 넣으면 바깥에서는 못 닿는 내부 서비스를
 *    우리 서버가 대신 긁어다 돌려주는 통로가 된다. 그래서
 *      1) http/https 만
 *      2) 이름을 **IP 로 풀어서** 사설·예약 대역이면 막고
 *      3) 리다이렉트도 한 번에 하나씩 같은 검사를 다시 하고
 *      4) 용량·형식을 확인한다.
 *    운영진만 부를 수 있는 길이지만, 계정 하나가 뚫리면 그대로 내부망 통로가 되므로 막아 둔다.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { badRequest } from './http.js';
import { MAX_UPLOAD_BYTES } from './multipart.js';

const MAX_REDIRECTS = 3;

/** 사설·예약 대역인가 — 맞으면 바깥 주소가 아니다 */
function isPrivateAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const parts = address.split('.').map(Number);
    const [a = 0, b = 0] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // 링크 로컬 (클라우드 메타데이터 169.254.169.254)
    if (a === 100 && b >= 64 && b <= 127) return true; // 통신사 NAT
    if (a >= 224) return true; // 멀티캐스트·예약
    return false;
  }

  if (version === 6) {
    const value = address.toLowerCase();
    if (value === '::1' || value === '::') return true;
    if (value.startsWith('fe80')) return true; // 링크 로컬
    if (/^f[cd]/.test(value)) return true; // 유니크 로컬 fc00::/7
    // ::ffff:10.0.0.1 처럼 IPv4 를 감싼 형태
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return false;
  }

  return true; // IP 가 아니면 통과시키지 않는다
}

/** 이 주소로 요청해도 되는지 — 아니면 그 자리에서 던진다 */
async function assertPublic(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw badRequest('http 또는 https 주소만 넣을 수 있습니다.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);

  if (addresses.length === 0) throw badRequest(`주소를 찾을 수 없습니다 — ${url.hostname}`);
  // 하나라도 내부 주소면 막는다
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) throw badRequest('내부 주소의 이미지는 받아올 수 없습니다.');
  }
}

export interface FetchedImage {
  data: Buffer;
  mimetype: string;
}

export async function fetchImageFromUrl(raw: string): Promise<FetchedImage> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw badRequest('이미지 주소 형식이 올바르지 않습니다.');
  }

  let response: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);

    const hit = await fetch(url, {
      redirect: 'manual', // 리다이렉트마다 위 검사를 다시 한다
      headers: {
        // 핫링크를 막는 사이트가 있어 같은 사이트에서 온 것처럼 보낸다.
        // 사용자 정보는 넣지 않는다.
        Referer: url.origin,
        'User-Agent': 'Mozilla/5.0 (compatible; zzikko-sise/1.0)',
      },
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);

    if (!hit) throw badRequest('이미지를 받아오지 못했습니다. 주소를 확인해주세요.');

    if (hit.status >= 300 && hit.status < 400) {
      const next = hit.headers.get('location');
      if (!next) throw badRequest('이미지를 받아오지 못했습니다.');
      url = new URL(next, url);
      continue;
    }

    if (!hit.ok) throw badRequest(`이미지를 받아오지 못했습니다 (${hit.status}).`);
    response = hit;
    break;
  }

  if (!response) throw badRequest('주소가 너무 여러 번 넘어갑니다.');

  const mimetype = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  if (!mimetype.startsWith('image/')) {
    throw badRequest(`이미지가 아닙니다 (${mimetype || '형식 없음'}).`);
  }

  // 헤더를 믿고 끝내지 않는다 — 실제로 받은 양도 센다
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_UPLOAD_BYTES) throw badRequest('이미지는 10MB 까지 받아올 수 있습니다.');

  const data = Buffer.from(await response.arrayBuffer());
  if (data.byteLength === 0) throw badRequest('빈 이미지입니다.');
  if (data.byteLength > MAX_UPLOAD_BYTES) throw badRequest('이미지는 10MB 까지 받아올 수 있습니다.');

  return { data, mimetype };
}
