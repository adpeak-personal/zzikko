/**
 * 문자 보내기 — 알리고(Aligo).
 *
 * `ALIGO_API_KEY` · `ALIGO_USER_ID` · `ALIGO_SENDER`(사전 등록한 발신번호) 셋 다 있어야 보낸다.
 * - 셋 중 하나라도 없고 **개발 환경이면** 문자를 보내지 않고 서버 로그에 인증번호를 찍는다.
 * - **운영에서 없으면 보내지 못한다**(`'unavailable'`). 이메일 가입이 막히고 카카오 가입만 된다.
 *
 * abyssblue 와 **같은 환경변수 이름**을 쓴다 — 같은 알리고 계정을 양쪽에 그대로 넣으려고.
 * 거기 구현(`backend/src/lib/sms.ts`)과 같은 모양이니 고칠 일이 생기면 양쪽을 같이 보는 편이 좋다.
 *
 * 다른 업체로 바꾸려면 이 파일의 `sendSms` 만 고치면 된다. 라우트는 업체를 모른다.
 *
 * 문서: https://smartsms.aligo.in/admin/api/spec.html
 */
export type SmsResult = 'sent' | 'logged' | 'unavailable' | 'failed';

const config = () => {
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER?.replace(/\D/g, '');
  return apiKey && userId && sender ? { apiKey, userId, sender } : null;
};

export const smsReady = () => Boolean(config()) || process.env.NODE_ENV !== 'production';

export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const cfg = config();
  if (!cfg) {
    if (process.env.NODE_ENV === 'production') return 'unavailable';
    console.info(`[sms] (개발 — 실제로 보내지 않음) ${to}: ${text}`);
    return 'logged';
  }

  const form = new URLSearchParams({
    key: cfg.apiKey,
    user_id: cfg.userId,
    sender: cfg.sender,
    receiver: to,
    msg: text,
    // 인증번호 문자는 90바이트 안쪽이라 SMS 로 간다 (LMS 는 단가가 더 비싸다)
    msg_type: 'SMS',
    // 과금 없이 응답만 받아보려면 ALIGO_TEST_MODE=true
    testmode_yn: process.env.ALIGO_TEST_MODE === 'true' ? 'Y' : 'N',
  });

  try {
    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error('[sms] 발송 실패', res.status);
      return 'failed';
    }

    // ⚠️ 알리고는 **실패해도 HTTP 200** 을 주고 본문의 result_code 로 알린다.
    //    res.ok 만 보고 넘기면 안 보낸 문자를 보냈다고 하게 된다.
    const body = (await res.json()) as { result_code?: number | string; message?: string };
    if (Number(body.result_code) !== 1) {
      // 번호는 남기지 않는다 — 로그도 개인정보다
      console.error('[sms] 발송 실패', body.result_code, body.message ?? '사유 미상');
      return 'failed';
    }
    return 'sent';
  } catch (error) {
    console.error('[sms] 발송 실패', error);
    return 'failed';
  }
}
