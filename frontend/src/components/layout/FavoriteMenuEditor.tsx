'use client';

import { useEffect } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { HOME_MENU_ID, MAX_FAVORITES, type MenuGroup } from '@/lib/menu';
import { useFavoriteMenus } from '@/hooks/useFavoriteMenus';
import { cn } from '@/lib/utils';

/** 자주 쓰는 메뉴 선택 창 */
export function FavoriteMenuEditor({ catalog, open, onClose }: { catalog: MenuGroup[]; open: boolean; onClose: () => void }) {
  const { ids, toggle, reset, canAddMore } = useFavoriteMenus();

  // 열려 있는 동안 Esc 로 닫고, 뒤 화면이 스크롤되지 않게 한다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const selectedCount = ids.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="자주 쓰는 메뉴 편집">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="닫기" />

      <div className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">자주 쓰는 메뉴</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              홈을 빼고 최대 {MAX_FAVORITES}개까지 고를 수 있어요 ({selectedCount}/{MAX_FAVORITES})
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100" aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {catalog.map((group) => (
            <div key={group.name} className="mb-4 last:mb-0">
              <p className="mb-2 text-xs font-bold text-gray-400">{group.name}</p>
              <ul className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const selected = ids.includes(item.id);
                  const fixed = item.id === HOME_MENU_ID;
                  const disabled = fixed || (!selected && !canAddMore);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggle(item.id)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium',
                          selected ? 'border-zz-500 bg-zz-50 text-zz-700' : 'border-gray-200 text-gray-600 hover:border-gray-300',
                          disabled && !fixed && 'cursor-not-allowed opacity-40',
                          fixed && 'cursor-default opacity-70',
                        )}
                      >
                        <item.icon size={14} />
                        {item.label}
                        {selected && <Check size={13} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={reset} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <RotateCcw size={14} /> 기본값으로
          </button>
          <button type="button" onClick={onClose} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black">
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
