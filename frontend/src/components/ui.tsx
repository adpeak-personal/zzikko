import Link from 'next/link';
import { BadgeCheck, ChevronRight } from 'lucide-react';
import type { Carrier, MemberLevel, PublicUser } from '@/lib/types';
import { cn } from '@/lib/utils';

export function Avatar({ user, size = 28 }: { user: Pick<PublicUser, 'nickname' | 'avatarColor'>; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: user.avatarColor, fontSize: size * 0.42 }}
      aria-hidden
    >
      {user.nickname.slice(0, 1)}
    </span>
  );
}

const LEVEL_STYLE: Record<MemberLevel, { icon: string; cls: string }> = {
  새싹: { icon: '🌱', cls: 'bg-lime-50 text-lime-700' },
  눈팅러: { icon: '👀', cls: 'bg-slate-100 text-slate-600' },
  단골: { icon: '🧡', cls: 'bg-zz-50 text-zz-700' },
  고수: { icon: '🏅', cls: 'bg-amber-50 text-amber-700' },
  성지지기: { icon: '🏪', cls: 'bg-shop-50 text-shop-700' },
  운영진: { icon: '⚙️', cls: 'bg-gray-900 text-white' },
};

export function LevelBadge({ level, className }: { level: MemberLevel; className?: string }) {
  const style = LEVEL_STYLE[level];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold',
        style.cls,
        className,
      )}
    >
      <span aria-hidden>{style.icon}</span>
      {level}
    </span>
  );
}

/** 인증된 판매자 표시 */
export function SellerBadge({ verified = true }: { verified?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold',
        verified ? 'bg-shop-50 text-shop-700' : 'bg-gray-100 text-gray-500',
      )}
    >
      {verified && <BadgeCheck size={12} />}
      {verified ? '인증 판매자' : '판매자'}
    </span>
  );
}

const CARRIER_STYLE: Record<Carrier, string> = {
  SKT: 'bg-red-50 text-red-600',
  KT: 'bg-slate-900 text-white',
  'LG U+': 'bg-fuchsia-50 text-fuchsia-700',
  알뜰폰: 'bg-emerald-50 text-emerald-700',
};

export function CarrierTag({ carrier }: { carrier: Carrier }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] font-bold', CARRIER_STYLE[carrier])}>
      {carrier}
    </span>
  );
}

export function Tag({
  children,
  tone = 'gray',
}: {
  children: React.ReactNode;
  tone?: 'gray' | 'zz' | 'shop' | 'dark' | 'warn';
}) {
  const tones = {
    gray: 'bg-gray-100 text-gray-600',
    zz: 'bg-zz-50 text-zz-700',
    shop: 'bg-shop-50 text-shop-700',
    dark: 'bg-gray-800 text-white',
    warn: 'bg-amber-50 text-amber-700',
  };
  return (
    <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold', tones[tone])}>
      {children}
    </span>
  );
}

export function Card({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('rounded-2xl border border-gray-200 bg-white', className)}>
      {children}
    </section>
  );
}

export function SectionHeader({ title, href, sub }: { title: React.ReactNode; href?: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
      <h2 className="flex items-baseline gap-2 text-base font-bold text-gray-900">
        {title}
        {sub && <span className="text-xs font-normal text-gray-400">{sub}</span>}
      </h2>
      {href && (
        <Link href={href} className="flex items-center text-xs text-gray-400 hover:text-zz-600">
          더보기 <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

export function PageTitle({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-gray-900 pb-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{title}</h1>
        {desc && <p className="mt-1.5 text-sm text-gray-500">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function FilterChip({
  href,
  active,
  onClick,
  children,
}: {
  href: string;
  active: boolean;
  /** 주면 주소 이동 대신 버튼으로 동작한다 (클라이언트에서 거르는 목록용) */
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const className = cn(
    'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition',
    active ? 'border-zz-600 bg-zz-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-zz-300',
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={className}>
        {children}
      </button>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** 이미지가 붙기 전까지 쓰는 그라디언트 썸네일 */
export function Thumb({ tone = 'zz', className, label }: { tone?: string; className?: string; label?: string }) {
  return (
    <div className={cn('relative overflow-hidden', `thumb-${tone}`, className)}>
      <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/15" />
      <span className="absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-black/10" />
      {label && <span className="absolute bottom-2 left-2 rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-white">{label}</span>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-20 text-center text-sm text-gray-400">{children}</p>;
}
