'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_FAVORITES, HOME_MENU_ID, MAX_FAVORITES } from '@/lib/menu';

const STORAGE_KEY = 'zzikko:favorite-menus';

/**
 * 헤더 아래 '자주 쓰는 메뉴' 목록. 이 브라우저에만 저장된다.
 * 회원 기능이 붙으면 서버에 저장하도록 바꾼다.
 */
export function useFavoriteMenus() {
  const [ids, setIds] = useState<string[]>(DEFAULT_FAVORITES);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        // 홈은 항상 맨 앞에 유지한다
        setIds([HOME_MENU_ID, ...parsed.filter((id) => id !== HOME_MENU_ID)]);
      }
    } catch {
      // 저장소를 못 읽으면 기본값을 그대로 쓴다
    }
  }, []);

  const save = useCallback((next: string[]) => {
    setIds(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 저장 실패는 화면 동작에 영향을 주지 않는다
    }
  }, []);

  const toggle = useCallback(
    (id: string) => {
      if (id === HOME_MENU_ID) return;
      const has = ids.includes(id);
      if (!has && ids.length - 1 >= MAX_FAVORITES) return;
      save(has ? ids.filter((v) => v !== id) : [...ids, id]);
    },
    [ids, save],
  );

  const reset = useCallback(() => save(DEFAULT_FAVORITES), [save]);

  return { ids, toggle, reset, canAddMore: ids.length - 1 < MAX_FAVORITES };
}
