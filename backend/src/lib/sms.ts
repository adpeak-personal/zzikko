import { createHmac, randomBytes } from 'node:crypto';

/**
 * 문자 보내기 — 솔라피(SOLAPI) REST API.
 *
 * `SOLAPI_API_KEY` · `SOLAPI_API_SECRET` · `SMS_FROM`(사전 등록한 발신번호) 셋 다 있어야 보낸다.
 * - 셋 중 하나라도 없고 **개발 환경이면** 문자를 보내지 않고 서버 로그에 인증번호를 찍는다.
 * - **운영에서 없으면 보내지 못한다**(`'unavailable'`). 이메일 가입이 막히고 카카오 가입만 된다.
 *
 * 다른 업체로 바꾸려면 이 파일의 `sendSms` 만 고치면 된다. 라우트는 업체를 모른다.
 */
export type SmsResult = 'sent' | 'logged' | 'unavailable' | 'failed';

const config = () => {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const from = process.env.SMS_FROM?.replace(/\D/g, '');
  return apiKey && apiSecret && from ? { apiKey, apiSecret, from } : null;
};

export const smsReady = () => Boolean(config()) || process.env.NODE_ENV !== 'production';

export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const cfg = config();
  if (!cfg) {
    if (process.env.NODE_ENV === 'production') return 'unavailable';
    console.info(`[sms] (개발 — 실제로 보내지 않음) ${to}: ${text}`);
    return 'logged';
  }

  // 인증 헤더: HMAC-SHA256(date + salt, apiSecret)
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString('hex');
  const signature = createHmac('sha256', cfg.apiSecret).update(date + salt).digest('hex');

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `HMAC-SHA256 apiKey=${cfg.apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({ message: { to, from: cfg.from, text } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // 번호는 남기지 않는다 — 로그도 개인정보다
      console.error('[sms] 발송 실패', res.status, (await res.text()).slice(0, 300));
      return 'failed';
    }
    return 'sent';
  } catch (error) {
    console.error('[sms] 발송 실패', error);
    return 'failed';
  }
}
