import type { Metadata } from 'next';
import { apiGetPublic } from '@/lib/api.server';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: '로그인' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const options = await apiGetPublic<{ kakao: boolean }>('/auth/options');
  return <LoginForm next={next} kakao={options?.kakao ?? false} errorCode={error} />;
}
