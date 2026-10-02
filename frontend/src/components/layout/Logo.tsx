import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 정사각 심볼 — 살짝 기울어진 체크마크 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-[10px] bg-zz-500 text-white', className)}
      style={{ width: size, height: size, transform: 'rotate(-8deg)' }}
      aria-hidden
    >
      <Check size={size * 0.62} strokeWidth={3.6} />
    </span>
  );
}

/** 심볼 + 워드마크 */
export function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-[26px] font-extrabold leading-none tracking-[-0.06em] text-gray-900">
        찍고<span className="text-zz-500">.</span>
      </span>
    </span>
  );
}
