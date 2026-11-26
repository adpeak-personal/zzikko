/**
 * 블로그 작업 프로필에 돌려 쓸 User-Agent 목록.
 *
 * 프로필을 만들 때 **가장 적게 쓰인 것**을 골라 넣는다(`pickUserAgent`). 전부 같은 UA 로
 * 두면 같은 IP 에 여러 계정이 "똑같은 기기" 로 들어가는 모양이 돼서, 그 자체가 신호가 된다.
 *
 * ⚠️ **전부 안드로이드 크롬이다.** 작업기가 크로미움으로 도니까 아이폰 사파리 UA 를 쓰면
 * 엔진과 어긋난다. 로그인도 `m.naver.com` 에서 하므로 모바일이어야 맞다.
 *
 * ⚠️ **크롬 버전을 실제 엔진과 너무 벌리지 말 것.** 작업기의 크로미움이 159 인데 UA 가
 * 131 이라고 하면 `userAgentData` 와 어긋나 보인다. 작업기가 클라이언트 힌트를 UA 에
 * 맞춰 덮어 주긴 하지만, 숫자 자체는 요즘 쓰는 범위(2~3개 버전 안)로 유지한다.
 * 크로미움을 올리면 여기 숫자도 같이 올리는 편이 낫다.
 *
 * 기기는 국내에서 흔한 삼성 갤럭시 위주로 두되, 몇 개는 다른 제조사를 섞는다.
 */
const MODELS: { model: string; android: string }[] = [
  { model: 'SM-S928N', android: '15' }, // 갤럭시 S24 울트라
  { model: 'SM-S926N', android: '15' }, // S24+
  { model: 'SM-S921N', android: '15' }, // S24
  { model: 'SM-S918N', android: '14' }, // S23 울트라
  { model: 'SM-S916N', android: '14' }, // S23+
  { model: 'SM-S911N', android: '14' }, // S23
  { model: 'SM-S908N', android: '14' }, // S22 울트라
  { model: 'SM-S901N', android: '13' }, // S22
  { model: 'SM-F956N', android: '15' }, // Z 폴드6
  { model: 'SM-F946N', android: '14' }, // Z 폴드5
  { model: 'SM-F741N', android: '15' }, // Z 플립6
  { model: 'SM-F731N', android: '14' }, // Z 플립5
  { model: 'SM-A556S', android: '15' }, // A55
  { model: 'SM-A546S', android: '14' }, // A54
  { model: 'SM-A536N', android: '14' }, // A53
  { model: 'SM-A346N', android: '14' }, // A34
  { model: 'SM-M336K', android: '13' }, // M33
  { model: 'SM-A135N', android: '13' }, // A13
  { model: 'SM-N986N', android: '13' }, // 노트20 울트라
  { model: 'SM-G991N', android: '13' }, // S21
  { model: 'SM-G998N', android: '13' }, // S21 울트라
  { model: 'SM-X916N', android: '14' }, // 탭 S9 울트라
  { model: 'Pixel 9', android: '15' },
  { model: 'Pixel 8', android: '15' },
  { model: 'Pixel 7a', android: '14' },
  { model: 'LM-V500N', android: '12' }, // LG V50
  { model: 'XQ-DQ72', android: '14' }, // 엑스페리아 1 V
  { model: 'CPH2451', android: '14' }, // 원플러스 11
  { model: '2201122G', android: '13' }, // 샤오미 12
  { model: 'M2101K6G', android: '13' }, // 홍미 노트 10 프로
];

/** 요즘 쓰이는 범위. 기기마다 조금씩 다른 게 자연스럽다 */
const CHROME_VERSIONS = ['157.0.0.0', '158.0.0.0', '159.0.0.0'];

export const USER_AGENTS: string[] = MODELS.map(({ model, android }, index) => {
  const chrome = CHROME_VERSIONS[index % CHROME_VERSIONS.length];
  return (
    `Mozilla/5.0 (Linux; Android ${android}; ${model}) AppleWebKit/537.36 ` +
    `(KHTML, like Gecko) Chrome/${chrome} Mobile Safari/537.36`
  );
});

/**
 * 이미 쓰고 있는 것들을 보고 **가장 적게 쓰인** UA 를 고른다.
 *
 * 목록보다 프로필이 많아지면 어쩔 수 없이 겹치는데, 그때도 고르게 퍼지도록 개수를 센다.
 */
export function pickUserAgent(inUse: string[]): string {
  const count = new Map<string, number>(USER_AGENTS.map((ua) => [ua, 0]));
  for (const ua of inUse) {
    if (count.has(ua)) count.set(ua, (count.get(ua) ?? 0) + 1);
  }
  let best = USER_AGENTS[0]!;
  let least = Number.POSITIVE_INFINITY;
  for (const [ua, used] of count) {
    if (used < least) {
      least = used;
      best = ua;
    }
  }
  return best;
}
