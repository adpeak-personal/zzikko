import type { Metadata } from 'next';
import { KakaoSignupForm } from './KakaoSignupForm';

export const metadata: Metadata = { title: '카카오로 가입하기', robots: { index: false } };

export default function KakaoSignupPage() {
  return <KakaoSignupForm />;
}
