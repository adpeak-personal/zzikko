import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { HttpError, badRequest, parse, tooManyRequests, unauthorized } from '../lib/http.js';
import { clearSessionCookie, hashPassword, requireAuth, setSessionCookie, verifyPassword } from '../lib/auth.js';
import { hashCode, hashPhone, newCode, normalizePhone } from '../lib/phone.js';
import { sendSms, smsReady } from '../lib/sms.js';
import { fetchKakaoProfile, kakaoAuthorizeUrl, kakaoReady } from '../lib/kakao.js';
import { signToken, verifyToken } from '../lib/signed.js';
import * as users from '../repositories/users.js';
import * as phone from '../repositories/phone.js';

const REGIONS = ['서울', '경기·인천', '부산', '대구', '대전', '광주', '강원', '제주'] as const;

/** 닉네임 첫 글자 아바타에 쓸 색 — 가입할 때 하나 골라준다 */
const AVATAR_COLORS = ['#fa6038', '#2f6f5e', '#1f6feb', '#7b5ea7', '#c2410c', '#0f766e', '#b45309', '#be123c'];

const nicknameSchema = z.string().trim().min(2, '닉네임은 2자 이상이어야 합니다.').max(30);

const signupSchema = z.object({
  email: z.email('이메일 형식이 아닙니다.'),
  // 짧은 비밀번호를 막는다. 복잡도 규칙은 외우기 어렵게만 만들어서 길이로 간다.
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.').max(72),
  nickname: nicknameSchema,
  region: z.enum(REGIONS).optional(),
  /** `/auth/phone/verify` 가 준 토큰 — 휴대폰 인증을 마쳤다는 표시 */
  phoneToken: z.string({ error: '휴대폰 인증을 먼저 해주세요.' }).min(1, '휴대폰 인증을 먼저 해주세요.'),
  agree: z.literal(true, { error: '이용약관과 개인정보 수집에 동의해주세요.' }),
});

const loginSchema = z.object({
  email: z.email('이메일 형식이 아닙니다.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

/* ── 휴대폰 인증 ── */
const CODE_TTL_MINUTES = 3;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;
const MAX_SENDS_PER_DAY = 5;
/** 사이트 전체 한 시간 발송 상한. 누가 번호를 바꿔 가며 두드려도 문자 요금이 이 이상 안 나간다 */
const MAX_SENDS_PER_HOUR = Number(process.env.SMS_MAX_PER_HOUR ?? 200);
/** 인증을 마친 뒤 가입 폼을 채울 시간 */
const PHONE_TOKEN_TTL = 30 * 60;

/* ── 카카오 ── */
const KAKAO_STATE_COOKIE = 'zzikko_kakao_state';
const KAKAO_SIGNUP_COOKIE = 'zzikko_kakao_signup';

interface KakaoState {
  state: string;
  next: string;
}
interface KakaoPending {
  kakaoId: string;
  nickname: string | null;
  next: string;
}

/** 로그인 뒤 돌아갈 곳 — 우리 사이트 안의 경로만 (`//evil.com` 같은 건 막는다) */
const safeNext = (value: unknown) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : '/';

const shortCookie = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const, // 카카오에서 돌아오는 건 최상위 GET 이동이라 lax 로 실린다
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

export default async function authRoutes(app: FastifyInstance) {
  const startSession = (reply: FastifyReply, row: users.UserRow) =>
    setSessionCookie(reply, app.jwt.sign({ id: row.id, nickname: row.nickname, role: row.role }));

  /** 가입 화면이 어느 방식이 켜져 있는지 보고 그린다 */
  app.get('/auth/options', async () => ({ kakao: kakaoReady(), phone: smsReady() }));

  /* ────────────── 이메일 가입 (휴대폰 인증 필수) ────────────── */

  app.post('/auth/phone/send', async (request) => {
    const { phone: raw } = parse(z.object({ phone: z.string().max(30) }), request.body);
    const number = normalizePhone(raw);
    if (!number) throw badRequest('휴대폰 번호를 확인해주세요.');

    if (!smsReady()) {
      throw new HttpError(503, '휴대폰 인증을 준비하고 있어요. 지금은 카카오로 가입해 주세요.');
    }

    const phoneHash = hashPhone(number);
    if (await users.phoneTaken(phoneHash)) throw badRequest('이미 가입에 쓰인 번호입니다.');

    const recent = await phone.recentSends(phoneHash);
    if (recent.since !== null && recent.since < RESEND_SECONDS) {
      throw tooManyRequests(`${RESEND_SECONDS - recent.since}초 뒤에 다시 받을 수 있어요.`);
    }
    if (recent.day >= MAX_SENDS_PER_DAY) throw tooManyRequests('오늘은 더 받을 수 없어요. 내일 다시 시도해주세요.');
    if ((await phone.sendsLastHour()) >= MAX_SENDS_PER_HOUR) {
      request.log.warn('휴대폰 인증 발송이 시간당 상한에 닿았습니다');
      throw tooManyRequests('요청이 몰려 잠시 쉬어가요. 조금 뒤에 다시 시도해주세요.');
    }

    const code = newCode();
    // 먼저 적고 보낸다 — 발송 실패도 횟수에 넣어야 실패를 이용해 제한을 피하지 못한다
    await phone.createVerification(phoneHash, hashCode(phoneHash, code), CODE_TTL_MINUTES);
    const result = await sendSms(number, `[찍고] 인증번호 ${code} (${CODE_TTL_MINUTES}분 안에 입력)`);
    if (result === 'unavailable' || result === 'failed') {
      throw new HttpError(503, '문자를 보내지 못했어요. 잠시 후 다시 시도해주세요.');
    }
    return { ok: true, expiresIn: CODE_TTL_MINUTES * 60 };
  });

  app.post('/auth/phone/verify', async (request) => {
    const input = parse(
      z.object({ phone: z.string().max(30), code: z.string().trim().regex(/^\d{6}$/, '인증번호 6자리를 입력해주세요.') }),
      request.body,
    );
    const number = normalizePhone(input.phone);
    if (!number) throw badRequest('휴대폰 번호를 확인해주세요.');
    const phoneHash = hashPhone(number);

    const row = await phone.latestVerification(phoneHash);
    if (!row) throw badRequest('인증번호를 먼저 받아주세요.');
    if (row.expired) throw badRequest('인증번호가 만료됐어요. 다시 받아주세요.');
    if (row.attempts >= MAX_ATTEMPTS) throw badRequest('너무 많이 틀렸어요. 인증번호를 다시 받아주세요.');

    if (row.code_hash !== hashCode(phoneHash, input.code)) {
      await phone.countAttempt(row.id);
      const left = MAX_ATTEMPTS - row.attempts - 1;
      throw badRequest(left > 0 ? `인증번호가 맞지 않아요. (${left}번 남음)` : '너무 많이 틀렸어요. 다시 받아주세요.');
    }

    await phone.markVerified(row.id);
    return { phoneToken: signToken('phone', { phoneHash }, PHONE_TOKEN_TTL) };
  });

  app.post('/auth/signup', async (request, reply) => {
    const input = parse(signupSchema, request.body);

    const verified = verifyToken<{ phoneHash: string }>('phone', input.phoneToken);
    if (!verified) throw badRequest('휴대폰 인증이 만료됐어요. 다시 인증해주세요.');

    if (await users.emailTaken(input.email)) throw badRequest('이미 가입된 이메일입니다.');
    if (await users.nicknameTaken(input.nickname)) throw badRequest('이미 쓰고 있는 닉네임입니다.');
    if (await users.phoneTaken(verified.phoneHash)) throw badRequest('이미 가입에 쓰인 번호입니다.');

    const id = await createUserOr400({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      phoneHash: verified.phoneHash,
      nickname: input.nickname,
      region: input.region ?? '서울',
      avatarColor: avatarColor(input.nickname),
    });

    const row = (await users.findById(id))!;
    startSession(reply, row);
    return reply.code(201).send(users.toMe(row));
  });

  app.post('/auth/login', async (request, reply) => {
    const input = parse(loginSchema, request.body);

    const row = await users.findByEmail(input.email);
    // 이메일이 없는 경우와 비밀번호가 틀린 경우를 구분해서 알려주지 않는다 (계정 존재 여부 유출 방지)
    if (!row?.password_hash || !(await verifyPassword(input.password, row.password_hash))) {
      throw unauthorized('이메일 또는 비밀번호가 맞지 않습니다.');
    }

    startSession(reply, row);
    return users.toMe(row);
  });

  /* ────────────── 카카오 ────────────── */

  /** 카카오 로그인 시작 — 버튼은 이 주소로 그냥 이동한다 */
  app.get('/auth/kakao', async (request, reply) => {
    const { next } = request.query as { next?: string };
    if (!kakaoReady()) return reply.redirect('/login?error=kakao_unavailable');

    // state 는 다른 사이트가 우리 콜백을 대신 부르는 걸(CSRF) 막는다 — 쿠키에 같은 값을 넣어 두고 맞춰 본다
    const state = randomBytes(16).toString('base64url');
    reply.setCookie(KAKAO_STATE_COOKIE, signToken('kakao-state', { state, next: safeNext(next) }, 600), shortCookie(600));
    return reply.redirect(kakaoAuthorizeUrl(state));
  });

  app.get('/auth/kakao/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    const saved = verifyToken<KakaoState>('kakao-state', request.cookies[KAKAO_STATE_COOKIE]);
    reply.clearCookie(KAKAO_STATE_COOKIE, { path: '/' });

    // 동의 화면에서 취소하면 error=access_denied 로 돌아온다
    if (query.error) return reply.redirect(`/login?next=${encodeURIComponent(saved?.next ?? '/')}`);
    if (!saved || !query.state || saved.state !== query.state || !query.code) {
      return reply.redirect('/login?error=kakao_state');
    }

    let profile;
    try {
      profile = await fetchKakaoProfile(query.code);
    } catch (error) {
      request.log.error(error, '카카오 로그인 실패');
      return reply.redirect('/login?error=kakao_failed');
    }

    const existing = await users.findByKakaoId(profile.id);
    if (existing) {
      startSession(reply, existing);
      return reply.redirect(saved.next);
    }

    // 처음이면 닉네임 확인 + 약관 동의 한 번만 받는다
    const pending: KakaoPending = { kakaoId: profile.id, nickname: profile.nickname, next: saved.next };
    reply.setCookie(KAKAO_SIGNUP_COOKIE, signToken('kakao-signup', pending, 1800), shortCookie(1800));
    return reply.redirect('/signup/kakao');
  });

  /** 카카오 가입 마무리 화면이 닉네임을 미리 채우려고 부른다 */
  app.get('/auth/kakao/pending', async (request) => {
    const pending = verifyToken<KakaoPending>('kakao-signup', request.cookies[KAKAO_SIGNUP_COOKIE]);
    if (!pending) throw unauthorized('카카오 로그인을 다시 해주세요.');
    return { nickname: pending.nickname, nicknameTaken: pending.nickname ? await users.nicknameTaken(pending.nickname) : false };
  });

  app.post('/auth/kakao/complete', async (request, reply) => {
    const pending = verifyToken<KakaoPending>('kakao-signup', request.cookies[KAKAO_SIGNUP_COOKIE]);
    if (!pending) throw unauthorized('카카오 로그인을 다시 해주세요.');

    const input = parse(
      z.object({
        nickname: nicknameSchema,
        region: z.enum(REGIONS).optional(),
        agree: z.literal(true, { error: '이용약관과 개인정보 수집에 동의해주세요.' }),
      }),
      request.body,
    );

    // 두 탭에서 동시에 마무리한 경우 — 이미 만들어졌으면 그 계정으로 들어간다
    let row = await users.findByKakaoId(pending.kakaoId);
    if (!row) {
      if (await users.nicknameTaken(input.nickname)) throw badRequest('이미 쓰고 있는 닉네임입니다.');
      const id = await createUserOr400({
        kakaoId: pending.kakaoId,
        nickname: input.nickname,
        region: input.region ?? '서울',
        avatarColor: avatarColor(input.nickname),
      });
      row = (await users.findById(id))!;
    }

    reply.clearCookie(KAKAO_SIGNUP_COOKIE, { path: '/' });
    startSession(reply, row);
    return reply.code(201).send({ ...users.toMe(row), next: pending.next });
  });

  /* ────────────── 공통 ────────────── */

  app.post('/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => {
    const row = await users.findById(request.user!.id);
    if (!row) throw unauthorized();
    return users.toMe(row);
  });
}

/** 위에서 확인했어도 동시에 두 번 누르면 UNIQUE 에 걸린다 — 500 대신 알아들을 말로 */
async function createUserOr400(input: users.NewUser): Promise<number> {
  try {
    return await users.createUser(input);
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw badRequest('이미 가입된 정보가 있습니다. 닉네임·이메일·휴대폰 번호를 확인해주세요.');
    }
    throw error;
  }
}

/** 닉네임으로 아바타 색을 고정한다 — 같은 사람은 늘 같은 색 */
function avatarColor(nickname: string) {
  let hash = 0;
  for (const char of nickname) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}
