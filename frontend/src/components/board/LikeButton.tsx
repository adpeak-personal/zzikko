'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

/** 좋아요 토글 — 로그인 안 했으면 로그인 화면으로 보낸다 */
export function LikeButton({ postId, likes, canLike }: { postId: number; likes: number; canLike: boolean }) {
  const router = useRouter();
  const [state, setState] = useState({ likes, liked: false });
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!canLike) {
      router.push(`/login?next=/board`);
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch<{ liked: boolean; likes: number }>(`/posts/${postId}/like`, { method: 'POST' });
      setState(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        'flex items-center gap-1.5 rounded-xl border px-5 py-2.5 font-bold transition',
        state.liked ? 'border-zz-500 bg-zz-50 text-zz-700' : 'border-gray-200 text-gray-700 hover:border-zz-300 hover:text-zz-700',
      )}
    >
      <Heart size={16} fill={state.liked ? 'currentColor' : 'none'} /> 좋아요 {state.likes}
    </button>
  );
}
