import type { Metadata } from 'next';
import { apiGetPublic } from '@/lib/api.server';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: '회원가입' };

export default async function SignupPage() {
  // 카카오 키·문자 발송 설정이 서버에 있는지 — 없는 방식은 화면에서 뺀다
  const options = (await apiGetPublic<{ kakao: boolean; phone: boolean }>('/auth/options')) ?? { kakao: false, phone: false };
  return <SignupForm kakao={options.kakao} phoneReady={options.phone} />;
}
